import mongoose from 'mongoose';

const priceByCategory = new mongoose.Schema(
  {
    REGULAR: { type: Number, required: true, min: 0 }, // paise
    GOLD: { type: Number, required: true, min: 0 },
    PREMIUM: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const showSchema = new mongoose.Schema(
  {
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    cinemaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cinema', required: true },
    screenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screen', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    priceByCategory: { type: priceByCategory, required: true },
    status: { type: String, enum: ['SCHEDULED', 'CANCELLED'], default: 'SCHEDULED' },
  },
  { timestamps: true },
);

showSchema.index({ movieId: 1, cinemaId: 1, startTime: 1 });
showSchema.index({ screenId: 1, startTime: 1 });
showSchema.index({ cinemaId: 1, startTime: 1 });
showSchema.index({ startTime: 1, status: 1 });

export const Show = mongoose.model('Show', showSchema);
