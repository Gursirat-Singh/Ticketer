import { Booking } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  BOOKING_POPULATE,
  cancelBooking,
  createBooking,
  loadBookingDto,
  toBookingDto,
} from '../services/booking.service.js';
import { renderTicketPdf } from '../services/ticket.service.js';

export const create = asyncHandler(async (req, res) => {
  const { booking, created } = await createBooking({
    userId: req.user._id,
    lockId: req.body.lockId,
    idempotencyKey: req.body.idempotencyKey,
  });
  res.status(created ? 201 : 200).json({ booking: await loadBookingDto(booking._id) });
});

export const myBookings = asyncHandler(async (req, res) => {
  const { bucket } = req.query;
  const now = new Date();
  const filter = { userId: req.user._id, status: { $in: ['CONFIRMED', 'CANCELLED'] } };
  if (bucket === 'cancelled') filter.status = 'CANCELLED';
  else if (bucket) filter.status = 'CONFIRMED';

  let bookings = await Booking.find(filter).select('-qrCode').populate(BOOKING_POPULATE).sort({ createdAt: -1 }).limit(200);
  if (bucket === 'upcoming') bookings = bookings.filter((b) => b.showId && b.showId.startTime > now);
  if (bucket === 'past') bookings = bookings.filter((b) => b.showId && b.showId.startTime <= now);
  res.json({ bookings: bookings.map((b) => toBookingDto(b)) });
});

async function findOwned(req) {
  const isAdmin = req.user.role === 'admin';
  const dto = await loadBookingDto(req.params.id, { includeUser: isAdmin });
  if (!dto) throw new AppError(404, 'Booking not found');
  // Ownership check: customers only ever see their own bookings. 404 (not 403) so ids can't be probed.
  const owner = await Booking.exists({ _id: req.params.id, userId: req.user._id });
  if (!owner && !isAdmin) throw new AppError(404, 'Booking not found');
  return dto;
}

export const getOne = asyncHandler(async (req, res) => {
  res.json({ booking: await findOwned(req) });
});

export const cancel = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  await cancelBooking({ bookingId: req.params.id, actor: req.user, asAdmin: isAdmin });
  res.json({ booking: await loadBookingDto(req.params.id) });
});

export const ticketPdf = asyncHandler(async (req, res) => {
  const dto = await findOwned(req);
  if (dto.status !== 'CONFIRMED') throw new AppError(409, 'Tickets are only available for confirmed bookings');
  const pdf = await renderTicketPdf(dto);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ticket-${dto.bookingCode}.pdf"`);
  res.send(pdf);
});
