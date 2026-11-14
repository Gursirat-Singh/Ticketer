import { Booking, Payment, WebhookEvent } from '../models/index.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { confirmBooking, loadBookingDto } from '../services/booking.service.js';
import { createOrderForBooking, failPayment } from '../services/payment.service.js';
import { getProvider } from '../services/providers/index.js';
import { mockProvider } from '../services/providers/mock.js';

async function ownedBooking(bookingId, userId) {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new AppError(404, 'Booking not found');
  return booking;
}

export const createOrder = asyncHandler(async (req, res) => {
  const booking = await ownedBooking(req.body.bookingId, req.user._id);
  res.status(201).json({ order: await createOrderForBooking({ booking }) });
});

export const verify = asyncHandler(async (req, res) => {
  const { bookingId, orderId, paymentId, signature } = req.body;
  const booking = await ownedBooking(bookingId, req.user._id);
  const payment = await Payment.findOne({ bookingId: booking._id, providerOrderId: orderId });
  if (!payment) throw new AppError(404, 'Payment order not found');

  // Never trust the browser: only a valid provider signature can confirm a booking.
  if (!getProvider(payment.provider).verifySignature({ orderId, paymentId, signature })) {
    throw new AppError(400, 'Payment verification failed');
  }
  await confirmBooking({ bookingId: booking._id, providerPaymentId: paymentId });
  res.json({ booking: await loadBookingDto(booking._id) });
});

export const fail = asyncHandler(async (req, res) => {
  const booking = await ownedBooking(req.body.bookingId, req.user._id);
  await failPayment({ booking });
  res.json({ booking: await loadBookingDto(booking._id) });
});

export const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).lean();
  if (!payment || (req.user.role !== 'admin' && String(payment.userId) !== String(req.user._id))) {
    throw new AppError(404, 'Payment not found');
  }
  res.json({ payment });
});

/** Mock gateway only: plays the part of the payment page and returns what Razorpay's checkout would return. */
export const mockComplete = asyncHandler(async (req, res) => {
  if (env.paymentProvider !== 'mock') throw new AppError(404, 'Not found');
  const payment = await Payment.findOne({
    providerOrderId: req.body.orderId,
    userId: req.user._id,
    provider: 'mock',
    status: 'CREATED',
  });
  if (!payment) throw new AppError(404, 'No open mock payment for this order');
  const paymentId = mockProvider.newPaymentId();
  res.json({
    orderId: payment.providerOrderId,
    paymentId,
    signature: mockProvider.sign({ orderId: payment.providerOrderId, paymentId }),
  });
});

/** Provider -> server webhook. Mounted with express.raw() so the signature is checked against the exact bytes. */
export const webhook = asyncHandler(async (req, res) => {
  const provider = getProvider();
  const event = provider.parseWebhook(req.body, req.headers);
  if (!event) throw new AppError(400, 'Invalid webhook signature');

  try {
    await WebhookEvent.create({ eventId: event.eventId, type: event.type });
  } catch (err) {
    if (err.code === 11000) return res.json({ ok: true, duplicate: true }); // already processed
    throw err;
  }

  try {
    const payment = event.orderId ? await Payment.findOne({ providerOrderId: event.orderId }) : null;
    if (payment && event.type === 'payment.captured') {
      await confirmBooking({ bookingId: payment.bookingId, providerPaymentId: event.paymentId });
    } else if (payment && event.type === 'payment.failed') {
      await Payment.updateOne({ _id: payment._id, status: 'CREATED' }, { $set: { status: 'FAILED' } });
    }
  } catch (err) {
    if (!err.isOperational) {
      // Let the provider retry: forget the event so the retry isn't skipped as a duplicate.
      await WebhookEvent.deleteOne({ eventId: event.eventId });
      throw err;
    }
    logger.warn(`Webhook ${event.eventId} handled with business error: ${err.message}`);
  }
  res.json({ ok: true });
});
