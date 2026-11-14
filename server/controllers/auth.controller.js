import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies, verifyRefreshToken } from '../utils/tokens.js';

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.bcryptRounds);

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (await User.exists({ email })) throw new AppError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  // role is never taken from the request: new accounts are always customers
  const user = await User.create({ name, email, passwordHash, phone: phone || '', role: 'customer' });
  setAuthCookies(res, user);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Incorrect email or password');
  setAuthCookies(res, user);
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  // Bumping tokenVersion revokes every access/refresh token issued so far.
  if (req.user) await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
});

export const me = (req, res) => res.json({ user: req.user });

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new AppError(401, 'Session expired. Please log in again.');
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, 'Session expired. Please log in again.');
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.tv) throw new AppError(401, 'Session expired. Please log in again.');
  setAuthCookies(res, user);
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  res.json({ user: req.user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  user.tokenVersion += 1; // log out every other device
  await user.save();
  setAuthCookies(res, user);
  res.json({ message: 'Password updated' });
});
