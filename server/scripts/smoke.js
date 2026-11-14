/**
 * End-to-end check against a RUNNING server (npm run dev, after npm run seed):
 *   npm run smoke
 * 1. Logs in as the demo customer and walks the whole booking flow in mock-payment mode.
 * 2. "Break it deliberately": many different users try to hold the SAME seat at the same instant.
 */
const BASE = process.env.API_URL || 'http://localhost:5000/api';

function createClient() {
  const jar = {};
  return async function call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar[pair.slice(0, i)] = pair.slice(i + 1);
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data };
  };
}

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
};

async function main() {
  const anon = createClient();
  const health = await anon('GET', '/health');
  check('API is up', health.status === 200, BASE);

  const user = createClient();
  const login = await user('POST', '/auth/login', { email: 'user@cinema.test', password: 'User@1234' });
  check('Customer can log in', login.status === 200, login.data.message || '');
  if (login.status !== 200) return console.log('Run "npm run seed" first.');

  const shows = await anon('GET', '/shows?limit=50');
  // pick a show far enough away that cancellation is still allowed (cutoff is 2 hours)
  const show = shows.data.shows.find((s) => s.availableSeats > 20 && new Date(s.startTime) - Date.now() > 3 * 3600 * 1000);
  check('Upcoming shows are listed', Boolean(show), `${shows.data.total} shows`);
  if (!show) return;

  const map = await anon('GET', `/shows/${show.id}/seats`);
  const free = map.data.seats.filter((s) => s.status === 'AVAILABLE');

  // ---- 1. Normal booking flow ----
  const mine = free.slice(0, 2).map((s) => s.seatId);
  const hold = await user('POST', '/seat-locks', { showId: show.id, seatIds: mine });
  check('Hold two seats for 5 minutes', hold.status === 201, mine.join(', '));
  const booking = await user('POST', '/bookings', { lockId: hold.data.lock?.lockId, price: 1 });
  check('Booking created with a server-side price', booking.status === 201 && booking.data.booking.totalAmount > 1, `₹${(booking.data.booking?.totalAmount || 0) / 100}`);
  const order = await user('POST', '/payments/create-order', { bookingId: booking.data.booking.id });
  check('Payment order created', order.status === 201, order.data.order?.provider);
  if (order.data.order?.provider !== 'mock') return console.log('Skipping payment steps: PAYMENT_PROVIDER is not "mock".');
  const paid = await user('POST', '/payments/mock/complete', { orderId: order.data.order.orderId });
  const forged = await user('POST', '/payments/verify', { bookingId: booking.data.booking.id, orderId: paid.data.orderId, paymentId: paid.data.paymentId, signature: 'f'.repeat(64) });
  check('Forged payment signature is rejected', forged.status === 400);
  const verified = await user('POST', '/payments/verify', { bookingId: booking.data.booking.id, ...paid.data });
  check('Real signature confirms the booking', verified.data.booking?.status === 'CONFIRMED', verified.data.booking?.bookingCode);
  check('QR code issued', String(verified.data.booking?.qrCode).startsWith('data:image/png'));
  const pdf = await user('GET', `/bookings/${booking.data.booking.id}/ticket`);
  check('PDF ticket downloads', Buffer.isBuffer(pdf.data) && pdf.data.subarray(0, 4).toString() === '%PDF', `${pdf.data.length} bytes`);
  const cancel = await user('POST', `/bookings/${booking.data.booking.id}/cancel`);
  check('Cancellation refunds the payment', cancel.data.booking?.refundStatus === 'REFUNDED', cancel.data.message || '');

  // ---- 2. Everyone grabs the same seat at once ----
  const target = free[5].seatId;
  const crowd = 12;
  const users = await Promise.all(Array.from({ length: crowd }, async (_, i) => {
    const c = createClient();
    await c('POST', '/auth/register', { name: `Racer ${i}`, email: `racer-${Date.now()}-${i}@example.com`, password: 'Racer1234' });
    return c;
  }));
  const results = await Promise.all(users.map((c) => c('POST', '/seat-locks', { showId: show.id, seatIds: [target] })));
  const wins = results.filter((r) => r.status === 201).length;
  const losses = results.filter((r) => r.status === 409).length;
  check(`${crowd} users race for seat ${target}: exactly one wins`, wins === 1 && losses === crowd - 1, `${wins} won, ${losses} told the seat was taken`);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
