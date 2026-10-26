import type { Page } from '@playwright/test';

export const card = (page: Page) => page.locator('.overlay');

/** Fails the test if the app loads anything from outside the local server (e.g. a WASM CDN). */
export function forbidExternalRequests(page: Page) {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http')) {
      external.push(request.url());
    }
  });
  return external;
}

/** Overrides spike settings before the app starts. */
export async function withSettings(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript((s) => {
    localStorage.setItem('revize-spike-settings', JSON.stringify(s));
  }, settings);
}
