import { logger } from '../utils/logger.js';

/**
 * Tiny in-process job runner with exponential backoff.
 * Good enough for a single server. To scale, swap this for BullMQ (Redis) or SQS
 * and keep the same enqueue() call sites.
 */
export function enqueue(name, fn, { retries = 3, baseDelayMs = 2000 } = {}) {
  const attempt = async (n) => {
    try {
      await fn();
    } catch (err) {
      if (n < retries) {
        const delay = baseDelayMs * 2 ** n;
        logger.warn(`[job:${name}] attempt ${n + 1} failed (${err.message}); retrying in ${delay}ms`);
        setTimeout(() => attempt(n + 1), delay).unref?.();
      } else {
        logger.error(`[job:${name}] failed permanently: ${err.message}`);
      }
    }
  };
  setImmediate(() => attempt(0));
}
