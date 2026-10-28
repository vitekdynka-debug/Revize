import { describe, expect, it } from 'vitest';
import { fieldDefinitionsSchema } from '../equipment-fields.js';
import { convertCell, normalizeText, parseCzechNumber, parseDate } from './cells.js';

const [text, integer, number, bool, date, select, multi] = fieldDefinitionsSchema.parse([
  { key: 't', label: 'Text', kind: 'text', order: 0 },
  { key: 'i', label: 'Celé', kind: 'integer', order: 1 },
  { key: 'n', label: 'Číslo', kind: 'number', order: 2 },
  { key: 'b', label: 'Ano/ne', kind: 'boolean', order: 3 },
  { key: 'd', label: 'Datum', kind: 'date', order: 4 },
  { key: 's', label: 'Výběr', kind: 'select', options: ['Opěrný', 'Dvojitý (štaflový)'], order: 5 },
  { key: 'm', label: 'Více', kind: 'multiselect', options: ['A', 'B'], order: 6 },
]);

describe('cell conversion', () => {
  it('normalizes texts for matching', () => {
    expect(normalizeText('  Číslo artiklu: ')).toBe('cislo artiklu');
  });

  it('parses Czech numbers', () => {
    expect(parseCzechNumber('1 234,5')).toBe(1234.5);
    expect(parseCzechNumber('1 500')).toBe(1500);
    expect(parseCzechNumber('2.5')).toBe(2.5);
    expect(parseCzechNumber('12 kg')).toBeNull();
  });

  it('parses dates in common formats', () => {
    expect(parseDate('31.12.2026')).toBe('2026-12-31');
    expect(parseDate('1. 3. 2027')).toBe('2027-03-01');
    expect(parseDate('2026-11-14')).toBe('2026-11-14');
    expect(parseDate('11/2026')).toBe('2026-11-01');
    expect(parseDate(46340)).toBe('2026-11-14'); // Excel serial
    expect(parseDate(new Date(Date.UTC(2026, 10, 14)))).toBe('2026-11-14');
    expect(parseDate('31.2.2026')).toBeNull();
  });

  it('converts values per field kind', () => {
    expect(convertCell(text!, ' Alve ')).toEqual({ ok: true, value: 'Alve' });
    expect(convertCell(integer!, '12')).toEqual({ ok: true, value: 12 });
    expect(convertCell(integer!, '12,5')).toMatchObject({ ok: false });
    expect(convertCell(number!, '5,6')).toEqual({ ok: true, value: 5.6 });
    expect(convertCell(bool!, 'ANO')).toEqual({ ok: true, value: true });
    expect(convertCell(bool!, 'x')).toEqual({ ok: true, value: true });
    expect(convertCell(bool!, 'ne')).toEqual({ ok: true, value: false });
    expect(convertCell(bool!, 'možná')).toMatchObject({ ok: false });
    expect(convertCell(date!, '14.11.2026')).toEqual({ ok: true, value: '2026-11-14' });
    expect(convertCell(select!, 'operny')).toEqual({ ok: true, value: 'Opěrný' });
    expect(convertCell(select!, 'dvojity (staflovy)')).toEqual({
      ok: true,
      value: 'Dvojitý (štaflový)',
    });
    expect(convertCell(select!, 'Kolo')).toMatchObject({
      ok: false,
      error: expect.stringContaining('není v číselníku'),
    });
    expect(convertCell(multi!, 'a; B')).toEqual({ ok: true, value: ['A', 'B'] });
    expect(convertCell(text!, '')).toEqual({ ok: true, value: null });
  });
});
