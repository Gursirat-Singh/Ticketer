import mongoose from 'mongoose';

const cinemaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, index: true },
    location: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

export const Cinema = mongoose.model('Cinema', cinemaSchema);
