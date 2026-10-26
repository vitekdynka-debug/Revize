import { describe, expect, it } from 'vitest';
import { StableReadFilter } from './stable-read.js';

describe('StableReadFilter', () => {
  it('confirms after the required number of hits', () => {
    const f = new StableReadFilter(3, 600);
    expect(f.push('A', 0)).toBeNull();
    expect(f.push(null, 50)).toBeNull();
    expect(f.push('A', 100)).toBeNull();
    expect(f.push('A', 200)).toBe('A');
  });

  it('restarts when a different code appears', () => {
    const f = new StableReadFilter(2, 600);
    f.push('A', 0);
    expect(f.push('B', 50)).toBeNull();
    expect(f.push('B', 100)).toBe('B');
  });

  it('forgets hits outside the window', () => {
    const f = new StableReadFilter(2, 300);
    f.push('A', 0);
    expect(f.push('A', 500)).toBeNull();
    expect(f.push('A', 600)).toBe('A');
  });

  it('with one required hit confirms immediately', () => {
    expect(new StableReadFilter(1, 300).push('A', 0)).toBe('A');
  });
});
