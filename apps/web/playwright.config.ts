import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  // All tests share one database: run them in order.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4180',
    viewport: { width: 1440, height: 900 },
    locale: 'cs-CZ',
  },
  webServer: [
    {
      command: 'node e2e/start-api.mjs',
      url: 'http://localhost:3100/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm build && pnpm vite preview --strictPort --port 4180',
      url: 'http://localhost:4180',
      env: { API_URL: 'http://localhost:3100' },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
