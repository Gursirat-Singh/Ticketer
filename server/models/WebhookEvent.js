import mongoose from 'mongoose';

// The unique eventId is what makes webhook handling idempotent.
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
