import { describe, expect, it } from 'vitest';
import { isValidItemNumber, normalizeItemNumber } from './item-number.js';

describe('item number', () => {
  it('accepts exactly five digits', () => {
    expect(isValidItemNumber('01234')).toBe(true);
    expect(isValidItemNumber('1234')).toBe(false);
    expect(isValidItemNumber('123456')).toBe(false);
    expect(isValidItemNumber('12a45')).toBe(false);
  });

  it('normalizes and pads numeric input', () => {
    expect(normalizeItemNumber(' 42 ')).toBe('00042');
    expect(normalizeItemNumber('12345')).toBe('12345');
    expect(normalizeItemNumber('123456')).toBeNull();
    expect(normalizeItemNumber('abc')).toBeNull();
    expect(normalizeItemNumber('')).toBeNull();
  });
});
