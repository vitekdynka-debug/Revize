import { parseScanPayload } from '@revize/shared';

export interface MockItem {
  itemNumber: string;
  qrCode: string;
  type: string;
  location: string;
}

/** Item numbers used by the printable test sheet. */
export const FIRST_ITEM = 10001;
export const ITEM_COUNT = 50;

/** Base of label URLs, mirrors the phase-2 label format `https://<server>/q/<code>`. */
export const LABEL_URL_BASE = 'https://revize.example/q/';

export const MOCK_ITEMS: MockItem[] = Array.from({ length: ITEM_COUNT }, (_, i) => {
  const n = FIRST_ITEM + i;
  const hall = String.fromCharCode(65 + Math.floor(i / 20));
  return {
    itemNumber: String(n),
    qrCode: `R${n}`,
    type: i % 3 === 0 ? 'Žebřík' : 'Regál',
    location: `Hala ${hall} › Řada ${1 + (Math.floor(i / 5) % 4)} › Pozice ${1 + (i % 5)}`,
  };
});

const byNumber = new Map(MOCK_ITEMS.map((item) => [item.itemNumber, item]));
const byQr = new Map(MOCK_ITEMS.map((item) => [item.qrCode, item]));

export function findItem(raw: string): MockItem | null {
  const target = parseScanPayload(raw);
  if (!target) return null;
  return target.kind === 'itemNumber'
    ? (byNumber.get(target.itemNumber) ?? null)
    : (byQr.get(target.code) ?? null);
}
