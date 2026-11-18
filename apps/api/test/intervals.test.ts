import { RACK_CHECKLIST, newId } from '@revize/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, bearer, createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;
let token: string;
const api = (method: 'GET' | 'PUT' | 'POST' | 'PATCH', url: string, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: bearer(token), ...(payload ? { payload } : {}) });

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.app.close();
  await ctx.database.close();
});
beforeEach(async () => {
  await ctx.reset({ seedDemo: true });
  token = (await ctx.login(ADMIN.email, ADMIN.password)).token;
});

describe('inspection intervals', () => {
  it('item → nearest location → site → type decide the next inspection', async () => {
    const customers = (await api('GET', '/api/customers')).json<{ id: string }[]>();
    const site = (await api('GET', `/api/customers/${customers[0]!.id}/sites`)).json<
      { id: string; version: number }[]
    >()[0]!;
    const types = (await api('GET', '/api/equipment-types')).json<{ id: string; name: string }[]>();
    const ladder = types.find((t) => t.name === 'Žebřík')!.id;
    const id = newId();
    await api('PUT', `/api/inspections/${id}`, {
      siteId: site.id,
      inspectionDate: '2026-11-03',
      equipmentTypeIds: [ladder],
    });
    const items = (await api('GET', `/api/inspections/${id}/items`)).json<
      { id: string; locationId: string; intervalMonths: number }[]
    >();
    // Type default first.
    expect(items[0]!.intervalMonths).toBe(12);

    // The site: 24 months.
    expect(
      (
        await api('PATCH', `/api/sites/${site.id}`, {
          version: site.version,
          inspectionIntervalMonths: 24,
        })
      ).statusCode,
    ).toBe(200);
    // The hall of the first item: 6 months (inherited by everything below it).
    const locations = (await api('GET', `/api/sites/${site.id}/locations`)).json<
      { id: string; version: number; depth: number; pathNames: string[] }[]
    >();
    const first = locations.find((l) => l.id === items[0]!.locationId)!;
    const hall = locations.find((l) => l.depth === 0 && l.pathNames[0] === first.pathNames[0])!;
    await api('PATCH', `/api/locations/${hall.id}`, {
      version: hall.version,
      inspectionIntervalMonths: 6,
    });
    // One item: 3 months of its own.
    const own = (await api('GET', `/api/items/${items[1]!.id}`)).json<{ version: number }>();
    await api('PATCH', `/api/items/${items[1]!.id}`, {
      version: own.version,
      inspectionIntervalMonths: 3,
    });

    const after = (await api('GET', `/api/inspections/${id}/items`)).json<
      { id: string; intervalMonths: number; locationPath: string[] }[]
    >();
    expect(after[0]!.intervalMonths).toBe(6);
    expect(after[1]!.intervalMonths).toBe(3);
    const elsewhere = after.find((i) => i.locationPath[0] !== first.pathNames[0]);
    if (elsewhere) expect(elsewhere.intervalMonths).toBe(24);

    for (const item of after.slice(0, 2)) {
      await api('PUT', `/api/inspections/${id}/results/${item.id}`, {
        id: newId(),
        outcome: 'ok',
        recordedAt: new Date().toISOString(),
      });
    }
    // Closed without a common date: each item by its own interval.
    const closed = await api('POST', `/api/inspections/${id}/close`, {});
    expect(closed.json()).toMatchObject({ nextInspectionDate: '2027-02-03' });
    const a = (await api('GET', `/api/items/${after[0]!.id}`)).json<{
      nextInspectionDate: string;
    }>();
    const b = (await api('GET', `/api/items/${after[1]!.id}`)).json<{
      nextInspectionDate: string;
    }>();
    expect(a.nextInspectionDate).toBe('2027-05-03');
    expect(b.nextInspectionDate).toBe('2027-02-03');
  });
});

describe('check points (ADR-0021)', () => {
  it('stores the ANO / NE answers and keeps them when a result is saved without them', async () => {
    const customers = (await api('GET', '/api/customers')).json<{ id: string }[]>();
    const site = (await api('GET', `/api/customers/${customers[0]!.id}/sites`)).json<
      { id: string }[]
    >()[0]!;
    const types = (await api('GET', '/api/equipment-types')).json<
      { id: string; riskLevels: boolean; checklist: { key: string }[]; version: number }[]
    >();
    const rack = types.find((t) => t.riskLevels)!;
    if (!rack.checklist.length) {
      const set = await api('PATCH', `/api/equipment-types/${rack.id}`, {
        version: rack.version,
        checklist: RACK_CHECKLIST,
      });
      expect(set.statusCode, set.body).toBe(200);
    }
    const typed = (await api('GET', `/api/equipment-types/${rack.id}`)).json();
    expect(typed.checklist.map((c: { key: string }) => c.key)).toEqual([
      'floor_anchoring',
      'load_sign',
    ]);

    const id = newId();
    await api('PUT', `/api/inspections/${id}`, {
      siteId: site.id,
      inspectionDate: '2026-11-18',
      equipmentTypeIds: [rack.id],
    });
    const item = (await api('GET', `/api/inspections/${id}/items`)).json<{ id: string }[]>()[0]!;
    const resultId = newId();
    const saved = await api('PUT', `/api/inspections/${id}/results/${item.id}`, {
      id: resultId,
      outcome: 'defect',
      severity: 'amber',
      defectDescription: 'Chybí štítek s nosností',
      checks: { floor_anchoring: true, load_sign: false },
      recordedAt: new Date().toISOString(),
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().checks).toEqual({ floor_anchoring: true, load_sign: false });
    // The office edits the description only: the answers stay.
    const edited = await api('PUT', `/api/inspections/${id}/results/${item.id}`, {
      id: resultId,
      outcome: 'defect',
      severity: 'amber',
      defectDescription: 'Chybí štítek s nosností, doplnit',
      recordedAt: new Date(Date.now() + 1000).toISOString(),
    });
    expect(edited.json().checks).toEqual({ floor_anchoring: true, load_sign: false });
    const listed = (await api('GET', `/api/inspections/${id}/items`)).json<
      { id: string; result: { checks: Record<string, boolean> } | null }[]
    >();
    expect(listed.find((i) => i.id === item.id)!.result!.checks.load_sign).toBe(false);
  });
});
