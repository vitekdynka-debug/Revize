import {
  EQUIPMENT_TYPE_PRESETS,
  closeInspectionSchema,
  createCustomerSchema,
  createItemSchema,
  createLocationSchema,
  createSiteSchema,
  createUserRequestSchema,
  newId,
  permissionsOf,
  recordResultSchema,
  startInspectionSchema,
  type EquipmentType,
  type EquipmentTypesExport,
  type FieldDefinition,
  type Severity,
} from '@revize/shared';
import { and, eq } from 'drizzle-orm';
import type { AuthContext } from '../auth/context.js';
import type { Db } from '../db/client.js';
import { appUser, customer } from '../db/schema.js';
import type { FileStorage } from '../infra/file-storage.js';
import type { ImageProcessor } from '../infra/image-processor.js';
import { createCustomersService } from '../modules/customers/service.js';
import { createEquipmentTypesService } from '../modules/equipment-types/service.js';
import { createInspectionsService } from '../modules/inspections/service.js';
import { createItemsService } from '../modules/items/service.js';
import { createLocationsService } from '../modules/locations/service.js';
import { createPhotosService } from '../modules/photos/service.js';
import { createUsersService } from '../modules/users/service.js';

/** The fictitious customer of the showcase; its presence means the showcase is seeded. */
export const SHOWCASE_CUSTOMER = 'Logistika Vzor s.r.o.';
export const SHOWCASE_INSPECTOR = { email: 'technik@revize.local', name: 'Petr Technik' };

/** Illustrative photos (drawn, `apps/api/assets/showcase`, `scripts/showcase-photos.mjs`). */
export type ShowcasePhoto =
  | 'regal-prehled'
  | 'regal-ohnuty-stojan'
  | 'regal-chybi-pojistka'
  | 'regal-bez-stitku'
  | 'regal-stitek'
  | 'regal-kotveni'
  | 'zebrik-prehled'
  | 'zebrik-praskla-pricka'
  | 'zebrik-chybi-patka'
  | 'zebrik-stitek'
  | 'vazak-prehled'
  | 'vazak-poskozeny'
  | 'vazak-stitek'
  | 'konstrukce-koroze'
  | 'hala-prehled';

export interface ShowcaseDeps {
  db: Db;
  files: FileStorage;
  images: ImageProcessor;
  /** The JPEG of an illustrative photo (server: from disk; demo: fetched by the browser). */
  loadPhoto: (name: ShowcasePhoto) => Promise<Uint8Array>;
  /** Password of the showcase technician account. */
  inspectorPassword: string;
  /**
   * The equipment types of the real instance (Typy vybavení → Stáhnout nastavení), if given:
   * imported first, so the showcase looks like the real thing.
   */
  loadTypes?: () => Promise<EquipmentTypesExport | null>;
}

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
/** A moment on a day relative to today (negative = in the past), at hh:mm UTC. */
const at = (daysAgo: number, hour: number, minute = 0) => {
  const date = new Date(Date.now() - daysAgo * DAY);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
};

/** Plausible values for any type: from its options and suggestions, numbers by the field key. */
function valuesFor(type: EquipmentType, i: number, overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {};
  const pick = <T>(list: readonly T[]) => list[i % list.length];
  for (const field of type.fieldDefinitions.filter((f) => !f.archived)) {
    if (field.key in overrides) {
      values[field.key] = overrides[field.key];
      continue;
    }
    if (field.defaultProduct) continue; // computed from the others
    const value = sampleValue(field, i, pick);
    if (value !== undefined) values[field.key] = value;
  }
  return values;
}

function sampleValue(
  field: FieldDefinition,
  i: number,
  pick: <T>(list: readonly T[]) => T | undefined,
): unknown {
  const key = field.key;
  switch (field.kind) {
    case 'select':
      return pick(field.options);
    case 'multiselect':
      return field.options.length ? [pick(field.options)] : undefined;
    case 'boolean':
      return true;
    case 'text':
      if (field.suggestions.length) return pick(field.suggestions);
      if (/serial|vyrobni|cislo/.test(key)) return `SN-${2024000 + i * 37}`;
      if (/model|system/.test(key)) return pick(['SPS 80', 'Profi', 'Standard', 'Heavy']);
      return field.required ? `Ukázka ${i + 1}` : undefined;
    case 'integer':
      if (/year|rok/.test(key)) return 2012 + (i % 12);
      if (/levels|urov/.test(key)) return 3 + (i % 3);
      if (/rungs|prick|stup/.test(key)) return 6 + 2 * (i % 4);
      if (/legs|vetv/.test(key)) return 1 + (i % 2);
      if (/sections|dil/.test(key)) return 1 + (i % 3);
      if (/_kg|load|nosn/.test(key)) return pick([150, 1000, 2000, 3000]);
      if (/_mm|height|width|depth|delka/.test(key)) return pick([1800, 2700, 3600, 4500]);
      return field.required ? 1 + (i % 5) : undefined;
    case 'number':
      if (/wll|_t$/.test(key)) return pick([1, 2, 3, 5]);
      if (/_m$|length/.test(key)) return pick([1.5, 2, 3, 4]);
      return field.required ? 1 + (i % 5) : undefined;
    case 'date':
      return field.required ? '2020-01-01' : undefined;
  }
}

interface Defect {
  severity: Severity;
  text: string;
  photo?: ShowcasePhoto;
  /** Check points answered NE (racks). */
  failed?: string[];
}

/**
 * Showcase data (ADR-0023): a fictitious customer with a site, halls and rows, several dozen
 * items of five types with illustrative photos, last year's closed inspection and this
 * year's inspection in progress with defects of every kind. Dates are relative to today, so a
 * reset always gives a current picture. Skipped when the customer already exists.
 */
export async function seedShowcase(deps: ShowcaseDeps, organizationId: string): Promise<boolean> {
  const { db } = deps;
  const [existing] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(and(eq(customer.organizationId, organizationId), eq(customer.name, SHOWCASE_CUSTOMER)));
  if (existing) return false;

  const [admin] = await db
    .select()
    .from(appUser)
    .where(and(eq(appUser.organizationId, organizationId), eq(appUser.role, 'admin')))
    .limit(1);
  if (!admin) return false;
  const authOf = (userId: string, role: 'admin' | 'inspector'): AuthContext => ({
    userId,
    organizationId,
    role,
    permissions: permissionsOf(role),
    sessionId: 'showcase-seed',
    via: 'bearer',
  });
  const office = authOf(admin.id, 'admin');

  const users = createUsersService(db);
  const types = createEquipmentTypesService(db);
  const customers = createCustomersService(db);
  const locations = createLocationsService(db);
  const items = createItemsService(db);
  const inspections = createInspectionsService(db, deps.files);
  const photos = createPhotosService(db, deps.files, deps.images);

  // The technician who records the results.
  let [inspector] = await db
    .select()
    .from(appUser)
    .where(
      and(eq(appUser.organizationId, organizationId), eq(appUser.email, SHOWCASE_INSPECTOR.email)),
    );
  if (!inspector) {
    const created = await users.create(
      office,
      createUserRequestSchema.parse({
        email: SHOWCASE_INSPECTOR.email,
        displayName: SHOWCASE_INSPECTOR.name,
        role: 'inspector',
        password: deps.inspectorPassword,
        certification: 'Osvědčení č. 12/2024 – kontroly regálů a žebříků',
      }),
    );
    [inspector] = await db.select().from(appUser).where(eq(appUser.id, created.id));
  }
  const field = authOf(inspector!.id, 'inspector');

  const ownTypes = await deps.loadTypes?.();
  if (ownTypes) await types.importSettings(office, ownTypes);

  // Equipment types: the organization's own, else the library ones.
  const typeOf = async (presetKey: string) => {
    const preset = EQUIPMENT_TYPE_PRESETS.find((p) => p.key === presetKey)!;
    const all = await types.list(office);
    return (
      all.find((t) => t.name === preset.name && !t.archived) ??
      (await types.create(office, { presetKey }))
    );
  };
  const rack = await typeOf('rack');
  const ladder = await typeOf('portable_ladder');
  const sling = await typeOf('lifting_sling');
  const steel = await typeOf('steel_structure');
  const fixedLadder = await typeOf('fixed_ladder');

  const client = await customers.create(
    office,
    createCustomerSchema.parse({
      name: SHOWCASE_CUSTOMER,
      companyId: '12345678',
      address: 'Průmyslová 1234/5, 627 00 Brno',
      contactName: 'Jana Skladová',
      contactEmail: 'sklad@logistika-vzor.example',
    }),
  );
  const site = await customers.createSite(
    office,
    client.id,
    createSiteSchema.parse({
      name: 'Distribuční centrum Brno',
      address: 'Průmyslová 1234/5, Brno',
    }),
  );
  const place = (parentId: string | null, name: string) =>
    locations.create(office, site.id, createLocationSchema.parse({ parentId, name }));
  const hallA = await place(null, 'Hala A');
  const hallB = await place(null, 'Hala B');
  const yard = await place(null, 'Venkovní plocha');
  const rows = {
    A1: await place(hallA.id, 'Řada 1'),
    A2: await place(hallA.id, 'Řada 2'),
    A3: await place(hallA.id, 'Řada 3'),
    B1: await place(hallB.id, 'Řada 1'),
    B2: await place(hallB.id, 'Řada 2'),
    dock: await place(hallB.id, 'Expedice'),
  };

  // ---------- items ----------
  type Made = { id: string; key: string; typeId: string };
  const made: Made[] = [];
  const add = async (
    key: string,
    type: EquipmentType,
    locationId: string,
    i: number,
    options: {
      itemNumber?: string | null;
      designation?: string;
      values?: Record<string, unknown>;
    } = {},
  ) => {
    const created = await items.create(
      office,
      createItemSchema.parse({
        id: newId(),
        siteId: site.id,
        locationId,
        equipmentTypeId: type.id,
        itemNumber: options.itemNumber ?? null,
        designation: options.designation ?? key,
        qrCode: '',
        fieldValues: valuesFor(type, i, options.values),
      }),
    );
    made.push({ id: created.id, key, typeId: type.id });
    return created;
  };

  // Racks: no číslo TZ, known by their designation (ADR-0020).
  const rackRows: [keyof typeof rows, number][] = [
    ['A1', 8],
    ['A2', 8],
    ['A3', 6],
    ['B1', 6],
  ];
  let n = 0;
  for (const [row, count] of rackRows) {
    for (let k = 1; k <= count; k++) {
      await add(`${row}-${String(k).padStart(2, '0')}`, rack, rows[row].id, n++, {
        values: {
          rack_type: row === 'B1' ? 'Policový' : 'Paletový',
          system: row === 'B1' ? 'příruční' : 'SPS 80',
        },
      });
    }
  }
  // Ladders, slings, steel structures and fixed ladders with číslo TZ from the printed labels.
  for (let k = 1; k <= 10; k++) {
    await add(`Ž-${String(k).padStart(2, '0')}`, ladder, k <= 5 ? rows.A1.id : rows.B2.id, k, {
      itemNumber: String(12400 + k),
    });
  }
  for (let k = 1; k <= 8; k++) {
    await add(`V-${String(k).padStart(2, '0')}`, sling, rows.dock.id, k, {
      itemNumber: String(12500 + k),
    });
  }
  for (let k = 1; k <= 3; k++) {
    await add(`K-${String(k).padStart(2, '0')}`, steel, k === 3 ? yard.id : hallB.id, k, {
      itemNumber: String(12600 + k),
    });
  }
  for (let k = 1; k <= 2; k++) {
    await add(`PŽ-${String(k).padStart(2, '0')}`, fixedLadder, k === 1 ? hallA.id : yard.id, k, {
      itemNumber: String(12700 + k),
    });
  }
  const byKey = (key: string) => made.find((m) => m.key === key)!;

  const upload = async (
    auth: AuthContext,
    name: ShowcasePhoto,
    owner: 'item' | 'result' | 'inspection',
    target: { itemId?: string; inspectionId?: string },
    takenAt: Date,
  ) =>
    photos.upload(
      auth,
      newId(),
      { owner, ...target, takenAt: takenAt.toISOString() },
      { filename: `${name}.jpg`, mimetype: 'image/jpeg', data: await deps.loadPhoto(name) },
    );

  // Photos of the items themselves (overview, nameplate).
  for (const [key, names] of [
    ['A1-01', ['regal-prehled', 'regal-stitek']],
    ['Ž-01', ['zebrik-prehled', 'zebrik-stitek']],
    ['V-01', ['vazak-prehled', 'vazak-stitek']],
  ] as const) {
    for (const name of names) {
      await upload(field, name, 'item', { itemId: byKey(key).id }, at(370, 8));
    }
  }

  // ---------- inspections ----------
  const checklistOf = (typeId: string) =>
    typeId === rack.id ? rack.checklist : typeId === ladder.id ? ladder.checklist : [];
  const record = async (
    inspectionId: string,
    key: string,
    when: Date,
    defect?: Defect,
    auth: AuthContext = field,
  ) => {
    const target = byKey(key);
    const checks = Object.fromEntries(
      checklistOf(target.typeId).map((c) => [c.key, !defect?.failed?.includes(c.key)]),
    );
    await inspections.recordResult(
      auth,
      inspectionId,
      target.id,
      recordResultSchema.parse({
        id: newId(),
        outcome: defect ? 'defect' : 'ok',
        severity: defect?.severity ?? null,
        defectDescription: defect?.text ?? null,
        takenOutOfService: defect?.severity === 'red',
        checks,
        recordedAt: when.toISOString(),
      }),
    );
    if (defect?.photo) {
      await upload(auth, defect.photo, 'result', { itemId: target.id, inspectionId }, when);
    }
  };

  // Last year's inspection, closed: a few defects, the next dates come from it.
  const lastYear = newId();
  await inspections.start(
    field,
    lastYear,
    startInspectionSchema.parse({
      siteId: site.id,
      inspectionDate: isoDay(at(372, 7)),
      note: 'Pravidelná roční kontrola.',
    }),
  );
  const earlier: Record<string, Defect> = {
    'A1-03': { severity: 'green', text: 'Mírná deformace stojanu v toleranci – sledovat' },
    'A2-06': { severity: 'amber', text: 'Ohnutý nosník, pole vyprázdněno do opravy' },
    'Ž-03': { severity: 'green', text: 'Opotřebené protiskluzové patky' },
    'V-02': { severity: 'red', text: 'Natržený popruh – vyřazeno z používání' },
  };
  for (const [i, item] of made.entries()) {
    await record(
      lastYear,
      item.key,
      at(i < 30 ? 372 : 371, 8 + (i % 8), (i * 7) % 60),
      earlier[item.key],
    );
  }
  await inspections.close(office, lastYear, closeInspectionSchema.parse({}));

  // This year's inspection in progress (two days so far): defects of every kind, a quarter
  // still unchecked – visitors can go on in the field, edit in the office and print protocols.
  const current = newId();
  await inspections.start(
    field,
    current,
    startInspectionSchema.parse({
      siteId: site.id,
      inspectionDate: isoDay(at(2, 7)),
      note: 'Roční kontrola dle ČSN EN 15635 a pokynů výrobců.',
    }),
  );
  const now: Record<string, Defect> = {
    'A1-03': {
      severity: 'amber',
      text: 'Ohnutý stojan v dolní části po nárazu VZV – pole vyprázdnit, oprava do 4 týdnů',
      photo: 'regal-ohnuty-stojan',
    },
    'A1-07': { severity: 'green', text: 'Odřený nátěr nosníku, bez deformace – sledovat' },
    'A2-02': {
      severity: 'red',
      text: 'Chybí pojistka nosníku – nosník může vypadnout, okamžitě vyprázdnit',
      photo: 'regal-chybi-pojistka',
    },
    'A2-05': {
      severity: 'amber',
      text: 'Chybí štítek s nosností',
      photo: 'regal-bez-stitku',
      failed: ['load_sign'],
    },
    'A3-04': {
      severity: 'amber',
      text: 'Chybí nebo je poškozené kotvení do podlahy',
      photo: 'regal-kotveni',
      failed: ['floor_anchoring'],
    },
    'Ž-03': {
      severity: 'red',
      text: 'Prasklá příčka – žebřík nevyhovuje, vyřazen z používání',
      photo: 'zebrik-praskla-pricka',
    },
    'Ž-06': {
      severity: 'green',
      text: 'Chybí protiskluzová patka – doplnit',
      photo: 'zebrik-chybi-patka',
    },
    'V-04': {
      severity: 'red',
      text: 'Prořezaný popruh – vázací prostředek nevyhovuje',
      photo: 'vazak-poskozeny',
    },
    'K-02': {
      severity: 'green',
      text: 'Povrchová koroze na nosníku – ošetřit nátěrem',
      photo: 'konstrukce-koroze',
    },
  };
  const unchecked = new Set([
    // Out of service since last year (natržený popruh): waits for the office.
    'V-02',
    'A3-05',
    'A3-06',
    'B1-03',
    'B1-04',
    'B1-05',
    'B1-06',
    'Ž-09',
    'Ž-10',
    'V-07',
    'V-08',
    'K-03',
    'PŽ-02',
  ]);
  for (const [i, item] of made.entries()) {
    if (unchecked.has(item.key)) continue;
    const day = i < 26 ? 2 : 1;
    // The office technician records a few too (two names in the protocol).
    const auth = i % 9 === 0 ? office : field;
    await record(current, item.key, at(day, 7 + (i % 9), (i * 11) % 60), now[item.key], auth);
  }
  await upload(field, 'hala-prehled', 'inspection', { inspectionId: current }, at(2, 7, 10));
  return true;
}
