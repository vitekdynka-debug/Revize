import { canonicalItemNumber } from './item-number.js';

/**
 * What a scanned code (camera QR or Bluetooth keyboard-wedge scanner) refers to.
 *
 * - `qr`: an opaque QR code value stored in `item.qr_code` (does not have to equal the item number).
 * - `digits`: a purely numeric payload. It may be a QR code value or an item number, so lookups
 *   try the QR code first and then the item number (`itemNumber`, canonical form).
 *
 * Labels printed in phase 2 will encode a URL `https://<host>/q/<code>` so that the iOS camera
 * app can open the application directly; the code is extracted from the path.
 */
export type ScanTarget =
  { kind: 'qr'; code: string } | { kind: 'digits'; code: string; itemNumber: string };

// scheme://host[:port]/any/prefix/q/<code>[/][?query][#hash]
const QR_URL = /^https?:\/\/[^/?#]+(?:\/[^?#]*)?\/q\/([^/?#]+)\/?(?:[?#].*)?$/i;

export function parseScanPayload(raw: string): ScanTarget | null {
  const value = raw.trim();
  if (value === '') return null;

  const fromUrl = extractCodeFromUrl(value);
  if (fromUrl !== null) return { kind: 'qr', code: fromUrl };

  const itemNumber = canonicalItemNumber(value);
  if (itemNumber !== null) return { kind: 'digits', code: value, itemNumber };

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
