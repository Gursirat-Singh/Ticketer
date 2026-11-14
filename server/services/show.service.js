import { Booking, Movie, Screen, Show, ShowSeat } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { cancelBooking } from './booking.service.js';

const CLEANING_BUFFER_MIN = 15;

export async function createShow({ movieId, screenId, startTime, priceByCategory }) {
  const [movie, screen] = await Promise.all([Movie.findById(movieId).lean(), Screen.findById(screenId).lean()]);
  if (!movie) throw new AppError(404, 'Movie not found');
  if (!screen) throw new AppError(404, 'Screen not found');
  if (movie.status === 'archived') throw new AppError(409, 'Archived movies cannot be scheduled');

  const start = new Date(startTime);
  const end = new Date(start.getTime() + (movie.durationMin + CLEANING_BUFFER_MIN) * 60_000);

  const clash = await Show.findOne({
    screenId,
    status: 'SCHEDULED',
    startTime: { $lt: end },
    endTime: { $gt: start },
  }).lean();
  if (clash) throw new AppError(409, 'Another show is already scheduled on this screen at that time');

  const show = await Show.create({
    movieId,
    cinemaId: screen.cinemaId,
    screenId,
    startTime: start,
    endTime: end,
    priceByCategory,
  });

  try {
    await ShowSeat.insertMany(
      screen.seats.map((seat) => ({
        showId: show._id,
        seatId: seat.seatId,
        row: seat.row,
        number: seat.number,
        category: seat.category,
        price: priceByCategory[seat.category],
      })),
      { ordered: false },
    );
  } catch (err) {
    await Promise.all([Show.deleteOne({ _id: show._id }), ShowSeat.deleteMany({ showId: show._id })]);
    throw err;
  }
  return show;
}

export async function updateShow(show, { priceByCategory, status }) {
  if (priceByCategory) {
    show.priceByCategory = priceByCategory;
    // New prices apply to seats nobody has bought yet; existing bookings keep their price.
    for (const category of ['REGULAR', 'GOLD', 'PREMIUM']) {
      await ShowSeat.updateMany(
        { showId: show._id, category, status: { $ne: 'BOOKED' } },
        { $set: { price: priceByCategory[category] } },
      );
    }
  }
  if (status && status !== show.status) {
    show.status = status;
    if (status === 'CANCELLED') {
      // Cancel and refund everything that was already confirmed for this show.
      const confirmed = await Booking.find({ showId: show._id, status: 'CONFIRMED' }).select('_id').lean();
      for (const b of confirmed) {
        await cancelBooking({ bookingId: b._id, actor: null, asAdmin: true });
      }
      await Booking.updateMany(
        { showId: show._id, status: { $in: ['PENDING_PAYMENT', 'EXPIRED'] } },
        { $set: { status: 'FAILED', failureReason: 'Show cancelled' } },
      );
    }
  }
  await show.save();
  return show;
}

export async function deleteShow(show) {
  const blocking = await Booking.countDocuments({
    showId: show._id,
    status: { $in: ['CONFIRMED', 'PENDING_PAYMENT', 'CONFIRMING'] },
  });
  if (blocking > 0) {
    throw new AppError(409, 'This show has bookings. Set its status to CANCELLED to refund them instead of deleting.');
  }
  await Promise.all([ShowSeat.deleteMany({ showId: show._id }), show.deleteOne()]);
}

/** { [showId]: { total, available } } */
export async function getSeatCounts(showIds) {
  if (showIds.length === 0) return {};
  const now = new Date();
  const rows = await ShowSeat.aggregate([
    { $match: { showId: { $in: showIds } } },
    {
      $group: {
        _id: '$showId',
        total: { $sum: 1 },
        available: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$status', 'AVAILABLE'] },
                  { $and: [{ $eq: ['$status', 'HELD'] }, { $lt: ['$holdExpiresAt', now] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), { total: r.total, available: r.available }]));
}
