import { describe, expect, it } from 'vitest';
import { equipmentTypePreset } from '../equipment-presets.js';
import { importMappingSchema, mappingHeaders, suggestMapping } from './mapping.js';

const ladder = equipmentTypePreset('portable_ladder')!.fieldDefinitions;

describe('suggestMapping', () => {
  it('maps standard headers and field labels, location columns in sheet order', () => {
    const headers = [
      'Ev. číslo',
      'Hala',
      'Řada',
      'Pozice',
      'Výrobce',
      'typ zebriku',
      'Příští revize',
      'Poznámka',
      'Něco',
    ];
    const suggested = suggestMapping(headers, ladder);
    expect(suggested.itemNumber).toBe(0);
    expect(suggested.location).toEqual([1, 2, 3]);
    expect(suggested.nextInspectionDate).toBe(6);
    expect(suggested.fields.manufacturer).toBe(4);
    expect(suggested.fields.ladder_type).toBe(5);
    expect(suggested.fields.note).toBe(7);
    expect(suggested.fields.rungs).toBeNull();
  });

  it('matches a header that is the start of a field label', () => {
    const suggested = suggestMapping(['Počet příček', 'Max. délka', 'Typ'], ladder);
    expect(suggested.fields.rungs).toBe(0);
    expect(suggested.fields.length_m).toBe(1);
    expect(suggested.fields.ladder_type).toBeNull(); // "Typ" is too short to guess
  });

  it('prefers a saved mapping by header name', () => {
    const headers = ['Kód', 'Značka', 'Výrobce'];
    const suggested = suggestMapping(headers, ladder, {
      itemNumber: 'Kód',
      'field:manufacturer': 'Značka',
    });
    expect(suggested.itemNumber).toBe(0);
    expect(suggested.fields.manufacturer).toBe(1);
  });

  it('round-trips header names of a mapping', () => {
    const headers = ['Číslo', 'Umístění', 'Výrobce'];
    const mapping = importMappingSchema.parse({
      siteId: '0195f1a2-0000-7000-8000-000000000001',
      equipmentTypeId: '0195f1a2-0000-7000-8000-000000000002',
      itemNumber: 0,
      location: [1],
      fields: { manufacturer: 2 },
    });
    expect(mappingHeaders(mapping, headers)).toMatchObject({
      itemNumber: 'Číslo',
      location: ['Umístění'],
      'field:manufacturer': 'Výrobce',
    });
  });
});
