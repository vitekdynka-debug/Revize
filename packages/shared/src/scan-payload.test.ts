import { describe, expect, it } from 'vitest';
import { parseScanPayload } from './scan-payload.js';

describe('parseScanPayload', () => {
  it('treats a 5-digit payload as an item number', () => {
    expect(parseScanPayload('01234\n')).toEqual({ kind: 'itemNumber', itemNumber: '01234' });
  });

  it('extracts the code from a label URL', () => {
    expect(parseScanPayload('https://revize.example.ts.net/q/AB12CD')).toEqual({
      kind: 'qr',
      code: 'AB12CD',
    });
    expect(parseScanPayload('https://host/app/q/X%2F1/?src=label')).toEqual({
      kind: 'qr',
      code: 'X/1',
    });
  });

  it('keeps any other payload as an opaque QR code', () => {
    expect(parseScanPayload('REG-0001')).toEqual({ kind: 'qr', code: 'REG-0001' });
    expect(parseScanPayload('https://example.com/other')).toEqual({
      kind: 'qr',
      code: 'https://example.com/other',
    });
  });

  it('ignores empty input', () => {
    expect(parseScanPayload('   ')).toBeNull();
  });
});
