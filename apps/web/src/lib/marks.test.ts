import { describe, expect, it } from 'vitest';
import { markGeometry, moveMark, newArrow, newCircle, rotateMark } from './marks.js';

describe('photo marks', () => {
  it('turns with the photo and comes back after four turns', () => {
    const arrow = newArrow(0.3, 0.4, 1600, 1200);
    let turned = arrow;
    for (let i = 0; i < 4; i++) turned = rotateMark(turned, true);
    expect(turned.kind).toBe('arrow');
    if (turned.kind === 'arrow' && arrow.kind === 'arrow') {
      expect(turned.tipX).toBeCloseTo(arrow.tipX);
      expect(turned.tailY).toBeCloseTo(arrow.tailY);
    }
    // A quarter turn clockwise: the left edge becomes the top.
    expect(rotateMark(newCircle(0, 0.5), true)).toMatchObject({ x: 0.5, y: 0 });
  });

  it('stays inside the photo when moved', () => {
    expect(moveMark(newCircle(0.9, 0.9), 0.5, 0.5)).toMatchObject({ x: 1, y: 1 });
  });

  it('draws an arrow as a shaft with a two-sided head and a circle as a ring', () => {
    const arrow = markGeometry(newArrow(0.5, 0.5, 1000, 800), 1000, 800);
    expect(arrow.lines).toHaveLength(3);
    expect(arrow.lines[0]!.slice(2)).toEqual([500, 400]);
    const ring = markGeometry(newCircle(0.5, 0.5), 1000, 800);
    expect(ring.circle).toMatchObject({ cx: 500, cy: 400, r: 0.12 * 800 });
  });
});
