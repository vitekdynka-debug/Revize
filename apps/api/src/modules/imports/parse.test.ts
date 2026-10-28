import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { decodeText, detectDelimiter, parseSpreadsheet } from './parse.js';

describe('decodeText', () => {
  it('reads UTF-8 with BOM and Windows-1250', () => {
    expect(decodeText(Buffer.from('﻿Žebřík', 'utf8'))).toBe('Žebřík');
    // "Žebřík; Výrobce" encoded in Windows-1250
    const cp1250 = Buffer.from([
      0x8e, 0x65, 0x62, 0xf8, 0xed, 0x6b, 0x3b, 0x56, 0xfd, 0x72, 0x6f, 0x62, 0x63, 0x65,
    ]);
    expect(decodeText(cp1250)).toBe('Žebřík;Výrobce');
  });
});

describe('detectDelimiter', () => {
  it('counts delimiters outside quotes', () => {
    expect(detectDelimiter('Číslo;Výrobce;Pozn')).toBe(';');
    expect(detectDelimiter('"a,b";"c,d";e')).toBe(';');
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a\tb')).toBe('\t');
    expect(detectDelimiter('jediny')).toBe(',');
  });
});

describe('parseSpreadsheet', () => {
  it('parses Czech CSV with semicolons, skips leading and trailing empty lines', async () => {
    const csv = '\n"Číslo";"Výrobce";"Poznámka"\n10001;Alve;"a; b"\n04001;Krause;\n\n\n';
    const parsed = await parseSpreadsheet('seznam.csv', Buffer.from(csv, 'utf8'));
    expect(parsed).toMatchObject({
      headerRow: 2,
      headers: ['Číslo', 'Výrobce', 'Poznámka'],
      rows: [
        ['10001', 'Alve', 'a; b'],
        ['04001', 'Krause', ''],
      ],
    });
  });

  it('parses XLSX with numbers, dates, formulas and rich text', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Prázdný');
    const sheet = workbook.addWorksheet('Artikly');
    sheet.addRow(['Číslo', 'Výrobce', 'Příští kontrola', 'Výška', '']);
    sheet.addRow([
      10001,
      { richText: [{ text: 'Al' }, { text: 've' }] },
      new Date(Date.UTC(2026, 10, 14)),
      { formula: '2*3', result: 6 },
    ]);
    sheet.addRow([]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const parsed = await parseSpreadsheet('data.xlsx', buffer);
    expect(parsed.sheets).toEqual(['Prázdný', 'Artikly']);
    expect(parsed.sheet).toBe('Artikly');
    expect(parsed.headers).toEqual(['Číslo', 'Výrobce', 'Příští kontrola', 'Výška']);
    expect(parsed.rows).toEqual([[10001, 'Alve', '2026-11-14', 6]]);
  });

  it('rejects old .xls and unknown files with a helpful message', async () => {
    await expect(parseSpreadsheet('stary.xls', Buffer.from(''))).rejects.toThrow('.xls');
    await expect(parseSpreadsheet('obrazek.png', Buffer.from(''))).rejects.toThrow('XLSX a CSV');
    await expect(parseSpreadsheet('rozbite.xlsx', Buffer.from('nic'))).rejects.toThrow(
      'nelze přečíst',
    );
  });
});
