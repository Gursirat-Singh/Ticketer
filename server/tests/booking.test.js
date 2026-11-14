import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PRICES, api, bearer, closeTestDb, completeMockPayment, connectTestDb, createFixture, createUser, holdSeats,
  payFully, startCheckout, verifyPayment,
} from './helpers.js';
import { Booking, Payment, ShowSeat } from '../models/index.js';
import { sweepExpiredHolds } from '../services/seatHold.service.js';
import { mockProvider } from '../services/providers/mock.js';

const app = api();

beforeAll(connectTestDb);
afterAll(closeTestDb);

describe('seat holds under concurrency', () => {
  it('lets exactly one of 50 simultaneous requests hold the same seat', async () => {
    const { show } = await createFixture();
    const users = await Promise.all(Array.from({ length: 50 }, () => createUser()));

    const results = await Promise.all(users.map((u) => holdSeats(app, u.token, show._id, ['A1'])));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(49);
    expect(await ShowSeat.countDocuments({ showId: show._id, status: 'HELD' })).toBe(1);
  });

  it('is all-or-nothing for multi-seat holds', async () => {
    const { show } = await createFixture();
    const [a, b] = await Promise.all([createUser(), createUser()]);

    expect((await holdSeats(app, a.token, show._id, ['A1'])).status).toBe(201);
    const res = await holdSeats(app, b.token, show._id, ['A1', 'A2']);

    expect(res.status).toBe(409);
    expect(res.body.details.unavailable).toEqual(['A1']);
    const a2 = await ShowSeat.findOne({ showId: show._id, seatId: 'A2' });
    expect(a2.status).toBe('AVAILABLE'); // the half-acquired seat was given back
  });

  it('never leaves partially held seats when overlapping requests race', async () => {
    const { show } = await createFixture();
    const users = await Promise.all(Array.from({ length: 24 }, () => createUser()));
    const pairs = [['A1', 'A2'], ['A2', 'A3'], ['A3', 'A4'], ['A4', 'A5']];

    await Promise.all(users.map((u, i) => holdSeats(app, u.token, show._id, pairs[i % pairs.length])));

    const held = await ShowSeat.find({ showId: show._id, status: 'HELD' }).lean();
    const perHold = {};
    for (const s of held) perHold[s.holdId] = (perHold[s.holdId] || 0) + 1;
    for (const count of Object.values(perHold)) expect(count).toBe(2); // every surviving hold is complete
    expect(new Set(held.map((s) => s.seatId)).size).toBe(held.length); // no seat held twice
  });

  it('lets another user take a seat once its hold has expired, and shows it as available', async () => {
    const { show } = await createFixture();
    const [a, b] = await Promise.all([createUser(), createUser()]);
    await holdSeats(app, a.token, show._id, ['B1']);
    await ShowSeat.updateOne({ showId: show._id, seatId: 'B1' }, { holdExpiresAt: new Date(Date.now() - 1000) });

    const map = await app.get(`/api/shows/${show._id}/seats`);
    expect(map.body.seats.find((s) => s.seatId === 'B1').status).toBe('AVAILABLE');

    expect((await holdSeats(app, b.token, show._id, ['B1'])).status).toBe(201);
  });

  it('sweeper frees expired holds and expires their pending bookings', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking } = await startCheckout(app, u.token, show._id, ['B2']);
    await ShowSeat.updateOne({ showId: show._id, seatId: 'B2' }, { holdExpiresAt: new Date(Date.now() - 1000) });
    await Booking.updateOne({ _id: booking.id }, { holdExpiresAt: new Date(Date.now() - 1000) });

    expect(await sweepExpiredHolds()).toBeGreaterThanOrEqual(1);
    expect((await ShowSeat.findOne({ showId: show._id, seatId: 'B2' })).status).toBe('AVAILABLE');
    expect((await Booking.findById(booking.id)).status).toBe('EXPIRED');
  });

  it('releases a hold on request', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const lock = (await holdSeats(app, u.token, show._id, ['B3', 'B4'])).body.lock;
    const res = await app.delete(`/api/seat-locks/${lock.lockId}`).set(bearer(u.token));
    expect(res.body.released).toBe(2);
    expect(await ShowSeat.countDocuments({ showId: show._id, status: 'HELD' })).toBe(0);
  });

  it('does not let someone else release your hold', async () => {
    const { show } = await createFixture();
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const lock = (await holdSeats(app, a.token, show._id, ['B5'])).body.lock;
    const res = await app.delete(`/api/seat-locks/${lock.lockId}`).set(bearer(b.token));
    expect(res.body.released).toBe(0);
    expect((await ShowSeat.findOne({ showId: show._id, seatId: 'B5' })).status).toBe('HELD');
  });

  it('rejects holds on shows that already started, and requires login', async () => {
    const { show } = await createFixture({ startInHours: -1 });
    const u = await createUser();
    expect((await holdSeats(app, u.token, show._id, ['A1'])).status).toBe(409);
    expect((await app.post('/api/seat-locks').send({ showId: String(show._id), seatIds: ['A1'] })).status).toBe(401);
  });

  it('validates the seat selection', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    expect((await holdSeats(app, u.token, show._id, [])).status).toBe(400);
    expect((await holdSeats(app, u.token, show._id, ['A1', 'A1'])).status).toBe(400);
    expect((await holdSeats(app, u.token, show._id, ['not-a-seat'])).status).toBe(400);
    expect((await holdSeats(app, u.token, show._id, ['Z9'])).status).toBe(409); // valid format, but no such seat
  });
});

describe('booking creation', () => {
  it('computes prices on the server and ignores client-supplied amounts', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const lock = (await holdSeats(app, u.token, show._id, ['A1', 'C1'])).body.lock; // regular + gold
    const res = await app
      .post('/api/bookings')
      .set(bearer(u.token))
      .send({ lockId: lock.lockId, totalAmount: 1, subtotal: 1, price: 1 });

    const subtotal = PRICES.REGULAR + PRICES.GOLD; // 30000
    const fee = 2000 * 2;
    const tax = Math.round(((subtotal + fee) * 18) / 100);
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ subtotal, convenienceFee: fee, tax, totalAmount: subtotal + fee + tax });
    expect(res.body.booking.status).toBe('PENDING_PAYMENT');
  });

  it('is idempotent for the same idempotency key and for the same hold', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const lock = (await holdSeats(app, u.token, show._id, ['A2'])).body.lock;
    const body = { lockId: lock.lockId, idempotencyKey: 'key-12345678' };
    const first = await app.post('/api/bookings').set(bearer(u.token)).send(body);
    const second = await app.post('/api/bookings').set(bearer(u.token)).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.booking.id).toBe(first.body.booking.id);
    expect(await Booking.countDocuments({ userId: u.user._id })).toBe(1);
  });

  it('refuses to book a hold that belongs to someone else or has expired', async () => {
    const { show } = await createFixture();
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const lock = (await holdSeats(app, a.token, show._id, ['A3'])).body.lock;
    expect((await app.post('/api/bookings').set(bearer(b.token)).send({ lockId: lock.lockId })).status).toBe(410);

    await ShowSeat.updateOne({ showId: show._id, seatId: 'A3' }, { holdExpiresAt: new Date(Date.now() - 1000) });
    expect((await app.post('/api/bookings').set(bearer(a.token)).send({ lockId: lock.lockId })).status).toBe(410);
  });

  it('only shows a booking to its owner (or an admin)', async () => {
    const { show } = await createFixture();
    const [owner, other, admin] = await Promise.all([createUser(), createUser(), createUser('admin')]);
    const { booking } = await startCheckout(app, owner.token, show._id, ['A4']);

    expect((await app.get(`/api/bookings/${booking.id}`).set(bearer(owner.token))).status).toBe(200);
    expect((await app.get(`/api/bookings/${booking.id}`).set(bearer(other.token))).status).toBe(404);
    expect((await app.get(`/api/bookings/${booking.id}`).set(bearer(admin.token))).status).toBe(200);
    // and another user cannot start a payment for it
    expect((await app.post('/api/payments/create-order').set(bearer(other.token)).send({ bookingId: booking.id })).status).toBe(404);
  });
});

describe('payment and confirmation', () => {
  it('confirms a booking after a valid signature, marks seats booked and issues a QR code', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { res, booking } = await payFully(app, u.token, show._id, ['C2', 'C3']);

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CONFIRMED');
    expect(res.body.booking.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(await ShowSeat.countDocuments({ showId: show._id, status: 'BOOKED', bookingId: booking.id })).toBe(2);
    expect((await Payment.findOne({ bookingId: booking.id })).status).toBe('PAID');

    // seats are gone for everyone else
    const other = await createUser();
    expect((await holdSeats(app, other.token, show._id, ['C2'])).status).toBe(409);
  });

  it('rejects a bad signature and leaves the booking unpaid', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking, order } = await startCheckout(app, u.token, show._id, ['C4']);
    const res = await verifyPayment(app, u.token, booking.id, { orderId: order.orderId, paymentId: 'mock_pay_forged', signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect((await Booking.findById(booking.id)).status).toBe('PENDING_PAYMENT');
    expect(await ShowSeat.countDocuments({ showId: show._id, status: 'BOOKED' })).toBe(0);
  });

  it('treats a repeated verify call as idempotent', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking, payment } = await payFully(app, u.token, show._id, ['C5']);
    const again = await verifyPayment(app, u.token, booking.id, payment);
    expect(again.status).toBe(200);
    expect(again.body.booking.status).toBe('CONFIRMED');
    expect(await ShowSeat.countDocuments({ showId: show._id, status: 'BOOKED' })).toBe(1);
  });

  it('reuses one open order per booking', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking, order } = await startCheckout(app, u.token, show._id, ['C6']);
    const again = await app.post('/api/payments/create-order').set(bearer(u.token)).send({ bookingId: booking.id });
    expect(again.body.order.orderId).toBe(order.orderId);
    expect(await Payment.countDocuments({ bookingId: booking.id })).toBe(1);
  });

  it('confirms via webhook when the browser never comes back, and ignores duplicate events', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking, order } = await startCheckout(app, u.token, show._id, ['D1']);
    const raw = JSON.stringify({ id: 'evt_1', event: 'payment.captured', orderId: order.orderId, paymentId: 'mock_pay_wh1' });
    const send = (sig) => app.post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-mock-signature', sig).send(raw);

    expect((await send('bad-signature')).status).toBe(400);
    expect((await Booking.findById(booking.id)).status).toBe('PENDING_PAYMENT');

    const ok = await send(mockProvider.signWebhook(raw));
    expect(ok.status).toBe(200);
    expect((await Booking.findById(booking.id)).status).toBe('CONFIRMED');

    const dup = await send(mockProvider.signWebhook(raw));
    expect(dup.body.duplicate).toBe(true);
  });

  it('confirms once when verify and webhook arrive at the same moment', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking, order } = await startCheckout(app, u.token, show._id, ['D2']);
    const p = await completeMockPayment(app, u.token, order.orderId);
    const raw = JSON.stringify({ id: 'evt_race', event: 'payment.captured', orderId: order.orderId, paymentId: p.paymentId });

    const [v, w] = await Promise.all([
      verifyPayment(app, u.token, booking.id, p),
      app.post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-mock-signature', mockProvider.signWebhook(raw)).send(raw),
    ]);

    expect(v.status).toBe(200);
    expect(w.status).toBe(200);
    expect((await Booking.findById(booking.id)).status).toBe('CONFIRMED');
    expect(await ShowSeat.countDocuments({ showId: show._id, status: 'BOOKED', bookingId: booking.id })).toBe(1);
    expect((await Payment.findOne({ bookingId: booking.id })).status).toBe('PAID');
  });

  it('still confirms a late payment when the expired seats were not taken by anyone else', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking, order } = await startCheckout(app, u.token, show._id, ['D3']);
    const p = await completeMockPayment(app, u.token, order.orderId);

    await ShowSeat.updateOne({ showId: show._id, seatId: 'D3' }, { holdExpiresAt: new Date(Date.now() - 1000) });
    await Booking.updateOne({ _id: booking.id }, { holdExpiresAt: new Date(Date.now() - 1000) });
    await sweepExpiredHolds();
    expect((await Booking.findById(booking.id)).status).toBe('EXPIRED');

    const res = await verifyPayment(app, u.token, booking.id, p);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CONFIRMED');
  });

  it('refunds a late payment when someone else got the seats in the meantime', async () => {
    const { show } = await createFixture();
    const [u, rival] = await Promise.all([createUser(), createUser()]);
    const { booking, order } = await startCheckout(app, u.token, show._id, ['D4', 'D5']);
    const p = await completeMockPayment(app, u.token, order.orderId);

    await ShowSeat.updateMany({ showId: show._id, seatId: { $in: ['D4', 'D5'] } }, { holdExpiresAt: new Date(Date.now() - 1000) });
    await Booking.updateOne({ _id: booking.id }, { holdExpiresAt: new Date(Date.now() - 1000) });
    await sweepExpiredHolds();
    expect((await holdSeats(app, rival.token, show._id, ['D5'])).status).toBe(201); // rival grabs one of the two

    const res = await verifyPayment(app, u.token, booking.id, p);
    expect(res.status).toBe(409);
    const b = await Booking.findById(booking.id);
    expect(b.status).toBe('FAILED');
    expect(b.refundStatus).toBe('REFUNDED');
    expect((await Payment.findOne({ bookingId: booking.id })).status).toBe('REFUNDED');
    // all-or-nothing: D4 was given back, and the rival's hold on D5 is untouched
    expect((await ShowSeat.findOne({ showId: show._id, seatId: 'D4' })).status).toBe('AVAILABLE');
    expect((await ShowSeat.findOne({ showId: show._id, seatId: 'D5' })).status).toBe('HELD');
  });

  it('frees the seats when the user reports a failed payment', async () => {
    const { show } = await createFixture();
    const u = await createUser();
    const { booking } = await startCheckout(app, u.token, show._id, ['D6']);
    const res = await app.post('/api/payments/fail').set(bearer(u.token)).send({ bookingId: booking.id });
    expect(res.body.booking.status).toBe('FAILED');
    expect((await ShowSeat.findOne({ showId: show._id, seatId: 'D6' })).status).toBe('AVAILABLE');
    expect((await Payment.findOne({ bookingId: booking.id })).status).toBe('FAILED');
  });
});

describe('cancellation', () => {
  it('cancels, frees the seats and refunds', async () => {
    const { show } = await createFixture({ startInHours: 48 });
    const u = await createUser();
    const { booking } = await payFully(app, u.token, show._id, ['A5']);

    const res = await app.post(`/api/bookings/${booking.id}/cancel`).set(bearer(u.token));
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CANCELLED');
    expect(res.body.booking.refundStatus).toBe('REFUNDED');
    expect((await ShowSeat.findOne({ showId: show._id, seatId: 'A5' })).status).toBe('AVAILABLE');
    expect((await Payment.findOne({ bookingId: booking.id })).status).toBe('REFUNDED');

    expect((await app.post(`/api/bookings/${booking.id}/cancel`).set(bearer(u.token))).status).toBe(409);
  });

  it('blocks customer cancellations inside the cutoff window', async () => {
    const { show } = await createFixture({ startInHours: 1 });
    const u = await createUser();
    const { booking } = await payFully(app, u.token, show._id, ['A6']);
    const res = await app.post(`/api/bookings/${booking.id}/cancel`).set(bearer(u.token));
    expect(res.status).toBe(400);
    expect((await Booking.findById(booking.id)).status).toBe('CONFIRMED');
  });

  it('lists my bookings by bucket', async () => {
    const { show } = await createFixture({ startInHours: 72 });
    const u = await createUser();
    const { booking } = await payFully(app, u.token, show._id, ['B6']);
    const upcoming = await app.get('/api/bookings/my-bookings?bucket=upcoming').set(bearer(u.token));
    expect(upcoming.body.bookings.map((b) => b.id)).toContain(booking.id);
    const cancelled = await app.get('/api/bookings/my-bookings?bucket=cancelled').set(bearer(u.token));
    expect(cancelled.body.bookings).toHaveLength(0);
  });
});
