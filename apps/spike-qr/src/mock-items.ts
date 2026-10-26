import { parseScanPayload } from '@revize/shared';

export interface MockItem {
  itemNumber: string;
  qrCode: string;
  type: 'Regál' | 'Žebřík';
  hall: string;
  row: number;
  position: number;
  /** Type-specific fields, in display order (stands in for equipment type field definitions). */
  fields: [label: string, value: string][];
  lastInspection: { date: string; result: string } | null;
  nextInspection: string;
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

function rackFields(i: number): [string, string][] {
  return [
    ['Výrobce', pick(['Mecalux', 'Stow', 'Jungheinrich', 'Kasten'], i)],
    ['Typ regálu', pick(['Paletový', 'Policový', 'Konzolový'], i)],
    ['Výška', `${pick([4500, 6000, 7500, 9000], i)} mm`],
    ['Nosnost pole', `${pick([2000, 3000, 4500], i)} kg`],
    ['Počet úrovní', String(pick([3, 4, 5, 6], i))],
    ['Rok výroby', String(2012 + (i % 12))],
  ];
}

function ladderFields(i: number): [string, string][] {
  return [
    ['Výrobce', pick(['Krause', 'Alve', 'Hailo'], i)],
    ['Typ žebříku', pick(['Dvojitý', 'Opěrný', 'Schůdky', 'Pojízdný'], i)],
    ['Počet příček', String(pick([6, 8, 10, 12], i))],
    ['Max. zatížení', '150 kg'],
    ['Materiál', pick(['Hliník', 'Ocel', 'Sklolaminát'], i)],
    ['Rok výroby', String(2015 + (i % 9))],
  ];
}

export const MOCK_ITEMS: MockItem[] = Array.from({ length: ITEM_COUNT }, (_, i) => {
  const n = FIRST_ITEM + i;
  const type = i % 3 === 0 ? 'Žebřík' : 'Regál';
  return {
    itemNumber: String(n),
    qrCode: `R${n}`,
    type,
    hall: String.fromCharCode(65 + Math.floor(i / 20)),
    row: 1 + (Math.floor(i / 5) % 4),
    position: 1 + (i % 5),
    fields: type === 'Regál' ? rackFields(i) : ladderFields(i),
    lastInspection:
      i % 7 === 6 ? null : { date: '2025-11-14', result: i % 9 === 4 ? 'Závada' : 'V pořádku' },
    nextInspection: '2026-11-14',
  };
});

export function locationLabel(item: MockItem): string {
  return `Hala ${item.hall} › Řada ${item.row} › Pozice ${item.position}`;
}

/** Sort key for "sorted by location": hall, row, position. */
export function compareByLocation(a: MockItem, b: MockItem): number {
  return a.hall.localeCompare(b.hall) || a.row - b.row || a.position - b.position;
}

const byNumber = new Map(MOCK_ITEMS.map((item) => [item.itemNumber, item]));
const byQr = new Map(MOCK_ITEMS.map((item) => [item.qrCode, item]));

export function findItem(raw: string): MockItem | null {
  const target = parseScanPayload(raw);
  if (!target) return null;
  return target.kind === 'itemNumber'
    ? (byNumber.get(target.itemNumber) ?? null)
    : (byQr.get(target.code) ?? null);
}

export function itemByNumber(itemNumber: string): MockItem | null {
  return byNumber.get(itemNumber) ?? null;
}
