import { describe, expect, it } from 'vitest';
import { ScanDeduper } from './dedupe.js';

describe('ScanDeduper', () => {
  it('ignores the same code within the cooldown', () => {
    const d = new ScanDeduper(2500);
    expect(d.accept('A', 0)).toBe(true);
    expect(d.accept('A', 1000)).toBe(false);
    expect(d.accept('A', 3000)).toBe(false); // still in view, window extended
    expect(d.accept('A', 6000)).toBe(true);
  });

  it('accepts a different code immediately', () => {
    const d = new ScanDeduper(2500);
    expect(d.accept('A', 0)).toBe(true);
    expect(d.accept('B', 100)).toBe(true);
    expect(d.accept('A', 200)).toBe(true);
  });

  it('can be reset', () => {
    const d = new ScanDeduper(2500);
    d.accept('A', 0);
    d.reset();
    expect(d.accept('A', 10)).toBe(true);
  });
});
