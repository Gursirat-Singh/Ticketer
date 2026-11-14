import { Movie, Show } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listMovies = asyncHandler(async (req, res) => {
  const { q, genre, language, status, minRating, featured, sort, page, limit } = req.query;
  const filter = {};
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
  if (genre) filter.genres = { $regex: `^${escapeRegex(genre)}$`, $options: 'i' };
  if (language) filter.language = { $regex: `^${escapeRegex(language)}$`, $options: 'i' };
  if (status === 'all') { /* admin view: everything, including archived */ }
  else if (status) filter.status = status;
  else filter.status = { $ne: 'archived' };
  if (minRating !== undefined) filter.rating = { $gte: minRating };
  if (featured) filter.featured = featured === 'true';

  const sortBy = { rating: { rating: -1, releaseDate: -1 }, title: { title: 1 }, newest: { releaseDate: -1 } }[sort];
  const [movies, total] = await Promise.all([
    Movie.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit).lean(),
    Movie.countDocuments(filter),
  ]);
  res.json({ movies, page, limit, total, pages: Math.ceil(total / limit) });
});

export const getMovie = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.id).lean();
  if (!movie) throw new AppError(404, 'Movie not found');
  res.json({ movie });
});

export const createMovie = asyncHandler(async (req, res) => {
  const movie = await Movie.create(req.body);
  res.status(201).json({ movie });
});

export const updateMovie = asyncHandler(async (req, res) => {
  const movie = await Movie.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!movie) throw new AppError(404, 'Movie not found');
  res.json({ movie });
});

export const deleteMovie = asyncHandler(async (req, res) => {
  if (await Show.exists({ movieId: req.params.id })) {
    throw new AppError(409, 'This movie has shows. Delete or cancel its shows first, or archive the movie instead.');
  }
  const movie = await Movie.findByIdAndDelete(req.params.id);
  if (!movie) throw new AppError(404, 'Movie not found');
  res.json({ message: 'Movie deleted' });
});
