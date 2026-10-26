import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { card } from './helpers.js';

test('results survive closing the app; the inspection can be finished and exported', async ({
  page,
}) => {
  await page.goto('/#/inspection');
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 0 z 50');

  // Check two items from the list (sorted by location).
  await page.locator('.item-row', { hasText: '10001' }).tap();
  await card(page).getByRole('button', { name: 'V pořádku' }).tap();
  await expect(card(page)).toBeHidden();
  await page.locator('.item-row', { hasText: '10005' }).tap();
  await card(page).getByRole('button', { name: 'Závada' }).tap();
  await card(page).getByRole('textbox').fill('Chybí pojistka; "nosník"');
  await card(page).getByRole('button', { name: 'Uložit závadu' }).tap();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 2 z 50');

  // "Closing the app": a fresh page load must still have the results (IndexedDB).
  await page.reload();
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 2 z 50');
  await expect(page.locator('.item-row')).toHaveCount(48);

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('48 artiklů není zkontrolováno');
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Ukončit kontrolu', exact: true }).tap();
  await expect(page).toHaveURL(/#\/exports$/);
  await expect(page.locator('.panel')).toContainText('ukončená');
  await expect(page.locator('.panel')).toContainText('OK 1 · závady 1');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Výsledky (CSV)' }).tap(),
  ]);
  const content = await readFile((await download.path())!, 'utf8');
  expect(content.startsWith('﻿')).toBe(true);
  expect(content).toContain('10001;Žebřík;Hala A › Řada 1 › Pozice 1;V pořádku');
  expect(content).toContain(
    '10005;Regál;Hala A › Řada 1 › Pozice 5;Závada;"Chybí pojistka; ""nosník""";ne',
  );
  expect(content).toContain('10002;Regál;Hala A › Řada 1 › Pozice 2;Nezkontrolováno');

  // A new inspection starts empty.
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Zahájit kontrolu' }).tap();
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 0 z 50');
});
