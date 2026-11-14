import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    // Bumped on logout / password change: every token issued earlier stops working.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
