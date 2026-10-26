import { normalizeItemNumber } from './item-number.js';

/**
 * What a scanned code (camera QR or Bluetooth keyboard-wedge scanner) refers to.
 *
 * - `qr`: an opaque QR code value stored in `item.qr_code` (does not have to equal the item number).
 * - `itemNumber`: the payload looks like a plain 5-digit item number.
 *
 * Labels printed in phase 2 will encode a URL `https://<host>/q/<code>` so that the iOS camera
 * app can open the application directly; the code is extracted from the path.
 */
export type ScanTarget = { kind: 'qr'; code: string } | { kind: 'itemNumber'; itemNumber: string };

// scheme://host[:port]/any/prefix/q/<code>[/][?query][#hash]
const QR_URL = /^https?:\/\/[^/?#]+(?:\/[^?#]*)?\/q\/([^/?#]+)\/?(?:[?#].*)?$/i;

export function parseScanPayload(raw: string): ScanTarget | null {
  const value = raw.trim();
  if (value === '') return null;

  const fromUrl = extractCodeFromUrl(value);
  if (fromUrl !== null) return { kind: 'qr', code: fromUrl };

  if (/^\d{5}$/.test(value)) {
    const itemNumber = normalizeItemNumber(value);
    if (itemNumber !== null) return { kind: 'itemNumber', itemNumber };
  }

  return { kind: 'qr', code: value };
}

function extractCodeFromUrl(value: string): string | null {
  const encoded = QR_URL.exec(value)?.[1];
  if (encoded === undefined) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
