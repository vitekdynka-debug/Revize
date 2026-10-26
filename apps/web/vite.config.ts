import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Keep the browser's Host header: the API compares it with Origin to block cross-site writes
// (the string shorthand would set changeOrigin and every write would be rejected).
const proxy = {
  '/api': { target: process.env.API_URL ?? 'http://localhost:3000', changeOrigin: false },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: { target: 'safari15' },
});
