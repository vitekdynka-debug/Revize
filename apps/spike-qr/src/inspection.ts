import { strToU8, zipSync } from 'fflate';
import { allItems, itemByNumber } from './catalog.js';
import { db, photoBytes, type InspectionRow, type PhotoRow, type ResultRow } from './db.js';
import type { InputMode } from './log.js';
import { MOCK_CUSTOMER, locationLabel } from './mock-items.js';
import { buildXlsx, type CellValue } from './xlsx.js';

export async function activeInspection(): Promise<InspectionRow | null> {
  return (await db.inspections.where('status').equals('open').first()) ?? null;
}

export async function startInspection(): Promise<InspectionRow> {
  const existing = await activeInspection();
  if (existing) return existing;
  const inspection: InspectionRow = {
    id: crypto.randomUUID(),
    customer: MOCK_CUSTOMER.name,
    site: MOCK_CUSTOMER.site,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'open',
  };
  await db.inspections.add(inspection);
  // Ask iOS not to evict field data under storage pressure.
  await navigator.storage?.persist?.().catch(() => false);
  return inspection;
}

export interface ResultInput {
  outcome: 'ok' | 'defect';
  defectDescription: string;
  outOfService: boolean;
  mode: InputMode;
}

/**
 * Stores (or replaces) the result for an item. Photos are not part of it: they are stored the
 * moment they are taken (photos.ts) and stay attached to the result id.
 */
export async function saveResult(
  inspectionId: string,
  itemNumber: string,
  input: ResultInput,
): Promise<void> {
  await db.results.put({
    id: `${inspectionId}:${itemNumber}`,
    inspectionId,
    itemNumber,
    outcome: input.outcome,
    defectDescription: input.outcome === 'defect' ? input.defectDescription : '',
    outOfService: input.outcome === 'defect' && input.outOfService,
    recordedAt: new Date().toISOString(),
    mode: input.mode,
  });
}

export async function resultsOf(inspectionId: string): Promise<Map<string, ResultRow>> {
  const rows = await db.results.where('inspectionId').equals(inspectionId).toArray();
  return new Map(rows.map((row) => [row.itemNumber, row]));
}

export async function resultFor(inspectionId: string, itemNumber: string) {
  return (await db.results.get(`${inspectionId}:${itemNumber}`)) ?? null;
}

export async function photoCount(resultId: string): Promise<number> {
  return db.photos.where('resultId').equals(resultId).count();
}

export interface InspectionSummary {
  total: number;
  checked: number;
  ok: number;
  defect: number;
  outOfService: number;
  unchecked: number;
  photos: number;
  newItems: number;
}

export async function summarize(inspectionId: string): Promise<InspectionSummary> {
  const results = [...(await resultsOf(inspectionId)).values()];
  const defect = results.filter((r) => r.outcome === 'defect');
  const items = allItems();
  return {
    total: items.length,
    checked: results.length,
    ok: results.length - defect.length,
    defect: defect.length,
    outOfService: defect.filter((r) => r.outOfService).length,
    unchecked: items.length - results.length,
    photos: await db.photos.where('inspectionId').equals(inspectionId).count(),
    newItems: items.filter((i) => i.local?.inspectionId === inspectionId).length,
  };
}

export async function finishInspection(inspectionId: string): Promise<void> {
  await db.inspections.update(inspectionId, {
    status: 'closed',
    finishedAt: new Date().toISOString(),
  });
}

export async function closedInspections(): Promise<InspectionRow[]> {
  const rows = await db.inspections.where('status').equals('closed').toArray();
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Deletes the inspection with its results and photos; item photos (nameplates…) stay. */
export async function deleteInspection(inspectionId: string): Promise<void> {
  await db.transaction('rw', db.inspections, db.results, db.photos, async () => {
    await db.photos
      .where('inspectionId')
      .equals(inspectionId)
      .filter((p) => p.owner !== 'item')
      .delete();
    await db.results.where('inspectionId').equals(inspectionId).delete();
    await db.inspections.delete(inspectionId);
  });
}

// ---------- export ----------

const OUTCOME_LABEL = { ok: 'V pořádku', defect: 'Závada' } as const;

/**
 * RFC 4180 CSV: comma separator, CRLF, UTF-8 with BOM (so that Excel reads diacritics).
 * Excel splits comma files into columns in most setups (Mac, English Windows, Numbers,
 * LibreOffice, Google Sheets); for Excel with Czech regional settings use the XLSX export.
 */
function csv(rows: CellValue[][]): string {
  const escape = (value: CellValue) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return '\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

const formatTime = (iso: string) => new Date(iso).toLocaleString('cs-CZ');

const MODE_LABEL: Record<InputMode, string> = {
  camera: 'Kamera (QR)',
  wedge: 'Čtečka',
  manual: 'Klávesnice',
  keypad: 'Číselník',
  list: 'Seznam',
};

const RESULT_HEADER = [
  'Číslo artiklu',
  'Typ',
  'Umístění',
  'Výsledek',
  'Popis závady',
  'Vyřazeno z provozu',
  'Čas kontroly',
  'Způsob zadání',
  'Počet fotek',
  'Nový artikl',
];
const RESULT_WIDTHS = [13, 10, 32, 16, 45, 18, 20, 14, 12, 12];

/** Results of all items (checked or not), sorted by location – one row per item. */
async function resultRows(inspection: InspectionRow): Promise<CellValue[][]> {
  const results = await resultsOf(inspection.id);
  const photos = await db.photos.where('inspectionId').equals(inspection.id).toArray();
  const photoCounts = new Map<string, number>();
  photos.forEach((p) => {
    if (p.itemNumber) photoCounts.set(p.itemNumber, (photoCounts.get(p.itemNumber) ?? 0) + 1);
  });

  return allItems().map((item) => {
    const r = results.get(item.itemNumber);
    return [
      Number(item.itemNumber),
      item.type,
      locationLabel(item),
      r ? OUTCOME_LABEL[r.outcome] : 'Nezkontrolováno',
      r?.defectDescription ?? '',
      r?.outOfService ? 'ano' : r ? 'ne' : '',
      r ? formatTime(r.recordedAt) : '',
      r ? MODE_LABEL[r.mode] : '',
      photoCounts.get(item.itemNumber) ?? 0,
      item.local?.inspectionId === inspection.id ? 'ano' : '',
    ];
  });
}

/** CSV is a plain table (no title rows), so spreadsheet apps detect the columns. */
export async function resultsCsv(inspection: InspectionRow): Promise<string> {
  return csv([RESULT_HEADER, ...(await resultRows(inspection))]);
}

export async function resultsXlsx(inspection: InspectionRow): Promise<Uint8Array> {
  const s = await summarize(inspection.id);
  return buildXlsx([
    {
      name: 'Výsledky',
      header: true,
      widths: RESULT_WIDTHS,
      rows: [RESULT_HEADER, ...(await resultRows(inspection))],
    },
    {
      name: 'Souhrn',
      widths: [26, 40],
      rows: [
        ['Zákazník', inspection.customer],
        ['Provozovna', inspection.site],
        ['Zahájeno', formatTime(inspection.startedAt)],
        ['Ukončeno', inspection.finishedAt ? formatTime(inspection.finishedAt) : 'rozpracovaná'],
        [],
        ['Artiklů celkem', s.total],
        ['Zkontrolováno', s.checked],
        ['V pořádku', s.ok],
        ['Závady', s.defect],
        ['z toho vyřazeno z provozu', s.outOfService],
        ['Nezkontrolováno', s.unchecked],
        ['Nově založené artikly', s.newItems],
        ['Fotek', s.photos],
      ],
    },
  ]);
}

const PHOTO_KIND: Record<PhotoRow['owner'], string> = {
  result: 'Výsledek kontroly',
  item: 'Fotka artiklu',
  inspection: 'Fotka ke kontrole',
};

/** File name: `10005_01.jpg` (result), `10005_artikl_01.jpg` (item), `kontrola_01.jpg`. */
function photoFileName(photo: PhotoRow, index: number): string {
  const nn = String(index).padStart(2, '0');
  if (photo.owner === 'inspection') return `kontrola_${nn}.jpg`;
  return photo.owner === 'item'
    ? `${photo.itemNumber}_artikl_${nn}.jpg`
    : `${photo.itemNumber}_${nn}.jpg`;
}

/** ZIP with all photos taken during the inspection and a sidecar CSV describing them. */
export async function photosZip(inspection: InspectionRow): Promise<Blob> {
  const photos = await db.photos.where('inspectionId').equals(inspection.id).toArray();
  const results = await resultsOf(inspection.id);
  photos.sort(
    (a, b) =>
      (a.itemNumber ?? '').localeCompare(b.itemNumber ?? '') ||
      a.owner.localeCompare(b.owner) ||
      a.takenAt.localeCompare(b.takenAt),
  );

  const files: Record<string, Uint8Array> = {};
  const sidecar: CellValue[][] = [
    [
      'Soubor',
      'Druh fotky',
      'Číslo artiklu',
      'Typ',
      'Umístění',
      'Výsledek',
      'Popis závady',
      'Vyřazeno',
      'Pořízeno',
    ],
  ];
  const counters = new Map<string, number>();
  for (const photo of photos) {
    const group = `${photo.owner}:${photo.itemNumber ?? ''}`;
    const index = (counters.get(group) ?? 0) + 1;
    counters.set(group, index);
    const name = photoFileName(photo, index);
    files[name] = await photoBytes(photo);
    const item = photo.itemNumber ? itemByNumber(photo.itemNumber) : null;
    const result = photo.itemNumber ? results.get(photo.itemNumber) : undefined;
    sidecar.push([
      name,
      PHOTO_KIND[photo.owner],
      photo.itemNumber ?? '',
      item?.type ?? '',
      item ? locationLabel(item) : '',
      result ? OUTCOME_LABEL[result.outcome] : photo.owner === 'result' ? 'neuloženo' : '',
      result?.defectDescription ?? '',
      result?.outOfService ? 'ano' : result ? 'ne' : '',
      formatTime(photo.takenAt),
    ]);
  }
  files['fotky.csv'] = strToU8(csv(sidecar));
  // JPEGs are already compressed; level 0 keeps zipping fast on the iPad.
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

export function exportBaseName(inspection: InspectionRow): string {
  return `kontrola-${inspection.startedAt.slice(0, 10)}-${inspection.id.slice(0, 8)}`;
}
