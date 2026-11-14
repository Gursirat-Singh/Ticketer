import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks only to :5173; Vite forwards API and socket traffic to the
// Express server. That keeps cookies same-origin, so no CORS or SameSite headaches locally.
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'], css: false },
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: false },
      '/socket.io': { target, ws: true, changeOrigin: false },
    },
  },
});
