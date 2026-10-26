import { fieldDefinitionsSchema, locationPath, newId, type LocationPath } from '@revize/shared';
import { count, eq } from 'drizzle-orm';
import { hashPassword } from '../auth/passwords.js';
import type { Db, Tx } from '../db/client.js';
import { appUser, customer, equipmentType, item, location, site } from '../db/schema.js';

export const DEMO_INSPECTOR = { email: 'technik@revize.local', password: 'technik-demo-heslo' };

const LADDER_FIELDS = fieldDefinitionsSchema.parse([
  { key: 'manufacturer', label: 'Výrobce', kind: 'text', required: true, order: 0 },
  {
    key: 'ladder_type',
    label: 'Typ žebříku',
    kind: 'select',
    required: true,
    options: ['Opěrný', 'Dvojitý', 'Schůdky', 'Výsuvný', 'Pojízdný'],
    order: 1,
  },
  { key: 'rungs', label: 'Počet příček', kind: 'integer', required: true, order: 2 },
  { key: 'max_load_kg', label: 'Max. zatížení', kind: 'integer', unit: 'kg', order: 3 },
  {
    key: 'material',
    label: 'Materiál',
    kind: 'select',
    options: ['Hliník', 'Ocel', 'Dřevo', 'Sklolaminát'],
    order: 4,
  },
  { key: 'year', label: 'Rok výroby', kind: 'integer', order: 5 },
]);

const RACK_FIELDS = fieldDefinitionsSchema.parse([
  { key: 'manufacturer', label: 'Výrobce', kind: 'text', required: true, order: 0 },
  {
    key: 'rack_type',
    label: 'Typ regálu',
    kind: 'select',
    required: true,
    options: ['Paletový', 'Policový', 'Konzolový', 'Vjezdový'],
    order: 1,
  },
  { key: 'height_mm', label: 'Výška', kind: 'integer', unit: 'mm', order: 2 },
  { key: 'bay_load_kg', label: 'Nosnost pole', kind: 'integer', unit: 'kg', order: 3 },
  { key: 'levels', label: 'Počet úrovní', kind: 'integer', order: 4 },
  { key: 'load_sign', label: 'Štítek nosnosti', kind: 'boolean', order: 5 },
  { key: 'year', label: 'Rok výroby', kind: 'integer', order: 6 },
]);

const LADDER_PROTOCOL = `Kontrola žebříků byla provedena vizuálně a funkčně v souladu s ČSN EN 131 a návodem výrobce.
Posuzován byl stav štěřin a příček, spojů, kloubů a závěsů, protiskluzových patek, pojistek proti rozevření a čitelnost označení.
Žebříky označené jako vyřazené z provozu nesmí být až do opravy a nové kontroly používány.`;

const RACK_PROTOCOL = `Kontrola regálových systémů byla provedena v souladu s ČSN EN 15635 (Skladovací systémy – Používání a údržba skladovacího zařízení).
Posuzován byl stav stojin, nosníků a jejich pojistek, kotvení, svislost, ochrana stojin a štítky nosnosti.
Poškození vyžadující okamžité odlehčení a vyřazení z provozu je v protokolu uvedeno jako vyřazení.`;

/**
 * Demo data for the prototype: inspector, the "Žebřík" and "Regál" types, one customer with a
 * site, a hall › row › position tree and 30 items. Item numbers and QR codes (R10001…) match the
 * printable test sheet of the QR spike. Skipped when the organization already has customers.
 */
export async function seedDemo(db: Db, organizationId: string): Promise<boolean> {
  const [existing] = await db
    .select({ value: count() })
    .from(customer)
    .where(eq(customer.organizationId, organizationId));
  if ((existing?.value ?? 0) > 0) return false;

  await db.transaction(async (tx) => {
    await tx
      .insert(appUser)
      .values({
        id: newId(),
        organizationId,
        email: DEMO_INSPECTOR.email,
        displayName: 'Jan Technik',
        role: 'inspector',
        passwordHash: await hashPassword(DEMO_INSPECTOR.password),
      })
      .onConflictDoNothing();

    const ladderId = newId();
    const rackId = newId();
    await tx.insert(equipmentType).values([
      {
        id: ladderId,
        organizationId,
        name: 'Žebřík',
        fieldDefinitions: LADDER_FIELDS,
        defaultIntervalMonths: 12,
        protocolTemplate: LADDER_PROTOCOL,
      },
      {
        id: rackId,
        organizationId,
        name: 'Regál',
        fieldDefinitions: RACK_FIELDS,
        defaultIntervalMonths: 12,
        protocolTemplate: RACK_PROTOCOL,
      },
    ]);

    const customerId = newId();
    await tx.insert(customer).values({
      id: customerId,
      organizationId,
      name: 'Ukázkový sklad s.r.o.',
      companyId: '12345678',
      address: 'Skladová 1, 602 00 Brno',
      contactName: 'Petra Skladníková',
      contactEmail: 'sklad@example.cz',
      contactPhone: '+420 600 000 000',
    });
    const siteId = newId();
    await tx.insert(site).values({
      id: siteId,
      organizationId,
      customerId,
      name: 'Provozovna Brno',
      address: 'Skladová 1, 602 00 Brno',
    });

    const positions = await createLocationTree(tx, organizationId, siteId);
    const year = new Date().getFullYear();
    await tx.insert(item).values(
      positions.slice(0, 30).map((locationId, i) => {
        const n = 10001 + i;
        const isLadder = i % 3 === 0;
        return {
          id: newId(),
          organizationId,
          customerId,
          siteId,
          locationId,
          equipmentTypeId: isLadder ? ladderId : rackId,
          itemNumber: String(n),
          qrCode: `R${n}`,
          fieldValues: isLadder
            ? {
                manufacturer: ['Krause', 'Alve', 'Hailo'][i % 3]!,
                ladder_type: ['Opěrný', 'Dvojitý', 'Schůdky'][i % 3]!,
                rungs: [6, 8, 10, 12][i % 4]!,
                max_load_kg: 150,
                material: 'Hliník',
                year: 2015 + (i % 9),
              }
            : {
                manufacturer: ['Mecalux', 'Stow', 'Jungheinrich'][i % 3]!,
                rack_type: ['Paletový', 'Policový', 'Konzolový'][i % 3]!,
                height_mm: [4500, 6000, 7500][i % 3]!,
                bay_load_kg: [2000, 3000, 4500][i % 3]!,
                levels: [3, 4, 5][i % 3]!,
                load_sign: i % 5 !== 0,
                year: 2012 + (i % 12),
              },
          nextInspectionDate: `${year}-${String(1 + (i % 12)).padStart(2, '0')}-15`,
        };
      }),
    );
  });
  return true;
}

/** Hala A–B › Řada 1–3 › Pozice 1–5; returns the position ids in location order. */
async function createLocationTree(tx: Tx, organizationId: string, siteId: string) {
  const positions: string[] = [];
  const add = async (
    parent: LocationPath | null,
    parentId: string | null,
    name: string,
    order: number,
  ) => {
    const id = newId();
    const path = locationPath(parent, id, order);
    await tx
      .insert(location)
      .values({ id, organizationId, siteId, parentId, name, sortOrder: order, ...path });
    return { id, path };
  };
  for (const [h, hallName] of ['Hala A', 'Hala B'].entries()) {
    const hall = await add(null, null, hallName, h + 1);
    for (let r = 1; r <= 3; r++) {
      const row = await add(hall.path, hall.id, `Řada ${r}`, r);
      for (let p = 1; p <= 5; p++)
        positions.push((await add(row.path, row.id, `Pozice ${p}`, p)).id);
    }
  }
  return positions;
}
