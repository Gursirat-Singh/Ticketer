import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 60000,
    hookTimeout: 120000,
    // Each test file creates its own database, so files can run in parallel.
  },
});
