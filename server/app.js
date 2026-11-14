import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env.js';
import routes from './routes/index.js';
import * as payment from './controllers/payment.controller.js';
import { apiLimiter, originGuard } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.clientUrls, credentials: true }));

  // Webhooks need the raw bytes to verify the signature, so this goes BEFORE express.json().
  app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), payment.webhook);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $ and . keys from body/query/params (NoSQL injection)
  app.use('/api', apiLimiter);
  app.use('/api', originGuard);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
