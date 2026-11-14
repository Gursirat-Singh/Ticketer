import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['mock', 'razorpay'], required: true },
    providerOrderId: { type: String, required: true, unique: true },
    providerPaymentId: { type: String },
    amount: { type: Number, required: true }, // paise
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, default: 'online' },
    status: {
      type: String,
      enum: ['CREATED', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUNDED'],
      default: 'CREATED',
    },
    refundId: { type: String },
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
