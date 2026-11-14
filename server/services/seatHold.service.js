import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { Booking, Show, ShowSeat } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { emitSeatUpdate } from '../sockets/index.js';

const RELEASE = {
  $set: { status: 'AVAILABLE' },
  $unset: { holdId: '', heldBy: '', holdExpiresAt: '' },
};

function groupByShow(seats) {
  const map = new Map();
  for (const s of seats) {
    const key = String(s.showId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s.seatId);
  }
  return map;
}

/**
 * Hold seats for HOLD_SECONDS. This is the concurrency-critical operation.
 *
 * A single updateMany with a conditional filter is atomic per document in MongoDB:
 * of N concurrent requests for the same seat, exactly one matches
 * (status AVAILABLE, or HELD but already expired) and flips it to HELD.
 * Multi-seat requests are all-or-nothing: if fewer seats matched than requested,
 * the ones we did get are released again (identified by our unique holdId).
 */
export async function holdSeats({ userId, showId, seatIds }) {
  const show = await Show.findById(showId).lean();
  if (!show || show.status !== 'SCHEDULED') throw new AppError(404, 'This show is not available');
  if (new Date(show.startTime) <= new Date()) throw new AppError(409, 'This show has already started');

  // A user only keeps one active hold per show: changing seats releases the old ones.
  await releaseUserHoldsForShow(userId, showId);

  const now = new Date();
  const holdId = randomUUID();
  const holdExpiresAt = new Date(now.getTime() + env.holdSeconds * 1000);

  await ShowSeat.updateMany(
    {
      showId,
      seatId: { $in: seatIds },
      $or: [{ status: 'AVAILABLE' }, { status: 'HELD', holdExpiresAt: { $lt: now } }],
    },
    { $set: { status: 'HELD', holdId, heldBy: userId, holdExpiresAt } },
  );

  const mine = await ShowSeat.find({ showId, holdId }).select('seatId').lean();
  if (mine.length !== seatIds.length) {
    const got = new Set(mine.map((s) => s.seatId));
    const unavailable = seatIds.filter((id) => !got.has(id));
    await ShowSeat.updateMany({ showId, holdId }, RELEASE);
    throw new AppError(409, 'Some of the selected seats were just taken. Please pick different seats.', {
      unavailable,
    });
  }

  emitSeatUpdate(showId, seatIds, 'HELD');
  return { lockId: holdId, showId: String(showId), seatIds, expiresAt: holdExpiresAt };
}

/** Release every seat of one hold (only the user who owns it). Also fails the pending booking, if any. */
export async function releaseHold({ holdId, userId }) {
  const seats = await ShowSeat.find({ holdId, heldBy: userId, status: 'HELD' }).select('showId seatId').lean();
  if (seats.length > 0) {
    await ShowSeat.updateMany({ holdId, heldBy: userId, status: 'HELD' }, RELEASE);
    for (const [showId, ids] of groupByShow(seats)) emitSeatUpdate(showId, ids, 'AVAILABLE');
  }
  await Booking.updateMany(
    { holdId, userId, status: 'PENDING_PAYMENT' },
    { $set: { status: 'FAILED', failureReason: 'Seat hold released' } },
  );
  return seats.length;
}

export async function releaseUserHoldsForShow(userId, showId) {
  const seats = await ShowSeat.find({ showId, heldBy: userId, status: 'HELD' }).select('seatId holdId').lean();
  if (seats.length === 0) return;
  const holdIds = [...new Set(seats.map((s) => s.holdId))];
  await ShowSeat.updateMany({ showId, heldBy: userId, status: 'HELD' }, RELEASE);
  await Booking.updateMany(
    { userId, holdId: { $in: holdIds }, status: 'PENDING_PAYMENT' },
    { $set: { status: 'FAILED', failureReason: 'Seat selection changed' } },
  );
  emitSeatUpdate(showId, seats.map((s) => s.seatId), 'AVAILABLE');
}

/** Seat map for the UI. Expired holds are shown as available even before the sweeper runs. */
export async function getSeatMap(showId, userId) {
  const now = new Date();
  const seats = await ShowSeat.find({ showId })
    .select('seatId row number category price status holdExpiresAt heldBy')
    .sort({ row: 1, number: 1 })
    .lean();

  return seats.map((s) => {
    const expired = s.status === 'HELD' && s.holdExpiresAt && s.holdExpiresAt < now;
    const status = expired ? 'AVAILABLE' : s.status;
    return {
      seatId: s.seatId,
      row: s.row,
      number: s.number,
      category: s.category,
      price: s.price,
      status,
      mine: status === 'HELD' && userId ? String(s.heldBy) === String(userId) : false,
    };
  });
}

/** Cleans up expired holds and pending bookings, and tells connected clients about freed seats. */
export async function sweepExpiredHolds() {
  const now = new Date();
  const expired = await ShowSeat.find({ status: 'HELD', holdExpiresAt: { $lt: now } })
    .select('showId seatId')
    .limit(2000)
    .lean();

  if (expired.length > 0) {
    await ShowSeat.updateMany(
      { _id: { $in: expired.map((s) => s._id) }, status: 'HELD', holdExpiresAt: { $lt: now } },
      RELEASE,
    );
    for (const [showId, ids] of groupByShow(expired)) emitSeatUpdate(showId, ids, 'AVAILABLE');
  }

  await Booking.updateMany(
    { status: 'PENDING_PAYMENT', holdExpiresAt: { $lt: now } },
    { $set: { status: 'EXPIRED', failureReason: 'Seat hold expired' } },
  );
  return expired.length;
}

export function startSweeper(intervalMs = 10_000) {
  const timer = setInterval(() => {
    sweepExpiredHolds().catch((err) => logger.error('Hold sweeper failed:', err.message));
  }, intervalMs);
  timer.unref?.();
  return timer;
}
