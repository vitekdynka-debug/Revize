import { describe, expect, it } from 'vitest';
import { KeyboardWedgeDetector } from './keyboard-wedge.js';

function type(
  detector: KeyboardWedgeDetector,
  keys: string[],
  start: number,
  gap: number | number[],
) {
  let result: string | null = null;
  let at = start;
  keys.forEach((key, i) => {
    if (i > 0) at += Array.isArray(gap) ? (gap[i - 1] ?? 10) : gap;
    result = detector.feed(key, at) ?? result;
  });
  return result;
}

describe('KeyboardWedgeDetector', () => {
  it('detects a fast burst terminated by Enter', () => {
    const d = new KeyboardWedgeDetector();
    expect(type(d, [...'10001', 'Enter'], 0, 10)).toBe('10001');
  });

  it('ignores human typing speed', () => {
    const d = new KeyboardWedgeDetector();
    expect(type(d, [...'10001', 'Enter'], 0, 150)).toBeNull();
  });

  it('tolerates a single Bluetooth hiccup inside a long code', () => {
    const d = new KeyboardWedgeDetector();
    const code = 'https://revize.example/q/R10001';
    const gaps = [...code].map((_, i) => (i === 4 ? 180 : 8)); // pause after "http"
    expect(type(d, [...code, 'Enter'], 0, gaps)).toBe(code);
  });

  it('drops a slow prefix after a human pause and keeps the fast burst', () => {
    const d = new KeyboardWedgeDetector();
    d.feed('x', 0);
    expect(type(d, [...'ABC123', 'Enter'], 1000, 5)).toBe('ABC123');
  });

  it('ignores non-character keys and too short input', () => {
    const d = new KeyboardWedgeDetector();
    expect(type(d, ['Shift', 'A', 'B', 'Enter'], 0, 5)).toBeNull();
    expect(type(d, ['Shift', 'A', 'B', 'C', 'Enter'], 1000, 5)).toBe('ABC');
  });
});
