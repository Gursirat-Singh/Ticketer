import { Cinema, Screen } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCinemas = asyncHandler(async (req, res) => {
  const filter = req.query.city ? { city: req.query.city } : {};
  const cinemas = await Cinema.find(filter).sort({ city: 1, name: 1 }).lean();
  const cities = await Cinema.distinct('city');
  res.json({ cinemas, cities: cities.sort() });
});

export const getCinema = asyncHandler(async (req, res) => {
  const cinema = await Cinema.findById(req.params.id).lean();
  if (!cinema) throw new AppError(404, 'Cinema not found');
  const screens = await Screen.find({ cinemaId: cinema._id }).select('name totalSeats').lean();
  res.json({ cinema, screens });
});

export const createCinema = asyncHandler(async (req, res) => {
  res.status(201).json({ cinema: await Cinema.create(req.body) });
});

export const updateCinema = asyncHandler(async (req, res) => {
  const cinema = await Cinema.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!cinema) throw new AppError(404, 'Cinema not found');
  res.json({ cinema });
});

export const deleteCinema = asyncHandler(async (req, res) => {
  if (await Screen.exists({ cinemaId: req.params.id })) {
    throw new AppError(409, 'This cinema still has screens. Delete its screens first.');
  }
  const cinema = await Cinema.findByIdAndDelete(req.params.id);
  if (!cinema) throw new AppError(404, 'Cinema not found');
  res.json({ message: 'Cinema deleted' });
});
