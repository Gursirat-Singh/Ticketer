import { randomBytes } from 'node:crypto';

// Crockford-style base32 without ambiguous characters (no I, L, O, U, 0, 1)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateBookingCode() {
  const bytes = randomBytes(8);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `CB-${out}`;
}
