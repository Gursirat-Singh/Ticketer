import 'dotenv/config';

const num = (value, fallback) => (value === undefined || value === '' ? fallback : Number(value));
const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const DEV_ACCESS = 'dev-access-secret-do-not-use-in-production';
const DEV_REFRESH = 'dev-refresh-secret-do-not-use-in-production';

export const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: num(process.env.PORT, 5000),
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cinema_booking',

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || DEV_ACCESS,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || DEV_REFRESH,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: num(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  bcryptRounds: nodeEnv === 'test' ? 4 : 10,

  holdSeconds: num(process.env.SEAT_HOLD_SECONDS, 300),
  maxSeatsPerBooking: num(process.env.MAX_SEATS_PER_BOOKING, 10),
  convenienceFeePerTicket: num(process.env.CONVENIENCE_FEE_PER_TICKET, 2000),
  taxPercent: num(process.env.TAX_PERCENT, 18),
  cancelCutoffHours: num(process.env.CANCEL_CUTOFF_HOURS, 2),

  paymentProvider: (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase(),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  mockPaymentSecret: process.env.MOCK_PAYMENT_SECRET || 'mock-payment-secret',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Cinema Booking <no-reply@cinema.local>',
  },
};

if (isProd) {
  if (env.jwtAccessSecret === DEV_ACCESS || env.jwtRefreshSecret === DEV_REFRESH) {
    throw new Error('Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET before running in production.');
  }
  if (env.paymentProvider === 'mock') {
    console.warn('[warn] PAYMENT_PROVIDER=mock in production: payments are simulated.');
  }
}
if (env.paymentProvider === 'razorpay' && (!env.razorpayKeyId || !env.razorpayKeySecret)) {
  throw new Error('PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
}
