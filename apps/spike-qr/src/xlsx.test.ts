import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildXlsx, columnName } from './xlsx.js';

describe('xlsx writer', () => {
  it('names columns like Excel', () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(columnName)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'ZZ',
      'AAA',
    ]);
  });

  it('writes a workbook with escaped inline strings, numbers and a frozen header', () => {
    const files = unzipSync(
      buildXlsx([
        {
          name: 'Výsledky',
          header: true,
          widths: [10, 40],
          rows: [
            ['Číslo', 'Popis'],
            [10001, 'Ohnutý <příčník> & "pojistka"'],
            [10002, null],
          ],
        },
        { name: 'Souhrn: kontrola?', rows: [['Zákazník', 'Ukázkový sklad']] },
      ]),
    );
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet2.xml',
      ]),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('<c r="A2" s="2"><v>10001</v></c>');
    expect(sheet).toContain('Ohnutý &lt;příčník&gt; &amp; &quot;pojistka&quot;');
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<autoFilter ref="A1:B3"/>');
    expect(strFromU8(files['xl/workbook.xml']!)).toContain('name="Souhrn  kontrola "');
  });
});
