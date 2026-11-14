import mongoose from 'mongoose';

/**
 * One document per seat per show. This is the single source of truth for seat
 * availability. It also doubles as the "seat lock": a hold is just
 * status=HELD + holdId + holdExpiresAt on the seat, changed with an atomic
 * conditional update. The unique (showId, seatId) index guarantees that a seat
 * can never exist twice for the same show.
 */
const showSeatSchema = new mongoose.Schema(
  {
    showId: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    seatId: { type: String, required: true },
    row: { type: String, required: true },
    number: { type: Number, required: true },
    category: { type: String, enum: ['REGULAR', 'GOLD', 'PREMIUM'], required: true },
    price: { type: Number, required: true }, // paise, snapshot of the show's price
    status: { type: String, enum: ['AVAILABLE', 'HELD', 'BOOKED'], default: 'AVAILABLE' },
    holdId: { type: String },
    heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    holdExpiresAt: { type: Date },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: true },
);

showSeatSchema.index({ showId: 1, seatId: 1 }, { unique: true });
showSeatSchema.index({ showId: 1, status: 1 });
showSeatSchema.index({ status: 1, holdExpiresAt: 1 });
showSeatSchema.index({ holdId: 1 });
showSeatSchema.index({ bookingId: 1 });
showSeatSchema.index({ heldBy: 1, showId: 1 });

export const ShowSeat = mongoose.model('ShowSeat', showSeatSchema);
