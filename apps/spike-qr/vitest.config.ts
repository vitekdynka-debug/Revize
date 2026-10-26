import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'spike-qr', environment: 'node', include: ['src/**/*.test.ts'] },
});
