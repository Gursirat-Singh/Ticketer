import { z } from 'zod';
import { env } from '../config/env.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password needs at least one letter')
  .regex(/\d/, 'Password needs at least one number');

const phone = z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password,
  phone: phone.optional().or(z.literal('')),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional().or(z.literal('')),
});
export const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
});

const url = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must be an http(s) URL');

export const movieSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  genres: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  language: z.string().trim().min(1).max(40),
  durationMin: z.coerce.number().int().min(1).max(600),
  poster: url.optional(),
  banner: url.optional(),
  trailerUrl: url.optional(),
  cast: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  crew: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  rating: z.coerce.number().min(0).max(10).optional(),
  releaseDate: z.coerce.date(),
  certification: z.enum(['U', 'UA', 'A', 'S']).optional(),
  status: z.enum(['upcoming', 'now_showing', 'archived']).optional(),
  featured: z.boolean().optional(),
});
export const movieUpdateSchema = movieSchema.partial();

export const movieListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(40).optional(),
  language: z.string().trim().max(40).optional(),
  status: z.enum(['upcoming', 'now_showing', 'archived', 'all']).optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['rating', 'newest', 'title']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const cinemaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
  location: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
});
export const cinemaUpdateSchema = cinemaSchema.partial();
export const cinemaListQuery = z.object({ city: z.string().trim().max(80).optional() });

export const screenSchema = z.object({
  cinemaId: objectId,
  name: z.string().trim().min(1).max(60),
  numRows: z.coerce.number().int().min(1).max(26),
  seatsPerRow: z.coerce.number().int().min(1).max(40),
  aisleAfter: z.coerce.number().int().min(0).max(40).optional(),
  goldRows: z.coerce.number().int().min(0).max(26).optional(),
  premiumRows: z.coerce.number().int().min(0).max(26).optional(),
});
export const screenUpdateSchema = screenSchema.partial();
export const screenListQuery = z.object({ cinemaId: objectId.optional() });

const paise = z.coerce.number().int().min(0).max(10_000_000);
export const priceSchema = z.object({ REGULAR: paise, GOLD: paise, PREMIUM: paise });

export const showCreateSchema = z.object({
  movieId: objectId,
  screenId: objectId,
  startTime: z.coerce.date(),
  priceByCategory: priceSchema,
});
export const showUpdateSchema = z.object({
  priceByCategory: priceSchema.optional(),
  status: z.enum(['SCHEDULED', 'CANCELLED']).optional(),
});
export const showListQuery = z.object({
  movieId: objectId.optional(),
  cinemaId: objectId.optional(),
  city: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  all: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const seatLockSchema = z.object({
  showId: objectId,
  seatIds: z
    .array(z.string().regex(/^[A-Z]\d{1,2}$/, 'Invalid seat id'))
    .min(1, 'Select at least one seat')
    .max(env.maxSeatsPerBooking, `You can book at most ${env.maxSeatsPerBooking} seats at a time`)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate seats in selection'),
});
export const lockParams = z.object({ lockId: z.string().uuid() });

export const bookingCreateSchema = z.object({
  lockId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});
export const myBookingsQuery = z.object({
  bucket: z.enum(['upcoming', 'past', 'cancelled']).optional(),
});

export const createOrderSchema = z.object({ bookingId: objectId });
export const verifyPaymentSchema = z.object({
  bookingId: objectId,
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(256),
});
export const failPaymentSchema = z.object({ bookingId: objectId });
export const mockCompleteSchema = z.object({ orderId: z.string().min(1).max(100) });

export const adminListQuery = z.object({
  status: z.string().trim().max(30).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
