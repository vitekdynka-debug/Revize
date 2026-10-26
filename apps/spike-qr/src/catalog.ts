import { canonicalItemNumber, compareItemNumbers, parseScanPayload } from '@revize/shared';
import { db, type LocalItemRow } from './db.js';
import {
  MOCK_ITEMS,
  MOCK_ITEMS_4_DIGIT,
  compareByLocation,
  type CatalogItem,
} from './mock-items.js';

/**
 * Items of the current customer: the demo catalog plus items created in the field.
 * Kept in memory for instant lookups (scanner, keypad); `refreshCatalog()` reloads the local part.
 */
const DEMO_ITEMS = [...MOCK_ITEMS, ...MOCK_ITEMS_4_DIGIT];
let items: CatalogItem[] = [...DEMO_ITEMS].sort(compareByLocation);
let byNumber = new Map<string, CatalogItem>();
let byQr = new Map<string, CatalogItem>();

function index() {
  byNumber = new Map(items.map((item) => [item.itemNumber, item]));
  byQr = new Map(items.filter((i) => i.qrCode).map((item) => [item.qrCode!, item]));
}
index();

export async function refreshCatalog(): Promise<void> {
  const local = await db.items.toArray();
  items = [...DEMO_ITEMS, ...local].sort(compareByLocation);
  index();
}

/** Resolves once the field-created items are loaded (lookups before that would miss them). */
export const catalogReady: Promise<void> = refreshCatalog().catch(() => undefined);

export function allItems(): readonly CatalogItem[] {
  return items;
}

export function itemByNumber(itemNumber: string): CatalogItem | null {
  return byNumber.get(itemNumber) ?? null;
}

export function findItem(raw: string): CatalogItem | null {
  const target = parseScanPayload(raw);
  if (!target) return null;
  // A numeric payload may be a QR code value as well as an item number: QR code wins.
  const byCode = byQr.get(target.code) ?? null;
  if (target.kind === 'qr') return byCode;
  return byCode ?? byNumber.get(target.itemNumber) ?? null;
}

/** QR label content as stored on the item: the code from a label URL, or the raw text. */
export function qrCodeFromScan(raw: string): string | null {
  const target = parseScanPayload(raw);
  if (!target) return null;
  return target.code;
}

/** Next free number above the highest one of the longest series in use (server assigns later). */
export function nextFreeItemNumber(): string {
  const numbers = items.map((item) => item.itemNumber).sort(compareItemNumbers);
  for (let n = Number(numbers.at(-1) ?? '0') + 1; n <= 99_999_999; n++) {
    if (!byNumber.has(String(n))) return String(n);
  }
  throw new Error('Došla volná čísla artiklů');
}

export type ItemNumberCheck =
  { ok: true; itemNumber: string } | { ok: false; problem: 'invalid' | 'taken' };

/** Validates a typed number and returns its canonical form ("01234" → "1234"). */
export function checkItemNumber(input: string): ItemNumberCheck {
  const itemNumber = canonicalItemNumber(input);
  if (!itemNumber) return { ok: false, problem: 'invalid' };
  return byNumber.has(itemNumber) ? { ok: false, problem: 'taken' } : { ok: true, itemNumber };
}

export function isQrCodeTaken(qrCode: string): boolean {
  return byQr.has(qrCode);
}

export async function addLocalItem(item: LocalItemRow): Promise<void> {
  await db.items.add(item);
  await refreshCatalog();
}
