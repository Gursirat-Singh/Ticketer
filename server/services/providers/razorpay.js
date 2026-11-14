import Razorpay from 'razorpay';
import { env } from '../../config/env.js';
import { hmacSha256, safeEqual } from '../../utils/crypto.js';

let client;
const getClient = () => {
  client ??= new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
  return client;
};

export const razorpayProvider = {
  name: 'razorpay',
  clientConfig: () => ({ provider: 'razorpay', keyId: env.razorpayKeyId }),

  async createOrder({ amount, receipt }) {
    const order = await getClient().orders.create({ amount, currency: 'INR', receipt });
    return { id: order.id, amount: order.amount, currency: order.currency };
  },

  // https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#16-verify-payment-signature
  verifySignature({ orderId, paymentId, signature }) {
    if (!signature) return false;
    return safeEqual(hmacSha256(env.razorpayKeySecret, `${orderId}|${paymentId}`), signature);
  },

  async refund({ paymentId, amount }) {
    const refund = await getClient().payments.refund(paymentId, { amount });
    return { id: refund.id };
  },

  parseWebhook(rawBody, headers) {
    const signature = headers['x-razorpay-signature'];
    if (!env.razorpayWebhookSecret || !signature) return null;
    if (!safeEqual(hmacSha256(env.razorpayWebhookSecret, rawBody), signature)) return null;

    const body = JSON.parse(rawBody.toString());
    const payment = body.payload?.payment?.entity;
    const eventId = headers['x-razorpay-event-id'] || `${body.event}:${payment?.id}`;
    let type = body.event;
    if (body.event === 'payment.captured' || body.event === 'order.paid') type = 'payment.captured';
    return {
      eventId,
      type,
      orderId: payment?.order_id || body.payload?.order?.entity?.id,
      paymentId: payment?.id,
    };
  },
};
