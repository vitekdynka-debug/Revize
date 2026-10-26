import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { card } from './helpers.js';

async function downloadFile(page: Page, name: RegExp): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.file-row', { hasText: name }).getByRole('link', { name: 'Stáhnout' }).click(),
  ]);
  return readFile((await download.path())!);
}

test('results and photos survive closing the app; finished inspection exports XLSX, CSV and ZIP', async ({
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
  // One photo per camera shot, as on the iPad.
  for (let i = 1; i <= 2; i++) {
    await card(page).locator('input[type=file]').setInputFiles('e2e/.generated/defect.jpg');
    await expect(card(page).locator('.thumbs img')).toHaveCount(i);
  }
  await card(page).getByRole('button', { name: 'Uložit závadu' }).tap();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 2 z 50');

  // "Closing the app": a fresh page load must still have results and photos (IndexedDB).
  await page.reload();
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 2 z 50');
  await expect(page.locator('.item-row')).toHaveCount(48);
  await page.getByRole('button', { name: 'Zkontrolované', exact: true }).tap();
  await page.locator('.item-row', { hasText: '10005' }).tap();
  await expect(card(page)).toContainText('(2 foto)');
  await card(page).getByRole('button', { name: 'Zrušit' }).tap();

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('48 artiklů není zkontrolováno');
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Ukončit kontrolu', exact: true }).tap();
  await expect(page).toHaveURL(/#\/exports$/);
  const panel = page.locator('.panel').first();
  await expect(panel).toContainText('ukončená');
  await expect(panel).toContainText('OK 1 · závady 1 (vyřazeno 0) · nezkontrolováno 48 · fotek 2');

  await panel.getByRole('button', { name: 'Připravit export' }).tap();
  await expect(panel.locator('.file-row')).toHaveCount(3);

  // XLSX: proper table, numbers as numbers, frozen header.
  const xlsx = unzipSync(new Uint8Array(await downloadFile(page, /\.xlsx/)));
  const sheet = strFromU8(xlsx['xl/worksheets/sheet1.xml']!);
  expect(sheet).toContain('<v>10005</v>');
  expect(sheet).toContain('Chybí pojistka; &quot;nosník&quot;');
  expect(sheet).toContain('state="frozen"');
  expect(strFromU8(xlsx['xl/worksheets/sheet2.xml']!)).toContain('Ukázkový sklad s.r.o.');

  // CSV: a plain table starting with the header row.
  const csv = (await downloadFile(page, /\.csv/)).toString('utf8');
  expect(csv.startsWith('﻿Číslo artiklu,Typ,Umístění,Výsledek')).toBe(true);
  expect(csv).toContain(
    '10005,Regál,Hala A › Řada 1 › Pozice 5,Závada,"Chybí pojistka; ""nosník""",ne',
  );
  expect(csv.split('\r\n')).toHaveLength(51);

  // ZIP: photos named by item number plus a sidecar CSV.
  const zip = unzipSync(new Uint8Array(await downloadFile(page, /fotky\.zip/)));
  expect(Object.keys(zip).sort()).toEqual(['10005_01.jpg', '10005_02.jpg', 'fotky.csv']);
  expect(zip['10005_01.jpg']!.subarray(0, 2)).toEqual(new Uint8Array([0xff, 0xd8])); // JPEG
  expect(strFromU8(zip['fotky.csv']!)).toContain('10005_02.jpg,Výsledek kontroly,10005,Regál');

  // A new inspection starts empty.
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Zahájit kontrolu' }).tap();
  await expect(page.locator('.progress')).toContainText('Zkontrolováno 0 z 50');
});
