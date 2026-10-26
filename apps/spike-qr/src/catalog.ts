import { isValidItemNumber, parseScanPayload } from '@revize/shared';
import { db, type LocalItemRow } from './db.js';
import { MOCK_ITEMS, compareByLocation, type CatalogItem } from './mock-items.js';

/**
 * Items of the current customer: the demo catalog plus items created in the field.
 * Kept in memory for instant lookups (scanner, keypad); `refreshCatalog()` reloads the local part.
 */
let items: CatalogItem[] = [...MOCK_ITEMS];
let byNumber = new Map<string, CatalogItem>();
let byQr = new Map<string, CatalogItem>();

function index() {
  byNumber = new Map(items.map((item) => [item.itemNumber, item]));
  byQr = new Map(items.filter((i) => i.qrCode).map((item) => [item.qrCode!, item]));
}
index();

export async function refreshCatalog(): Promise<void> {
  const local = await db.items.toArray();
  items = [...MOCK_ITEMS, ...local].sort(compareByLocation);
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
  return target.kind === 'itemNumber'
    ? (byNumber.get(target.itemNumber) ?? null)
    : (byQr.get(target.code) ?? null);
}

/** QR label content as stored on the item: the code from a label URL, or the raw text. */
export function qrCodeFromScan(raw: string): string | null {
  const target = parseScanPayload(raw);
  if (!target) return null;
  return target.kind === 'qr' ? target.code : target.itemNumber;
}

/** Next free item number above the highest one in use (the server will assign it later). */
export function nextFreeItemNumber(): string {
  const highest = Math.max(0, ...items.map((item) => Number(item.itemNumber)));
  for (let n = highest + 1; n <= 99999; n++) {
    const candidate = String(n).padStart(5, '0');
    if (!byNumber.has(candidate)) return candidate;
  }
  throw new Error('Došla volná čísla artiklů');
}

export type ItemNumberProblem = 'invalid' | 'taken' | null;

export function checkItemNumber(itemNumber: string): ItemNumberProblem {
  if (!isValidItemNumber(itemNumber)) return 'invalid';
  return byNumber.has(itemNumber) ? 'taken' : null;
}

export function isQrCodeTaken(qrCode: string): boolean {
  return byQr.has(qrCode);
}

export async function addLocalItem(item: LocalItemRow): Promise<void> {
  await db.items.add(item);
  await refreshCatalog();
}
