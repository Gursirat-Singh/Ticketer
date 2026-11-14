import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0, role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0 }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });
}

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtAccessSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, env.jwtRefreshSecret);

const baseCookie = { httpOnly: true, sameSite: 'lax', secure: env.isProd };

export function setAuthCookies(res, user) {
  res.cookie(ACCESS_COOKIE, signAccessToken(user), { ...baseCookie, path: '/', maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), {
    ...baseCookie,
    path: '/api/auth',
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: '/api/auth' });
}
