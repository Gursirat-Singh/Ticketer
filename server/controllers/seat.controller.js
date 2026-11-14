import { asyncHandler } from '../utils/asyncHandler.js';
import { holdSeats, releaseHold } from '../services/seatHold.service.js';

export const createSeatLock = asyncHandler(async (req, res) => {
  const lock = await holdSeats({ userId: req.user._id, showId: req.body.showId, seatIds: req.body.seatIds });
  res.status(201).json({ lock });
});

export const deleteSeatLock = asyncHandler(async (req, res) => {
  const released = await releaseHold({ holdId: req.params.lockId, userId: req.user._id });
  res.json({ released });
});
