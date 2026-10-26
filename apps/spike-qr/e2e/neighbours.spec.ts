import { expect, test } from '@playwright/test';
import { card, withSettings } from './helpers.js';

// Two labels next to each other in the camera image; only the one under the crosshair may be read.
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-video-capture=e2e/.generated/qr-neighbours.y4m',
    ],
  },
});

test('reads the label under the crosshair, not its neighbour', async ({ page }) => {
  // Whole screen as scan area, so that both labels are fully decodable.
  await withSettings(page, { roiFraction: 1 });
  await page.goto('/#/scan');
  await expect(card(page).locator('.card-number')).toHaveText('10002', { timeout: 15_000 });
  await card(page).getByRole('button', { name: 'V pořádku' }).tap();
  await expect(card(page)).toBeHidden();

  // After closing the card the neighbour must not pop up either.
  await page.waitForTimeout(2500);
  await expect(card(page)).toBeHidden();
});

test('tap mode decodes only after pressing Načíst', async ({ page }) => {
  await withSettings(page, { roiFraction: 1, trigger: 'tap' });
  await page.goto('/#/scan');
  await page.waitForTimeout(2500);
  await expect(card(page)).toBeHidden();
  await page.getByRole('button', { name: 'Načíst' }).tap();
  await expect(card(page).locator('.card-number')).toHaveText('10002', { timeout: 5000 });
});
