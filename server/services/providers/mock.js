import { env } from '../../config/env.js';
import { hmacSha256, safeEqual, randomId } from '../../utils/crypto.js';

/**
 * Simulated payment gateway. It follows the exact same contract as Razorpay
 * (order -> payment id + HMAC signature -> server-side verification, plus signed
 * webhooks), so the booking code path is identical in both modes.
 */
export const mockProvider = {
  name: 'mock',
  clientConfig: () => ({ provider: 'mock' }),

  async createOrder({ amount }) {
    return { id: `mock_order_${randomId()}`, amount, currency: 'INR' };
  },

  newPaymentId: () => `mock_pay_${randomId()}`,
  sign: ({ orderId, paymentId }) => hmacSha256(env.mockPaymentSecret, `${orderId}|${paymentId}`),

  verifySignature({ orderId, paymentId, signature }) {
    return Boolean(signature) && safeEqual(mockProvider.sign({ orderId, paymentId }), signature);
  },

  async refund() {
    return { id: `mock_rf_${randomId()}` };
  },

  signWebhook: (rawBody) => hmacSha256(env.mockPaymentSecret, rawBody),

  parseWebhook(rawBody, headers) {
    const signature = headers['x-mock-signature'];
    if (!signature || !safeEqual(mockProvider.signWebhook(rawBody), signature)) return null;
    const body = JSON.parse(rawBody.toString());
    return { eventId: body.id, type: body.event, orderId: body.orderId, paymentId: body.paymentId };
  },
};
