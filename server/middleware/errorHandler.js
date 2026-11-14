import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid ${err.path}` });
  if (err.code === 11000) return res.status(409).json({ message: 'That value already exists', details: err.keyValue });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large' });

  const status = err.status || 500;
  if (status >= 500) logger.error(err);
  res.status(status).json({
    message: status >= 500 && env.isProd ? 'Something went wrong' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
