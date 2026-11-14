import { User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/tokens.js';

function readToken(req) {
  if (req.cookies?.[ACCESS_COOKIE]) return req.cookies[ACCESS_COOKIE];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function resolveUser(req) {
  const token = readToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.tv) return null;
  return user;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw new AppError(401, 'Please log in to continue');
  req.user = user;
  next();
});

/** Attaches req.user when a valid token is present but never rejects. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = (await resolveUser(req)) || undefined;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'Please log in to continue'));
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to do that'));
  next();
};

export const requireAdmin = [authenticate, authorize('admin')];
