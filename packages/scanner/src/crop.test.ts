import { describe, expect, it } from 'vitest';
import { computeCropRect, fitWithin } from './crop.js';

describe('computeCropRect', () => {
  it('maps a centered square for a landscape video on a portrait display', () => {
    // 1920x1080 video covering a 768x1024 display: scale = 1024/1080, visible width ≈ 810 px.
    const rect = computeCropRect({ width: 1920, height: 1080 }, { width: 768, height: 1024 }, 0.6);
    expect(rect.width).toBe(rect.height);
    expect(rect.width).toBe(Math.round((768 / (1024 / 1080)) * 0.6));
    expect(rect.x + rect.width / 2).toBeCloseTo(960, 0);
    expect(rect.y + rect.height / 2).toBeCloseTo(540, 0);
  });

  it('uses the full shorter visible side at fraction 1', () => {
    const rect = computeCropRect({ width: 1280, height: 720 }, { width: 1280, height: 720 }, 1);
    expect(rect).toEqual({ x: 280, y: 0, width: 720, height: 720 });
  });
});

describe('fitWithin', () => {
  it('scales down only', () => {
    expect(fitWithin({ width: 1000, height: 500 }, 720)).toEqual({ width: 720, height: 360 });
    expect(fitWithin({ width: 400, height: 400 }, 720)).toEqual({ width: 400, height: 400 });
  });
});
