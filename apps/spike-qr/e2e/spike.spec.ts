import { expect, test } from '@playwright/test';
import { card, forbidExternalRequests } from './helpers.js';

test('camera scan shows the item detail; OK saves and returns to the scanner', async ({ page }) => {
  const external = forbidExternalRequests(page);
  await page.goto('/#/scan');

  await expect(card(page).locator('.card-number')).toHaveText('10001', { timeout: 15_000 });
  await expect(card(page)).toContainText('Hala A › Řada 1 › Pozice 1');
  await expect(card(page)).toContainText('Typ žebříku');
  await expect(card(page)).toContainText('Příští kontrola');
  await card(page).getByRole('button', { name: 'V pořádku' }).tap();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('.scan-progress')).toHaveText(/Zkontrolováno 1 z 50/);

  // The same label is still in view: the de-duplication must not reopen the card.
  await page.waitForTimeout(2000);
  await expect(card(page)).toBeHidden();
  await expect(page.locator('.scan-stats')).toContainText('zxing-wasm');

  await page.goto('/#/log');
  await expect(page.getByRole('row', { name: /Kamera \(QR\) 1/ })).toBeVisible();
  expect(external).toEqual([]);
});

test('Zrušit closes the card without saving anything', async ({ page }) => {
  await page.goto('/#/scan');
  await expect(card(page)).toBeVisible({ timeout: 15_000 });
  await card(page).getByRole('button', { name: 'Zrušit' }).tap();
  await expect(card(page)).toBeHidden();

  await page.goto('/#/inspection');
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 0 z 50');
});

test('leaving the scanner closes an open card without recording it', async ({ page }) => {
  await page.goto('/#/scan');
  await expect(card(page)).toBeVisible({ timeout: 15_000 });
  await page.goto('/#/log');
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Kamera \(QR\) 0/ })).toBeVisible();
});

test('keypad defect with description is stored; re-opening shows the previous result', async ({
  page,
}) => {
  await page.goto('/#/keypad');
  const type = async (digits: string) => {
    for (const key of digits) {
      await page
        .getByRole('button', { name: key, exact: true })
        .first()
        .dispatchEvent('pointerdown');
    }
  };
  await type('10002');
  await expect(card(page).locator('.card-number')).toHaveText('10002');
  await card(page).getByRole('button', { name: 'Závada' }).tap();
  await card(page).getByRole('button', { name: 'Uložit závadu' }).tap();
  await expect(card(page)).toContainText('Napište popis závady');
  await card(page).getByRole('textbox').fill('Ohnutý příčník');
  await card(page).getByRole('checkbox').check();
  await card(page).getByRole('button', { name: 'Uložit závadu' }).tap();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('.manual-input')).toHaveValue('');

  await type('10002');
  await expect(card(page)).toContainText('už zkontrolováno');
  await expect(card(page)).toContainText('Závada – vyřazeno – Ohnutý příčník');
});

test('Bluetooth keyboard-wedge scan works on any screen', async ({ page }) => {
  await page.goto('/#/');
  await page.keyboard.type('10003', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(card(page).locator('.card-number')).toHaveText('10003');
  await card(page).getByRole('button', { name: 'V pořádku' }).tap();
  await expect(card(page)).toBeHidden();

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
