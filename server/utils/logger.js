import { env } from '../config/env.js';

const stamp = () => new Date().toISOString();

export const logger = {
  info: (...args) => !env.isTest && console.log(stamp(), '[info]', ...args),
  warn: (...args) => !env.isTest && console.warn(stamp(), '[warn]', ...args),
  error: (...args) => !env.isTest && console.error(stamp(), '[error]', ...args),
};
