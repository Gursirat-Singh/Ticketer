import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { message },
  });

export const apiLimiter = make(15 * 60 * 1000, 600, 'Too many requests. Please slow down.');
export const authLimiter = make(15 * 60 * 1000, env.isProd ? 30 : 300, 'Too many login attempts. Try again in a few minutes.');
export const holdLimiter = make(60 * 1000, 30, 'Too many seat selections. Please wait a moment.');
export const paymentLimiter = make(60 * 1000, 30, 'Too many payment requests. Please wait a moment.');

/**
 * CSRF defence for cookie auth, on top of SameSite=Lax: browsers always send an
 * Origin header on cross-site state-changing requests, so reject unknown origins.
 */
export function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !env.clientUrls.includes(origin)) {
    return res.status(403).json({ message: 'Request origin not allowed' });
  }
  next();
}
