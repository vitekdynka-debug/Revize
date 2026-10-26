import { fieldDefinitionsSchema, type FieldDefinition } from '@revize/shared';

export const TYPE_NAMES = ['Regál', 'Žebřík'] as const;
export type TypeName = (typeof TYPE_NAMES)[number];

/** Equipment types with the same field definitions as the server demo seed (apps/api). */
export const EQUIPMENT_TYPES: Record<TypeName, FieldDefinition[]> = {
  Regál: fieldDefinitionsSchema.parse([
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
  ]),
  Žebřík: fieldDefinitionsSchema.parse([
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
  ]),
};

export interface CatalogItem {
  itemNumber: string;
  qrCode: string | null;
  type: TypeName;
  hall: string;
  row: number;
  position: number;
  fieldValues: Record<string, unknown>;
  lastInspection: { date: string; result: string } | null;
  nextInspection: string | null;
  /** Created in the field (stored in IndexedDB), not part of the demo catalog. */
  local?: { createdAt: string; inspectionId: string };
}

/** Item numbers used by the printable test sheet. */
export const FIRST_ITEM = 10001;
export const ITEM_COUNT = 50;

/** Base of label URLs, mirrors the phase-2 label format `https://<server>/q/<code>`. */
export const LABEL_URL_BASE = 'https://revize.example/q/';

export const MOCK_CUSTOMER = {
  name: 'Ukázkový sklad s.r.o.',
  site: 'Provozovna Brno – Hala A–C',
};

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]!;

export const MOCK_ITEMS: CatalogItem[] = Array.from({ length: ITEM_COUNT }, (_, i) => {
  const n = FIRST_ITEM + i;
  const type: TypeName = i % 3 === 0 ? 'Žebřík' : 'Regál';
  return {
    itemNumber: String(n),
    qrCode: `R${n}`,
    type,
    hall: String.fromCharCode(65 + Math.floor(i / 20)),
    row: 1 + (Math.floor(i / 5) % 4),
    position: 1 + (i % 5),
    fieldValues:
      type === 'Regál'
        ? {
            manufacturer: pick(['Mecalux', 'Stow', 'Jungheinrich', 'Kasten'], i),
            rack_type: pick(['Paletový', 'Policový', 'Konzolový'], i),
            height_mm: pick([4500, 6000, 7500, 9000], i),
            bay_load_kg: pick([2000, 3000, 4500], i),
            levels: pick([3, 4, 5, 6], i),
            load_sign: i % 5 !== 0,
            year: 2012 + (i % 12),
          }
        : {
            manufacturer: pick(['Krause', 'Alve', 'Hailo'], i),
            ladder_type: pick(['Dvojitý', 'Opěrný', 'Schůdky', 'Pojízdný'], i),
            rungs: pick([6, 8, 10, 12], i),
            max_load_kg: 150,
            material: pick(['Hliník', 'Ocel', 'Sklolaminát'], i),
            year: 2015 + (i % 9),
          },
    lastInspection:
      i % 7 === 6 ? null : { date: '2025-11-14', result: i % 9 === 4 ? 'Závada' : 'V pořádku' },
    nextInspection: '2026-11-14',
  };
});

export function locationLabel(item: CatalogItem): string {
  return `Hala ${item.hall} › Řada ${item.row} › Pozice ${item.position}`;
}

/** Sort key for "sorted by location": hall, row, position, then item number. */
export function compareByLocation(a: CatalogItem, b: CatalogItem): number {
  return (
    a.hall.localeCompare(b.hall) ||
    a.row - b.row ||
    a.position - b.position ||
    a.itemNumber.localeCompare(b.itemNumber)
  );
}

function formatValue(field: FieldDefinition, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'ano' : 'ne';
  if (Array.isArray(value)) return value.join(', ');
  if (field.kind === 'date' && typeof value === 'string') {
    return new Date(value).toLocaleDateString('cs-CZ');
  }
  const text = typeof value === 'number' ? value.toLocaleString('cs-CZ') : String(value);
  return field.unit ? `${text} ${field.unit}` : text;
}

/** Label/value pairs of the type's fields, in definition order (empty values skipped). */
export function displayFields(item: CatalogItem): [label: string, value: string][] {
  return EQUIPMENT_TYPES[item.type]
    .filter((field) => !field.archived)
    .sort((a, b) => a.order - b.order)
    .flatMap((field): [string, string][] => {
      const value = item.fieldValues[field.key];
      if (value === undefined || value === null || value === '') return [];
      return [[field.label, formatValue(field, value)]];
    });
}
