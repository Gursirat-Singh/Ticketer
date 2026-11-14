import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { Booking, Payment, Show, ShowSeat, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { generateBookingCode } from '../utils/codes.js';
import { logger } from '../utils/logger.js';
import { emitSeatUpdate } from '../sockets/index.js';
import { computeTotals } from './pricing.service.js';
import { getProvider } from './providers/index.js';
import { enqueue } from './jobs.js';
import { sendBookingConfirmation } from './email.service.js';

export const BOOKING_POPULATE = [
  { path: 'movieId', select: 'title poster certification language durationMin' },
  { path: 'cinemaId', select: 'name address city' },
  { path: 'screenId', select: 'name' },
  { path: 'showId', select: 'startTime endTime status' },
];

const ref = (v) => {
  if (!v) return null;
  if (v._bsontype === 'ObjectId') return { id: String(v) };
  const { _id, ...rest } = v;
  return { id: String(_id), ...rest };
};

export function toBookingDto(b, { includeUser = false } = {}) {
  const o = typeof b.toObject === 'function' ? b.toObject() : b;
  const dto = {
    id: String(o._id),
    bookingCode: o.bookingCode,
    status: o.status,
    refundStatus: o.refundStatus,
    failureReason: o.failureReason,
    movie: ref(o.movieId),
    cinema: ref(o.cinemaId),
    screen: ref(o.screenId),
    show: ref(o.showId),
    seatIds: o.seatIds,
    seats: o.seats,
    subtotal: o.subtotal,
    convenienceFee: o.convenienceFee,
    tax: o.tax,
    totalAmount: o.totalAmount,
    holdExpiresAt: o.holdExpiresAt,
    qrCode: o.qrCode,
    confirmedAt: o.confirmedAt,
    cancelledAt: o.cancelledAt,
    createdAt: o.createdAt,
  };
  if (o.status === 'PENDING_PAYMENT') dto.holdId = o.holdId;
  if (includeUser && o.userId && o.userId._bsontype !== 'ObjectId' && o.userId.email) {
    dto.user = { id: String(o.userId._id), name: o.userId.name, email: o.userId.email };
  }
  return dto;
}

export async function loadBookingDto(bookingId, opts) {
  const booking = await Booking.findById(bookingId)
    .populate(BOOKING_POPULATE)
    .populate(opts?.includeUser ? { path: 'userId', select: 'name email' } : []);
  return booking ? toBookingDto(booking, opts) : null;
}

/** Turns a live seat hold into a PENDING_PAYMENT booking. Prices come from the database, never the client. */
export async function createBooking({ userId, lockId, idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await Booking.findOne({ userId, idempotencyKey });
    if (existing) return { booking: existing, created: false };
  }
  const already = await Booking.findOne({ userId, holdId: lockId, status: { $in: ['PENDING_PAYMENT', 'CONFIRMING', 'CONFIRMED'] } });
  if (already) return { booking: already, created: false };

  const now = new Date();
  const seats = await ShowSeat.find({ holdId: lockId, heldBy: userId, status: 'HELD', holdExpiresAt: { $gt: now } }).lean();
  if (seats.length === 0) {
    throw new AppError(410, 'Your seat hold has expired or does not exist. Please select seats again.');
  }

  const show = await Show.findById(seats[0].showId).lean();
  if (!show || show.status !== 'SCHEDULED' || new Date(show.startTime) <= now) {
    throw new AppError(409, 'This show is no longer available');
  }

  const totals = computeTotals(seats);
  const holdExpiresAt = new Date(Math.min(...seats.map((s) => s.holdExpiresAt.getTime())));

  try {
    const booking = await Booking.create({
      bookingCode: generateBookingCode(),
      userId,
      showId: show._id,
      movieId: show.movieId,
      cinemaId: show.cinemaId,
      screenId: show.screenId,
      seatIds: seats.map((s) => s.seatId).sort(),
      seats: seats.map((s) => ({ seatId: s.seatId, category: s.category, price: s.price })),
      ...totals,
      holdId: lockId,
      holdExpiresAt,
      idempotencyKey,
    });
    return { booking, created: true };
  } catch (err) {
    if (err.code === 11000) {
      // Lost a race with a duplicate request for the same hold / idempotency key: return the winner.
      const existing = await Booking.findOne(idempotencyKey ? { userId, idempotencyKey } : { userId, holdId: lockId });
      if (existing) return { booking: existing, created: false };
    }
    throw err;
  }
}

async function waitForConfirmation(bookingId) {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((r) => setTimeout(r, 300));
    const b = await Booking.findById(bookingId);
    if (b?.status === 'CONFIRMED') return b;
    if (b && b.status !== 'CONFIRMING') break;
  }
  throw new AppError(409, 'Your payment is still being processed. Check your bookings in a moment.');
}

async function tryRefund(payment, booking) {
  const provider = getProvider(payment.provider);
  try {
    const refund = await provider.refund({ paymentId: payment.providerPaymentId, amount: payment.amount });
    payment.status = 'REFUNDED';
    payment.refundId = refund.id;
    await payment.save();
    if (booking) await Booking.updateOne({ _id: booking._id }, { $set: { refundStatus: 'REFUNDED' } });
    return true;
  } catch (err) {
    logger.error(`Refund failed for payment ${payment._id}: ${err.message}`);
    payment.status = 'REFUND_PENDING';
    await payment.save();
    return false;
  }
}

async function failAndRefund(booking, payment, providerPaymentId, reason) {
  await Booking.updateOne(
    { _id: booking._id },
    { $set: { status: 'FAILED', failureReason: reason, refundStatus: 'PENDING' } },
  );
  payment.providerPaymentId = providerPaymentId;
  payment.status = 'REFUND_PENDING';
  await payment.save();
  await tryRefund(payment, booking);
  throw new AppError(409, `${reason}. Your payment is being refunded.`);
}

/** A payment arrived for a booking that can no longer be confirmed: give the money back. */
async function refundOrphanPayment(bookingId, providerPaymentId) {
  if (!providerPaymentId) return;
  const payment = await Payment.findOne({ bookingId, status: { $in: ['CREATED', 'FAILED'] } });
  if (!payment) return;
  payment.providerPaymentId = providerPaymentId;
  payment.status = 'REFUND_PENDING';
  await payment.save();
  await Booking.updateOne({ _id: bookingId }, { $set: { refundStatus: 'PENDING' } });
  await tryRefund(payment, { _id: bookingId });
}

/**
 * Confirms a booking after a verified payment. Safe to call many times and from
 * several places at once (verify endpoint + webhook): the atomic status flip to
 * CONFIRMING means only one caller does the work; the others get the result.
 *
 * Late payments are handled: if the hold expired but nobody else took the seats,
 * the booking still succeeds; if someone else took them, the payment is refunded.
 */
export async function confirmBooking({ bookingId, providerPaymentId }) {
  const claimed = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: ['PENDING_PAYMENT', 'EXPIRED'] } },
    { $set: { status: 'CONFIRMING' }, $unset: { failureReason: '' } },
    { new: true },
  );

  if (!claimed) {
    const current = await Booking.findById(bookingId);
    if (!current) throw new AppError(404, 'Booking not found');
    if (current.status === 'CONFIRMED') return current;
    if (current.status === 'CONFIRMING') return waitForConfirmation(bookingId);
    await refundOrphanPayment(bookingId, providerPaymentId);
    throw new AppError(409, `This booking is ${current.status.toLowerCase()} and can no longer be paid`);
  }

  try {
    const payment = await Payment.findOne({ bookingId });
    if (!payment) {
      await Booking.updateOne({ _id: bookingId }, { $set: { status: 'PENDING_PAYMENT' } });
      throw new AppError(404, 'No payment order exists for this booking');
    }

    const show = await Show.findById(claimed.showId).lean();
    if (!show || show.status !== 'SCHEDULED') {
      return await failAndRefund(claimed, payment, providerPaymentId, 'This show is no longer available');
    }
    if (new Date(show.startTime) <= new Date()) {
      return await failAndRefund(claimed, payment, providerPaymentId, 'This show has already started');
    }

    const now = new Date();
    const claim = await ShowSeat.updateMany(
      {
        showId: claimed.showId,
        seatId: { $in: claimed.seatIds },
        $or: [
          { status: 'HELD', holdId: claimed.holdId },
          { status: 'AVAILABLE' },
          { status: 'HELD', holdExpiresAt: { $lt: now } },
          { status: 'BOOKED', bookingId: claimed._id }, // makes retries safe
        ],
      },
      { $set: { status: 'BOOKED', bookingId: claimed._id }, $unset: { holdId: '', heldBy: '', holdExpiresAt: '' } },
    );

    if (claim.matchedCount !== claimed.seatIds.length) {
      const ours = await ShowSeat.find({ showId: claimed.showId, bookingId: claimed._id }).select('seatId').lean();
      await ShowSeat.updateMany(
        { showId: claimed.showId, bookingId: claimed._id },
        { $set: { status: 'AVAILABLE' }, $unset: { bookingId: '' } },
      );
      emitSeatUpdate(claimed.showId, ours.map((s) => s.seatId), 'AVAILABLE');
      return await failAndRefund(claimed, payment, providerPaymentId, 'The seats were taken before your payment completed');
    }

    const qrCode = await QRCode.toDataURL(`CINEMA|${claimed.bookingCode}`, { margin: 1, width: 320 });
    const confirmed = await Booking.findByIdAndUpdate(
      claimed._id,
      { $set: { status: 'CONFIRMED', confirmedAt: new Date(), qrCode, paymentId: payment._id } },
      { new: true },
    );
    await Payment.updateOne({ _id: payment._id }, { $set: { status: 'PAID', providerPaymentId } });

    emitSeatUpdate(claimed.showId, claimed.seatIds, 'BOOKED');
    enqueue('booking-email', async () => {
      const [dto, user] = await Promise.all([loadBookingDto(confirmed._id), User.findById(confirmed.userId).lean()]);
      if (dto && user) await sendBookingConfirmation(dto, user.email);
    });
    return confirmed;
  } catch (err) {
    // Unexpected failure (not a business rule): make the booking payable again so a retry/webhook can finish it.
    if (!err.isOperational) {
      await Booking.updateOne({ _id: bookingId, status: 'CONFIRMING' }, { $set: { status: 'PENDING_PAYMENT' } });
    }
    throw err;
  }
}

export async function cancelBooking({ bookingId, actor, asAdmin = false }) {
  const booking = await Booking.findById(bookingId);
  if (!booking || (!asAdmin && String(booking.userId) !== String(actor?._id))) {
    throw new AppError(404, 'Booking not found');
  }
  if (booking.status !== 'CONFIRMED') throw new AppError(409, 'Only confirmed bookings can be cancelled');

  const show = await Show.findById(booking.showId).lean();
  if (!asAdmin) {
    const hoursLeft = (new Date(show.startTime).getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < env.cancelCutoffHours) {
      throw new AppError(400, `Bookings can only be cancelled at least ${env.cancelCutoffHours} hours before the show`);
    }
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'CONFIRMED' },
    { $set: { status: 'CANCELLED', cancelledAt: new Date(), refundStatus: 'PENDING' } },
    { new: true },
  );
  if (!updated) throw new AppError(409, 'This booking was already cancelled');

  await ShowSeat.updateMany(
    { showId: booking.showId, bookingId: booking._id },
    { $set: { status: 'AVAILABLE' }, $unset: { bookingId: '' } },
  );
  emitSeatUpdate(booking.showId, booking.seatIds, 'AVAILABLE');

  const payment = await Payment.findOne({ bookingId: booking._id, status: 'PAID' });
  if (payment) await tryRefund(payment, updated);
  return Booking.findById(booking._id);
}

export async function retryRefund(paymentId) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new AppError(404, 'Payment not found');
  if (payment.status !== 'REFUND_PENDING') throw new AppError(409, 'This payment has no pending refund');
  const booking = await Booking.findById(payment.bookingId);
  const ok = await tryRefund(payment, booking);
  if (!ok) throw new AppError(502, 'The payment provider rejected the refund. Try again later.');
  return payment;
}
