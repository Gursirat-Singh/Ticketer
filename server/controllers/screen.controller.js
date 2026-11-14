import { Cinema, Screen, Show } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildSeatLayout } from '../services/seatLayout.service.js';

const LAYOUT_KEYS = ['numRows', 'seatsPerRow', 'goldRows', 'premiumRows'];

export const listScreens = asyncHandler(async (req, res) => {
  const filter = req.query.cinemaId ? { cinemaId: req.query.cinemaId } : {};
  const screens = await Screen.find(filter).select('-seats').populate('cinemaId', 'name city').sort({ name: 1 }).lean();
  res.json({ screens });
});

export const getScreen = asyncHandler(async (req, res) => {
  const screen = await Screen.findById(req.params.id).populate('cinemaId', 'name city').lean();
  if (!screen) throw new AppError(404, 'Screen not found');
  res.json({ screen });
});

export const createScreen = asyncHandler(async (req, res) => {
  if (!(await Cinema.exists({ _id: req.body.cinemaId }))) throw new AppError(404, 'Cinema not found');
  const seats = buildSeatLayout(req.body);
  const screen = await Screen.create({ ...req.body, seats, totalSeats: seats.length });
  res.status(201).json({ screen: { ...screen.toObject(), seats: undefined } });
});

export const updateScreen = asyncHandler(async (req, res) => {
  const screen = await Screen.findById(req.params.id);
  if (!screen) throw new AppError(404, 'Screen not found');

  const layoutChanged = LAYOUT_KEYS.some((k) => req.body[k] !== undefined && req.body[k] !== screen[k]);
  if (layoutChanged && (await Show.exists({ screenId: screen._id }))) {
    throw new AppError(409, 'Seat layout cannot change while this screen has shows. Delete the shows first.');
  }

  Object.assign(screen, req.body);
  if (layoutChanged) {
    screen.seats = buildSeatLayout(screen);
    screen.totalSeats = screen.seats.length;
  }
  await screen.save();
  res.json({ screen: { ...screen.toObject(), seats: undefined } });
});

export const deleteScreen = asyncHandler(async (req, res) => {
  if (await Show.exists({ screenId: req.params.id })) {
    throw new AppError(409, 'This screen has shows. Delete them first.');
  }
  const screen = await Screen.findByIdAndDelete(req.params.id);
  if (!screen) throw new AppError(404, 'Screen not found');
  res.json({ message: 'Screen deleted' });
});
