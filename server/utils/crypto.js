import crypto from 'node:crypto';

export const hmacSha256 = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export const randomId = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');
