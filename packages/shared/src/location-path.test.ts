import { describe, expect, it } from 'vitest';
import { locationPath } from './location-path.js';

describe('locationPath', () => {
  it('builds ancestor ids and a sortable path', () => {
    const hall = locationPath(null, 'h', 1);
    const row = locationPath(hall, 'r', 12);
    const position = locationPath(row, 'p', 3);
    expect(position).toEqual({ pathIds: ['h', 'r', 'p'], sortPath: '000001.000012.000003' });
  });

  it('sorts numerically and parents before children', () => {
    const a = locationPath(null, 'a', 2);
    const paths = [
      locationPath(null, 'b', 10).sortPath,
      locationPath(a, 'c', 1).sortPath,
      a.sortPath,
    ].sort();
    expect(paths).toEqual(['000002', '000002.000001', '000010']);
  });

  it('rejects invalid sort orders', () => {
    expect(() => locationPath(null, 'x', -1)).toThrow(RangeError);
    expect(() => locationPath(null, 'x', 1.5)).toThrow(RangeError);
  });
});
