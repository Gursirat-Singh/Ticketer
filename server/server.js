import http from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './sockets/index.js';
import { startSweeper } from './services/seatHold.service.js';
import { logger } from './utils/logger.js';
import './models/index.js';

async function main() {
  await connectDB();
  await mongoose.syncIndexes(); // make sure the unique indexes that guard against double booking exist
  logger.info(`MongoDB connected (${mongoose.connection.name})`);

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server, env.clientUrls);
  const sweeper = startSweeper();

  server.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port} (payments: ${env.paymentProvider})`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(sweeper);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
