import mongoose from 'mongoose';

// The static seat layout lives inside the screen (no separate Seat collection):
// it never changes per show. Per-show state lives in ShowSeat.
const seatSchema = new mongoose.Schema(
  {
    seatId: { type: String, required: true }, // e.g. "E7"
    row: { type: String, required: true },
    number: { type: Number, required: true },
    category: { type: String, enum: ['REGULAR', 'GOLD', 'PREMIUM'], required: true },
  },
  { _id: false },
);

const screenSchema = new mongoose.Schema(
  {
    cinemaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cinema', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Layout config used to generate seats (kept so the admin can see/edit it)
    numRows: { type: Number, required: true, min: 1, max: 26 },
    seatsPerRow: { type: Number, required: true, min: 1, max: 40 },
    aisleAfter: { type: Number, default: 0, min: 0 },
    goldRows: { type: Number, default: 0, min: 0 },
    premiumRows: { type: Number, default: 0, min: 0 },
    totalSeats: { type: Number, required: true },
    seats: { type: [seatSchema], default: [] },
  },
  { timestamps: true },
);

screenSchema.index({ cinemaId: 1, name: 1 }, { unique: true });

export const Screen = mongoose.model('Screen', screenSchema);
