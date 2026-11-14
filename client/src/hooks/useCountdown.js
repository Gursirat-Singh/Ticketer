import { useEffect, useState } from 'react';

/** Seconds left until `expiresAt` (ISO string or Date). Ticks once a second. */
export function useCountdown(expiresAt) {
  const calc = () => (expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!expiresAt) return undefined;
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
