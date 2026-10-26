import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { card } from './helpers.js';

const PHOTO = 'e2e/.generated/defect.jpg';

async function openItem(page: Page, itemNumber: string) {
  await page.getByRole('button', { name: 'Vše', exact: true }).tap();
  await page.locator('.item-row', { hasText: itemNumber }).tap();
  await expect(card(page).locator('.card-number')).toHaveText(itemNumber);
}

const viewer = (page: Page) => page.locator('.viewer');

test('defect photos can be viewed, deleted and added later; re-saving keeps them', async ({
  page,
}) => {
  await page.goto('/#/inspection');
  await openItem(page, '10002');
  await card(page).getByRole('button', { name: 'Závada' }).tap();
  await card(page).getByRole('textbox').fill('Ohnutý nosník');
  for (let i = 1; i <= 3; i++) {
    await card(page).locator('input[type=file]').setInputFiles(PHOTO);
    await expect(card(page).locator('.thumb')).toHaveCount(i);
  }
  await card(page).getByRole('button', { name: 'Uložit závadu' }).tap();
  await expect(card(page)).toBeHidden();

  // After a restart the photos are there, can be opened full screen and deleted.
  await page.reload();
  await openItem(page, '10002');
  await expect(card(page)).toContainText('(3 foto)');
  await card(page).getByRole('button', { name: 'Závada' }).tap();
  await expect(card(page).locator('.thumb')).toHaveCount(3);
  await card(page).locator('.thumb').first().tap();
  await expect(viewer(page)).toContainText('1 / 3');
  await viewer(page).getByRole('button', { name: 'Další' }).tap();
  await expect(viewer(page)).toContainText('2 / 3');
  page.once('dialog', (d) => void d.accept());
  await viewer(page).getByRole('button', { name: 'Smazat' }).tap();
  await expect(viewer(page)).toContainText('/ 2');
  await viewer(page).getByRole('button', { name: 'Zavřít' }).tap();
  await expect(card(page).locator('.thumb')).toHaveCount(2);

  // Re-saving the defect (with one more photo) must not drop the earlier ones.
  await card(page).locator('input[type=file]').setInputFiles(PHOTO);
  await expect(card(page).locator('.thumb')).toHaveCount(3);
  await card(page).getByRole('button', { name: 'Uložit závadu' }).tap();
  await expect(card(page)).toBeHidden();
  await openItem(page, '10002');
  await expect(card(page)).toContainText('(3 foto)');
});

test('cancelling a defect discards its new photos', async ({ page }) => {
  await page.goto('/#/inspection');
  await openItem(page, '10003');
  await card(page).getByRole('button', { name: 'Závada' }).tap();
  await card(page).locator('input[type=file]').setInputFiles(PHOTO);
  await expect(card(page).locator('.thumb')).toHaveCount(1);
  await card(page).getByRole('button', { name: 'Zpět' }).tap();
  await card(page).getByRole('button', { name: 'Zrušit' }).tap();
  await expect(card(page)).toBeHidden();

  await openItem(page, '10003');
  await card(page).getByRole('button', { name: 'Závada' }).tap();
  await expect(card(page).locator('.thumb')).toHaveCount(0);
});

test('item photos (nameplate) for an OK item and inspection photos end up in the ZIP', async ({
  page,
}) => {
  await page.goto('/#/inspection');
  await openItem(page, '10004');
  await card(page).locator('.gallery input[type=file]').setInputFiles(PHOTO);
  await expect(card(page).locator('.thumb')).toHaveCount(1);
  await card(page).getByRole('button', { name: 'V pořádku' }).tap();
  await expect(card(page)).toBeHidden();

  // The item photo stays with the item.
  await openItem(page, '10004');
  await expect(card(page).locator('.thumb')).toHaveCount(1);
  await card(page).getByRole('button', { name: 'Zrušit' }).tap();

  await page.getByText('Fotky ke kontrole').click();
  await page.locator('details input[type=file]').setInputFiles(PHOTO);
  await expect(page.locator('details .thumb')).toHaveCount(1);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Ukončit kontrolu', exact: true }).tap();
  const panel = page.locator('.panel').first();
  await panel.getByRole('button', { name: 'Připravit export' }).tap();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .locator('.file-row', { hasText: 'fotky.zip' })
      .getByRole('link', { name: 'Stáhnout' })
      .click(),
  ]);
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(zip).sort()).toEqual(['10004_artikl_01.jpg', 'fotky.csv', 'kontrola_01.jpg']);
  const sidecar = strFromU8(zip['fotky.csv']!);
  expect(sidecar).toContain('10004_artikl_01.jpg,Fotka artiklu,10004,Žebřík');
  expect(sidecar).toContain('kontrola_01.jpg,Fotka ke kontrole,');
});
