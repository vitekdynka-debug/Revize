import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // iPad Pro 11" portrait, touch enabled. Chromium is used because only it can fake a camera.
    viewport: { width: 834, height: 1194 },
    hasTouch: true,
    permissions: ['camera'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-video-capture=e2e/.generated/qr-R10001.y4m',
      ],
    },
  },
  webServer: {
    command: `pnpm build && pnpm vite preview --strictPort --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
