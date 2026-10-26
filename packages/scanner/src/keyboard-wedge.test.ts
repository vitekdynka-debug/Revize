import { describe, expect, it } from 'vitest';
import { KeyboardWedgeDetector } from './keyboard-wedge.js';

function type(detector: KeyboardWedgeDetector, keys: string[], start: number, gap: number) {
  let result: string | null = null;
  keys.forEach((key, i) => {
    result = detector.feed(key, start + i * gap) ?? result;
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

  it('drops a slow prefix and keeps the fast burst', () => {
    const d = new KeyboardWedgeDetector();
    d.feed('x', 0);
    expect(type(d, [...'ABC123', 'Enter'], 1000, 5)).toBe('ABC123');
  });

  it('ignores non-character keys and too short input', () => {
    const d = new KeyboardWedgeDetector();
    expect(type(d, ['Shift', 'A', 'B', 'Enter'], 0, 5)).toBeNull();
    expect(type(d, ['Shift', 'A', 'B', 'C', 'Enter'], 100, 5)).toBe('ABC');
  });
});
