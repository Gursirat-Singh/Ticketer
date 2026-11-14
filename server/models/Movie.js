import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 4000 },
    genres: { type: [String], default: [] },
    language: { type: String, required: true, trim: true },
    durationMin: { type: Number, required: true, min: 1, max: 600 },
    poster: { type: String, default: '' },
    banner: { type: String, default: '' },
    trailerUrl: { type: String, default: '' },
    cast: { type: [String], default: [] },
    crew: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 10, default: 0 },
    releaseDate: { type: Date, required: true },
    certification: { type: String, enum: ['U', 'UA', 'A', 'S'], default: 'UA' },
    status: { type: String, enum: ['upcoming', 'now_showing', 'archived'], default: 'now_showing' },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

movieSchema.index({ title: 1 });
movieSchema.index({ status: 1, releaseDate: -1 });
movieSchema.index({ status: 1, rating: -1 });

export const Movie = mongoose.model('Movie', movieSchema);
