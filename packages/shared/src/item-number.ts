/** Item numbers are exactly five digits, unique within a customer. */
export const ITEM_NUMBER_LENGTH = 5;

const ITEM_NUMBER_PATTERN = /^\d{5}$/;

export function isValidItemNumber(value: string): boolean {
  return ITEM_NUMBER_PATTERN.test(value);
}

/**
 * Normalizes user or scanner input to an item number candidate:
 * trims whitespace and left-pads shorter numeric input ("42" -> "00042").
 * Returns null when the input cannot be an item number.
 */
export function normalizeItemNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return null;
  return trimmed.padStart(ITEM_NUMBER_LENGTH, '0');
}
