import { afterAll, beforeAll, expect, it } from 'vitest';
import { SharpImageProcessor } from '../src/infra/sharp-image-processor.js';
import { SHOWCASE_CUSTOMER, SHOWCASE_INSPECTOR } from '../src/seed/showcase.js';
import { resetShowcase } from '../src/showcase.js';
import { bearer, createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;
const PASSWORD = 'ukazka-test-heslo';

beforeAll(async () => {
  ctx = await createTestContext({ SHOWCASE: 'true', SHOWCASE_PASSWORD: PASSWORD });
  await ctx.reset();
});
afterAll(async () => {
  await ctx.app.close();
  await ctx.database.close();
});

const server = () => ({
  db: ctx.database.db,
  config: ctx.config,
  files: ctx.files,
  images: new SharpImageProcessor(),
  log: ctx.app.log,
});

it('fills the showcase: customer, items with photos, a closed and an open inspection', async () => {
  await resetShowcase(server());
  const info = (await ctx.app.inject({ method: 'GET', url: '/api/showcase' })).json();
  expect(info.enabled).toBe(true);
  expect(info.accounts.map((a: { email: string }) => a.email)).toContain(SHOWCASE_INSPECTOR.email);

  const { token } = await ctx.login(SHOWCASE_INSPECTOR.email, PASSWORD);
  const api = (url: string) =>
    ctx.app.inject({ method: 'GET', url, headers: bearer(token) }).then((r) => r.json());
  const customers = await api('/api/customers');
  expect(customers.map((c: { name: string }) => c.name)).toContain(SHOWCASE_CUSTOMER);
  const items = await api('/api/items?limit=200');
  expect(items.total).toBeGreaterThanOrEqual(50);
  const inspections = (await api('/api/inspections')) as { id: string; status: string }[];
  expect(inspections.map((i) => i.status).sort()).toEqual(['closed', 'open']);
  const open = inspections.find((i) => i.status === 'open')!;
  const working = (await api(`/api/inspections/${open.id}/items`)) as {
    result: { outcome: string; severity: string | null; checks: Record<string, boolean> } | null;
  }[];
  const results = working.flatMap((i) => (i.result ? [i.result] : []));
  // Checked and unchecked items, defects of every level, a failed check point.
  expect(working.some((i) => !i.result)).toBe(true);
  for (const level of ['green', 'amber', 'red']) {
    expect(results.some((r) => r.severity === level)).toBe(true);
  }
  expect(results.some((r) => Object.values(r.checks).includes(false))).toBe(true);
  const photos = (await api(`/api/photos?inspectionId=${open.id}`)) as unknown[];
  expect(photos.length).toBeGreaterThan(0);
  // Protocols work on the showcase data (preliminary, with the defects and their photos).
  const html = await ctx.app.inject({
    method: 'GET',
    url: `/api/inspections/${open.id}/protocol.html`,
    headers: bearer(token),
  });
  expect(html.body).toContain('Ohnutý stojan');
  expect(html.body).toContain('<img');
  const pdf = await ctx.app.inject({
    method: 'GET',
    url: `/api/inspections/${open.id}/protocol.pdf`,
    headers: bearer(token),
  });
  expect(pdf.statusCode, pdf.body.slice(0, 200)).toBe(200);
  expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');

  // A visitor's change is gone after the reset; the showcase is back.
  await ctx.app.inject({
    method: 'POST',
    url: '/api/customers',
    headers: bearer((await ctx.login(info.accounts[0].email, info.accounts[0].password)).token),
    payload: { name: 'Návštěvník s.r.o.' },
  });
  await resetShowcase(server());
  const { token: again } = await ctx.login(SHOWCASE_INSPECTOR.email, PASSWORD);
  const after = (
    await ctx.app.inject({ method: 'GET', url: '/api/customers', headers: bearer(again) })
  ).json() as { name: string }[];
  expect(after.map((c) => c.name)).toEqual([SHOWCASE_CUSTOMER]);
}, 120_000);
