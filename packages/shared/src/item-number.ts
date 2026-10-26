/**
 * Item numbers are numeric series of different lengths – a site may have 4- and 5-digit
 * series side by side. Leading zeros carry no meaning: "01234" is the same item as "1234"
 * (on the keypad a 4-digit number is typed with a leading 0 so that lookup can fire after
 * the 5th digit). Numbers are stored in canonical form, without leading zeros (ADR-0012).
 */
export const ITEM_NUMBER_MAX_LENGTH = 8;

/** The keypad looks up automatically after this many digits; shorter numbers are confirmed. */
export const KEYPAD_AUTO_LENGTH = 5;

const DIGITS = /^\d{1,8}$/;

/** Canonical form ("01234" → "1234"), or null when the input is not an item number. */
export function canonicalItemNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!DIGITS.test(trimmed)) return null;
  const canonical = trimmed.replace(/^0+/, '');
  return canonical === '' ? null : canonical;
}

/** A stored item number: digits without leading zeros, at most 8 digits, not zero. */
export function isValidItemNumber(value: string): boolean {
  return /^[1-9]\d{0,7}$/.test(value);
}

/** Numeric order of item numbers (so that "999" sorts before "1000"). */
export function compareItemNumbers(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b);
}
