import { Booking, Movie, Payment, Show, ShowSeat, User } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BOOKING_POPULATE, retryRefund, toBookingDto } from '../services/booking.service.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const [revenueAgg, totalBookings, totalUsers, totalMovies, upcomingShows] = await Promise.all([
    Booking.aggregate([{ $match: { status: 'CONFIRMED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Booking.countDocuments({ status: 'CONFIRMED' }),
    User.countDocuments({ role: 'customer' }),
    Movie.countDocuments({ status: { $ne: 'archived' } }),
    Show.find({ status: 'SCHEDULED', startTime: { $gt: now } }).select('_id').lean(),
  ]);

  const showIds = upcomingShows.map((s) => s._id);
  const [booked, total] = showIds.length
    ? await Promise.all([
        ShowSeat.countDocuments({ showId: { $in: showIds }, status: 'BOOKED' }),
        ShowSeat.countDocuments({ showId: { $in: showIds } }),
      ])
    : [0, 0];

  res.json({
    totalRevenue: revenueAgg[0]?.total || 0,
    totalBookings,
    totalUsers,
    totalMovies,
    activeShows: showIds.length,
    occupancyPercent: total ? Math.round((booked / total) * 1000) / 10 : 0,
  });
});

export const analytics = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [revenueByDay, popularMovies] = await Promise.all([
    Booking.aggregate([
      { $match: { status: 'CONFIRMED', confirmedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$confirmedAt' } },
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { status: 'CONFIRMED' } },
      { $group: { _id: '$movieId', tickets: { $sum: { $size: '$seatIds' } }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { tickets: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movie' } },
      { $unwind: '$movie' },
      { $project: { _id: 0, movieId: '$_id', title: '$movie.title', tickets: 1, revenue: 1 } },
    ]),
  ]);
  res.json({
    revenueByDay: revenueByDay.map((r) => ({ date: r._id, revenue: r.revenue, bookings: r.bookings })),
    popularMovies,
  });
});

export const listBookings = asyncHandler(async (req, res) => {
  const { status, q, page, limit } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.bookingCode = { $regex: escapeRegex(q.toUpperCase()) };
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .select('-qrCode')
      .populate(BOOKING_POPULATE)
      .populate({ path: 'userId', select: 'name email' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);
  res.json({ bookings: bookings.map((b) => toBookingDto(b, { includeUser: true })), page, limit, total });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  const filter = {};
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Booking.aggregate([
    { $match: { userId: { $in: users.map((u) => u._id) }, status: 'CONFIRMED' } },
    { $group: { _id: '$userId', bookings: { $sum: 1 }, spent: { $sum: '$totalAmount' } } },
  ]);
  const byUser = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  res.json({
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      bookings: byUser[String(u._id)]?.bookings || 0,
      spent: byUser[String(u._id)]?.spent || 0,
    })),
    page,
    limit,
    total,
  });
});

export const listPayments = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = status ? { status } : {};
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate({ path: 'bookingId', select: 'bookingCode' })
      .populate({ path: 'userId', select: 'name email' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  res.json({
    payments: payments.map((p) => ({
      id: String(p._id),
      bookingCode: p.bookingId?.bookingCode,
      user: p.userId ? { name: p.userId.name, email: p.userId.email } : null,
      provider: p.provider,
      providerOrderId: p.providerOrderId,
      providerPaymentId: p.providerPaymentId,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt,
    })),
    page,
    limit,
    total,
  });
});

export const refundPayment = asyncHandler(async (req, res) => {
  const payment = await retryRefund(req.params.id);
  res.json({ payment: { id: String(payment._id), status: payment.status } });
});
