import { describe, expect, it } from 'vitest';
import {
  APPENDIX_WIDTH,
  appendixColumnWidths,
  choosePhotoLayout,
  defectPages,
  tableRowHeight,
} from './protocol-layout.js';

const card = (photos: number) => ({ photos, titleLength: 30, descriptionLength: 40 });
/** One severity with one workplace. */
const one = (cards: ReturnType<typeof card>[]) => [[cards]];

describe('protocol layout', () => {
  it('estimates taller rows for long notes', () => {
    const item = {
      itemNumber: '1',
      designation: 'Ž-01',
      location: 'Hala A',
      details: 'Alve',
      outcome: 'amber' as const,
      defectDescription: null,
      photos: [],
    };
    expect(tableRowHeight(item, [])).toBeLessThan(10);
    expect(tableRowHeight(item, ['x'.repeat(200)])).toBeGreaterThan(15);
  });

  it('prefers 5 cm photos while the protocol stays within 8 pages', () => {
    expect(choosePhotoLayout(one([card(1), card(2)]))).toMatchObject({ photoHeight: 50 });
    const forty = Array.from({ length: 40 }, () => card(1));
    const layout = choosePhotoLayout(one(forty));
    expect(layout.photoHeight).toBe(50);
    expect(layout.total).toBeLessThanOrEqual(8);
  });

  it('goes down to the smallest sizes (3.5 cm, more columns) only beyond 8 pages', () => {
    const many = Array.from({ length: 150 }, () => card(1));
    const layout = choosePhotoLayout(one(many));
    // The fewest pages, with the minimal sizes.
    expect(layout).toMatchObject({ photoHeight: 35, columns: 3 });
    expect(defectPages(one(many), 50, 3)).toBeGreaterThan(layout.pages);
    // Pages of the rest of the protocol count too.
    expect(
      choosePhotoLayout(one(Array.from({ length: 30 }, () => card(1))), 0, 0, (n) => n + 6)
        .photoHeight,
    ).toBeLessThan(50);
  });

  it('"Co nejkratší protokol" takes the fewest pages even within 8', () => {
    const forty = one(Array.from({ length: 40 }, () => card(1)));
    const normal = choosePhotoLayout(forty);
    const shortest = choosePhotoLayout(forty, 0, 0, (n) => n, true);
    expect(shortest.photoHeight).toBe(35);
    expect(shortest.total).toBeLessThan(normal.total);
  });

  it('counts the headings of severities and workplaces', () => {
    const cards = Array.from({ length: 6 }, () => card(1));
    const grouped = [[cards.slice(0, 2), cards.slice(2, 4)], [cards.slice(4)]];
    expect(defectPages(grouped, 35, 3)).toBe(1);
  });
});

describe('appendixColumnWidths', () => {
  const columns = [
    'Označení',
    'Systém / typové označení',
    'Schopno bezpečného provozu',
    'Poznámka (popis zjištění, závady, doporučení)',
    'Datum kontroly',
  ];
  const rows = [
    {
      cells: [
        '34-RLS',
        'přihradový',
        'NE',
        'Chybí závlačky a označení nosnosti – červené riziko',
        '11/11/2026',
      ],
    },
    { cells: ['29-RLS', 'konzolový, oboustranný', 'ANO', '', '11/11/2026'] },
  ];

  it('keeps short columns narrow and gives the rest to the long text', () => {
    const widths = appendixColumnWidths(columns, rows);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(APPENDIX_WIDTH);
    const [designation, system, safe, note, date] = widths as [
      number,
      number,
      number,
      number,
      number,
    ];
    // ANO/NE and the date: as wide as a word of the heading / the date, not more.
    expect(safe).toBeLessThan(25);
    expect(date).toBeLessThan(20);
    expect(designation).toBeLessThan(20);
    expect(system).toBeLessThan(40);
    expect(note).toBeGreaterThan(150);
  });

  it('shares the width when every column is long', () => {
    const long = 'x '.repeat(200);
    const widths = appendixColumnWidths(['A', 'B'], [{ cells: [long, long] }]);
    expect(widths[0]).toBeCloseTo(APPENDIX_WIDTH / 2);
  });
});
