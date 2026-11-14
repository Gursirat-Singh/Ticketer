import { env } from '../../config/env.js';
import { mockProvider } from './mock.js';
import { razorpayProvider } from './razorpay.js';

export function getProvider(name = env.paymentProvider) {
  return name === 'razorpay' ? razorpayProvider : mockProvider;
}
