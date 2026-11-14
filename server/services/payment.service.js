import { Booking, Payment } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { getProvider } from './providers/index.js';
import { releaseHold } from './seatHold.service.js';

export async function createOrderForBooking({ booking }) {
  if (booking.status !== 'PENDING_PAYMENT') {
    throw new AppError(409, `This booking is ${booking.status.toLowerCase()} and cannot be paid`);
  }
  if (new Date(booking.holdExpiresAt) <= new Date()) {
    throw new AppError(410, 'Your seat hold has expired. Please select seats again.');
  }

  const provider = getProvider();
  // Reuse the open order so page refreshes and double clicks don't create duplicates.
  let payment = await Payment.findOne({ bookingId: booking._id, status: 'CREATED' });
  if (!payment) {
    const order = await provider.createOrder({ amount: booking.totalAmount, receipt: booking.bookingCode });
    payment = await Payment.create({
      bookingId: booking._id,
      userId: booking.userId,
      provider: provider.name,
      providerOrderId: order.id,
      amount: booking.totalAmount,
      currency: order.currency || 'INR',
    });
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentId: payment._id } });
  }

  return {
    orderId: payment.providerOrderId,
    amount: payment.amount,
    currency: payment.currency,
    bookingId: String(booking._id),
    bookingCode: booking.bookingCode,
    ...provider.clientConfig(),
  };
}

/** The user gave up or the payment failed: free the seats right away. */
export async function failPayment({ booking }) {
  if (booking.status !== 'PENDING_PAYMENT') return booking;
  await Payment.updateMany({ bookingId: booking._id, status: 'CREATED' }, { $set: { status: 'FAILED' } });
  await releaseHold({ holdId: booking.holdId, userId: booking.userId });
  return Booking.findById(booking._id);
}
