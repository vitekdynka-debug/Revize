import { describe, expect, it } from 'vitest';
import { pickCentralCode } from './pick.js';

const frame = { width: 600, height: 600 };

describe('pickCentralCode', () => {
  it('picks the code closest to the center', () => {
    const codes = [
      { text: 'LEFT', format: 'QRCode', center: { x: 200, y: 300 } },
      { text: 'MIDDLE', format: 'QRCode', center: { x: 310, y: 290 } },
    ];
    expect(pickCentralCode(codes, frame)?.text).toBe('MIDDLE');
  });

  it('ignores codes outside the central zone', () => {
    const codes = [{ text: 'EDGE', format: 'QRCode', center: { x: 40, y: 300 } }];
    expect(pickCentralCode(codes, frame)).toBeNull();
  });

  it('accepts a single code without position, rejects ambiguous ones', () => {
    expect(pickCentralCode([{ text: 'A', format: 'QRCode' }], frame)?.text).toBe('A');
    expect(
      pickCentralCode(
        [
          { text: 'A', format: 'QRCode' },
          { text: 'B', format: 'QRCode' },
        ],
        frame,
      ),
    ).toBeNull();
  });
});
