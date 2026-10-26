import type { Size } from './crop.js';
import type { DecodedCode } from './types.js';

/**
 * Chooses the code the technician is aiming at: the one closest to the frame center.
 * Codes whose center lies farther than `maxOffset` (fraction of the shorter frame side) from the
 * center are ignored, so a neighbouring label at the edge of the scan area is never picked.
 * When several codes have no position information the read is ambiguous and null is returned.
 */
export function pickCentralCode(
  codes: readonly DecodedCode[],
  frame: Size,
  maxOffset = 0.3,
): DecodedCode | null {
  if (codes.length === 0) return null;
  const positioned = codes.filter((code) => code.center !== undefined);
  if (positioned.length === 0) return codes.length === 1 ? codes[0]! : null;

  const cx = frame.width / 2;
  const cy = frame.height / 2;
  const limit = Math.min(frame.width, frame.height) * maxOffset;
  let best: DecodedCode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const code of positioned) {
    const distance = Math.hypot(code.center!.x - cx, code.center!.y - cy);
    if (distance <= limit && distance < bestDistance) {
      best = code;
      bestDistance = distance;
    }
  }
  return best;
}
