import mongoose from 'mongoose';

const bookedSeatSchema = new mongoose.Schema(
  {
    seatId: String,
    category: String,
    price: Number, // paise
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    showId: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    cinemaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cinema', required: true },
    screenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screen', required: true },
    seatIds: { type: [String], required: true },
    seats: { type: [bookedSeatSchema], default: [] },

    // All money values are integers in paise
    subtotal: { type: Number, required: true },
    convenienceFee: { type: Number, required: true },
    tax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ['PENDING_PAYMENT', 'CONFIRMING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING_PAYMENT',
    },
    failureReason: { type: String },
    refundStatus: { type: String, enum: ['NONE', 'PENDING', 'REFUNDED'], default: 'NONE' },

    holdId: { type: String, required: true },
    holdExpiresAt: { type: Date, required: true },
    idempotencyKey: { type: String },

    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    qrCode: { type: String }, // data URL
    confirmedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ showId: 1, status: 1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });
bookingSchema.index({ holdId: 1 }, { unique: true }); // one booking per seat hold
bookingSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export const Booking = mongoose.model('Booking', bookingSchema);
