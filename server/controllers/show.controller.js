import { Cinema, Show } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createShow, deleteShow, getSeatCounts, updateShow } from '../services/show.service.js';
import { getSeatMap } from '../services/seatHold.service.js';

const POPULATE = [
  { path: 'movieId', select: 'title poster banner language durationMin certification rating genres' },
  { path: 'cinemaId', select: 'name city address' },
  { path: 'screenId', select: 'name numRows seatsPerRow aisleAfter totalSeats' },
];

const toDto = (show, counts) => {
  const o = show.toObject ? show.toObject() : show;
  const c = counts?.[String(o._id)];
  return {
    id: String(o._id),
    movie: { id: String(o.movieId._id), ...o.movieId, _id: undefined },
    cinema: { id: String(o.cinemaId._id), ...o.cinemaId, _id: undefined },
    screen: { id: String(o.screenId._id), ...o.screenId, _id: undefined },
    startTime: o.startTime,
    endTime: o.endTime,
    priceByCategory: o.priceByCategory,
    status: o.status,
    ...(c ? { totalSeats: c.total, availableSeats: c.available } : {}),
  };
};

export const listShows = asyncHandler(async (req, res) => {
  const { movieId, cinemaId, city, from, to, all, page, limit } = req.query;
  const isAdmin = req.user?.role === 'admin';
  const filter = {};
  if (movieId) filter.movieId = movieId;
  if (cinemaId) filter.cinemaId = cinemaId;
  if (city) {
    const ids = (await Cinema.find({ city }).distinct('_id')).map(String);
    filter.cinemaId = cinemaId ? (ids.includes(cinemaId) ? cinemaId : { $in: [] }) : { $in: ids };
  }

  const showAll = isAdmin && all === 'true'; // admins can list past and cancelled shows
  const now = new Date();
  const lower = showAll ? from : from && from > now ? from : now; // customers only see upcoming shows
  const range = {};
  if (lower) range.$gte = lower;
  if (to) range.$lt = to;
  if (Object.keys(range).length) filter.startTime = range;
  if (!showAll) filter.status = 'SCHEDULED';

  const [shows, total] = await Promise.all([
    Show.find(filter).sort({ startTime: 1 }).skip((page - 1) * limit).limit(limit).populate(POPULATE),
    Show.countDocuments(filter),
  ]);
  const counts = await getSeatCounts(shows.map((s) => s._id));
  res.json({ shows: shows.map((s) => toDto(s, counts)), page, limit, total });
});

export const getShow = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id).populate(POPULATE);
  if (!show) throw new AppError(404, 'Show not found');
  const counts = await getSeatCounts([show._id]);
  res.json({ show: toDto(show, counts) });
});

export const createShowHandler = asyncHandler(async (req, res) => {
  const show = await createShow(req.body);
  const populated = await Show.findById(show._id).populate(POPULATE);
  res.status(201).json({ show: toDto(populated) });
});

export const updateShowHandler = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id);
  if (!show) throw new AppError(404, 'Show not found');
  await updateShow(show, req.body);
  const populated = await Show.findById(show._id).populate(POPULATE);
  res.json({ show: toDto(populated) });
});

export const deleteShowHandler = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id);
  if (!show) throw new AppError(404, 'Show not found');
  await deleteShow(show);
  res.json({ message: 'Show deleted' });
});

export const showSeats = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id).lean();
  if (!show) throw new AppError(404, 'Show not found');
  const seats = await getSeatMap(show._id, req.user?._id);
  res.json({ showId: String(show._id), status: show.status, seats });
});
