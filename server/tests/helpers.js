import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { Cinema, Movie, Screen, User } from '../models/index.js';
import { buildSeatLayout } from '../services/seatLayout.service.js';
import { createShow } from '../services/show.service.js';
import { signAccessToken } from '../utils/tokens.js';
import { randomId } from '../utils/crypto.js';

let memoryServer;

/**
 * Uses MONGO_URI_TEST when set (e.g. mongodb://127.0.0.1:27017), otherwise downloads and starts
 * an in-memory MongoDB. Every test file gets its own database.
 */
export async function connectTestDb() {
  let uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri, { dbName: `cinema_test_${randomId(6)}` });
  await mongoose.syncIndexes();
}

export async function closeTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

export const api = () => request(createApp());
export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

export async function createUser(role = 'customer') {
  const user = await User.create({
    name: `Test ${role}`,
    email: `${role}-${randomId(5)}@test.dev`,
    passwordHash: 'not-used-in-these-tests',
    role,
  });
  return { user, token: signAccessToken(user) };
}

export const PRICES = { REGULAR: 10000, GOLD: 20000, PREMIUM: 30000 };

/** A 4x6 screen (rows A-D: A,B regular, C gold, D premium) with one show. */
export async function createFixture({ startInHours = 48 } = {}) {
  const cinema = await Cinema.create({ name: 'Test Cinema', city: 'Testville' });
  const layout = { numRows: 4, seatsPerRow: 6, aisleAfter: 3, goldRows: 1, premiumRows: 1 };
  const seats = buildSeatLayout(layout);
  const screen = await Screen.create({ ...layout, cinemaId: cinema._id, name: `Screen ${randomId(3)}`, seats, totalSeats: seats.length });
  const movie = await Movie.create({
    title: 'Test Movie',
    language: 'English',
    durationMin: 100,
    releaseDate: new Date(),
    genres: ['Drama'],
  });
  const show = await createShow({
    movieId: movie._id,
    screenId: screen._id,
    startTime: new Date(Date.now() + startInHours * 3_600_000),
    priceByCategory: PRICES,
  });
  return { cinema, screen, movie, show };
}

export const holdSeats = (app, token, showId, seatIds) =>
  app.post('/api/seat-locks').set(bearer(token)).send({ showId: String(showId), seatIds });

/** hold -> booking -> create order. Returns the pieces tests need. */
export async function startCheckout(app, token, showId, seatIds) {
  const lock = await holdSeats(app, token, showId, seatIds);
  if (lock.status !== 201) throw new Error(`hold failed: ${lock.status} ${JSON.stringify(lock.body)}`);
  const booking = await app.post('/api/bookings').set(bearer(token)).send({ lockId: lock.body.lock.lockId });
  if (booking.status !== 201) throw new Error(`booking failed: ${JSON.stringify(booking.body)}`);
  const order = await app.post('/api/payments/create-order').set(bearer(token)).send({ bookingId: booking.body.booking.id });
  if (order.status !== 201) throw new Error(`order failed: ${JSON.stringify(order.body)}`);
  return { lock: lock.body.lock, booking: booking.body.booking, order: order.body.order };
}

/** Plays the part of the payment page: returns what the gateway would hand back to the browser. */
export async function completeMockPayment(app, token, orderId) {
  const res = await app.post('/api/payments/mock/complete').set(bearer(token)).send({ orderId });
  if (res.status !== 200) throw new Error(`mock complete failed: ${JSON.stringify(res.body)}`);
  return res.body; // { orderId, paymentId, signature }
}

export const verifyPayment = (app, token, bookingId, p) =>
  app.post('/api/payments/verify').set(bearer(token)).send({ bookingId, orderId: p.orderId, paymentId: p.paymentId, signature: p.signature });

export async function payFully(app, token, showId, seatIds) {
  const checkout = await startCheckout(app, token, showId, seatIds);
  const p = await completeMockPayment(app, token, checkout.order.orderId);
  const res = await verifyPayment(app, token, checkout.booking.id, p);
  return { ...checkout, payment: p, res };
}
