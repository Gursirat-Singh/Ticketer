import { Server } from 'socket.io';
import mongoose from 'mongoose';

let io = null;

export function initSocket(httpServer, origins) {
  io = new Server(httpServer, { cors: { origin: origins, credentials: true } });

  io.on('connection', (socket) => {
    socket.on('show:join', (showId) => {
      if (mongoose.isValidObjectId(showId)) socket.join(`show:${showId}`);
    });
    socket.on('show:leave', (showId) => {
      if (mongoose.isValidObjectId(showId)) socket.leave(`show:${showId}`);
    });
  });

  return io;
}

/** status: 'AVAILABLE' | 'HELD' | 'BOOKED'. No-op when sockets are not running (e.g. in tests). */
export function emitSeatUpdate(showId, seatIds, status) {
  if (!io || !seatIds || seatIds.length === 0) return;
  io.to(`show:${showId}`).emit('seats:update', { showId: String(showId), seatIds, status });
}

export const getIO = () => io;
