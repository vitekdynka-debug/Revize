import { expect, test, type Page } from '@playwright/test';

/** Fails the test if the app loads anything from outside the local server (e.g. a WASM CDN). */
function forbidExternalRequests(page: Page) {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http')) {
      external.push(request.url());
    }
  });
  return external;
}

const card = (page: Page) => page.locator('.overlay');

test('camera scan opens the item card and OK returns to the scanner', async ({ page }) => {
  const external = forbidExternalRequests(page);
  await page.goto('/#/scan');

  await expect(card(page).locator('.card-number')).toHaveText('10001', { timeout: 15_000 });
  await card(page).getByRole('button', { name: 'V pořádku' }).tap();
  await expect(card(page)).toBeHidden();

  // The same label is still in view: the de-duplication must not reopen the card.
  await page.waitForTimeout(1500);
  await expect(card(page)).toBeHidden();
  await expect(page.locator('.scan-stats')).toContainText('zxing-wasm');

  await page.goto('/#/log');
  await expect(page.getByRole('row', { name: /Kamera \(QR\) 1/ })).toBeVisible();
  expect(external).toEqual([]);
});

test('leaving the scanner closes an open card without recording it', async ({ page }) => {
  await page.goto('/#/scan');
  await expect(card(page)).toBeVisible({ timeout: 15_000 });
  await page.goto('/#/log');
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Kamera \(QR\) 0/ })).toBeVisible();
});

test('in-app keypad finds the item after the 5th digit and records a defect', async ({ page }) => {
  await page.goto('/#/keypad');
  for (const key of '10002') {
    await page.getByRole('button', { name: key, exact: true }).first().dispatchEvent('pointerdown');
  }
  await expect(card(page).locator('.card-number')).toHaveText('10002');
  await card(page).getByRole('button', { name: 'Závada' }).tap();
  await card(page).getByRole('textbox').fill('Ohnutý příčník');
  await card(page).getByRole('checkbox').check();
  await card(page).getByRole('button', { name: 'Uložit závadu' }).tap();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('.manual-input')).toHaveValue('');
});

test('Bluetooth keyboard-wedge scan works on any screen', async ({ page }) => {
  await page.goto('/#/');
  await page.keyboard.type('10003', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(card(page).locator('.card-number')).toHaveText('10003');
  await card(page).getByRole('button', { name: 'V pořádku' }).tap();

  await page.keyboard.type('NEZNAMY-1', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(card(page)).toContainText('Neznámý kód');
});

test('slow human typing is not treated as a scanner', async ({ page }) => {
  await page.goto('/#/');
  await page.keyboard.type('10004', { delay: 150 });
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeHidden();
});
