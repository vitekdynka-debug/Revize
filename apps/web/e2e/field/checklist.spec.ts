import { expect, test } from '@playwright/test';
import { createData, login, sheet, startInspection } from './helpers.js';

test('check points of a rack: NE writes an amber defect with its text', async ({ page }) => {
  await login(page, 'admin@revize.local', 'admin-heslo-123');
  await expect(page.getByRole('heading', { name: 'Zákazníci' })).toBeVisible();
  const { site } = await createData(page.request, ' body', 6);
  // A rack of the library type: "Kotvení do podlahy" and "Štítek s nosností" (ADR-0021).
  const rackType = await (
    await page.request.post('/api/equipment-types', {
      data: { presetKey: 'rack', name: 'Regál (body)' },
    })
  ).json();
  const rack = await page.request.post('/api/items', {
    data: {
      siteId: site.id,
      locationId: null,
      equipmentTypeId: rackType.id,
      itemNumber: null,
      designation: 'NH77',
      fieldValues: { rack_type: 'Paletový', manufacturer: 'Mecalux' },
    },
  });
  expect(rack.status()).toBe(201);

  await page.goto('/teren');
  await startInspection(page, ' body');
  await page.getByTestId('item-NH77').click();
  const card = sheet(page);
  const checklist = card.getByTestId('checklist');
  await expect(checklist).toContainText('Kotvení do podlahy');
  await expect(checklist).toContainText('Štítek s nosností');

  // NE: an amber (žlutá) defect with the text of the point; "V pořádku" is not possible now.
  await checklist.locator('label', { hasText: 'NE' }).nth(1).click();
  await expect(card.getByLabel('Popis závady')).toHaveValue('Chybí štítek s nosností');
  await expect(card.getByRole('button', { name: 'V pořádku' })).toBeDisabled();
  await card.getByRole('button', { name: 'Uložit závadu' }).click();
  await expect(card).toBeHidden();

  const inspectionId = page.url().split('/').pop()!;
  await expect
    .poll(async () => {
      const items = (await (
        await page.request.get(`/api/inspections/${inspectionId}/items`)
      ).json()) as { designation: string; result: { severity: string; checks: object } | null }[];
      return items.find((i) => i.designation === 'NH77')?.result;
    })
    .toMatchObject({
      severity: 'amber',
      checks: { floor_anchoring: true, load_sign: false },
    });
});
