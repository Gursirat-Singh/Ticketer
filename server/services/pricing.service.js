import { env } from '../config/env.js';

/** All values in paise. The server is the only place totals are computed. */
export function computeTotals(seats) {
  const subtotal = seats.reduce((sum, seat) => sum + seat.price, 0);
  const convenienceFee = env.convenienceFeePerTicket * seats.length;
  const tax = Math.round(((subtotal + convenienceFee) * env.taxPercent) / 100);
  return { subtotal, convenienceFee, tax, totalAmount: subtotal + convenienceFee + tax };
}
