import { env } from '../config/env.js';

export const formatMoneyPlain = (paise) => `Rs. ${(paise / 100).toFixed(2)}`;

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: env.timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}
