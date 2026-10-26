import { strToU8, zipSync } from 'fflate';
import { db, photoBytes, type InspectionRow, type ResultRow } from './db.js';
import type { InputMode } from './log.js';
import {
  MOCK_CUSTOMER,
  MOCK_ITEMS,
  compareByLocation,
  itemByNumber,
  locationLabel,
} from './mock-items.js';
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
  photos: Blob[];
  mode: InputMode;
}

/**
 * Stores (or replaces) the result for an item. Resolves only after IndexedDB committed the
 * transaction – the UI confirms the check only then.
 */
export async function saveResult(
  inspectionId: string,
  itemNumber: string,
  input: ResultInput,
): Promise<void> {
  const id = `${inspectionId}:${itemNumber}`;
  const now = new Date().toISOString();
  // Read the bytes before the transaction: awaiting non-IndexedDB work inside it would commit it.
  const photos = await Promise.all(
    input.photos.map(async (blob) => ({
      data: await blob.arrayBuffer(),
      type: blob.type || 'image/jpeg',
    })),
  );
  await db.transaction('rw', db.results, db.photos, async () => {
    await db.results.put({
      id,
      inspectionId,
      itemNumber,
      outcome: input.outcome,
      defectDescription: input.outcome === 'defect' ? input.defectDescription : '',
      outOfService: input.outcome === 'defect' && input.outOfService,
      recordedAt: now,
      mode: input.mode,
    });
    // A changed result replaces the photos of the previous one.
    await db.photos.where('resultId').equals(id).delete();
    await db.photos.bulkAdd(
      photos.map((photo) => ({
        id: crypto.randomUUID(),
        inspectionId,
        resultId: id,
        itemNumber,
        takenAt: now,
        ...photo,
      })),
    );
  });
  // Field data must not get lost silently: verify that every photo is really stored.
  const stored = await db.photos.where('resultId').equals(id).count();
  if (stored !== photos.length) {
    throw new Error(`Uloženo ${stored} z ${photos.length} fotek`);
  }
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
}

export async function summarize(inspectionId: string): Promise<InspectionSummary> {
  const results = [...(await resultsOf(inspectionId)).values()];
  const defect = results.filter((r) => r.outcome === 'defect');
  return {
    total: MOCK_ITEMS.length,
    checked: results.length,
    ok: results.length - defect.length,
    defect: defect.length,
    outOfService: defect.filter((r) => r.outOfService).length,
    unchecked: MOCK_ITEMS.length - results.length,
    photos: await db.photos.where('inspectionId').equals(inspectionId).count(),
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

export async function deleteInspection(inspectionId: string): Promise<void> {
  await db.transaction('rw', db.inspections, db.results, db.photos, async () => {
    await db.photos.where('inspectionId').equals(inspectionId).delete();
    await db.results.where('inspectionId').equals(inspectionId).delete();
    await db.inspections.delete(inspectionId);
  });
}

// ---------- export ----------

const OUTCOME_LABEL = { ok: 'V pořádku', defect: 'Závada' } as const;

function csv(rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  // BOM + semicolons so that Czech Excel opens it correctly.
  return '﻿' + rows.map((row) => row.map(escape).join(';')).join('\r\n');
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
];
const RESULT_WIDTHS = [13, 10, 32, 16, 45, 18, 20, 14, 12];

/** Results of all items (checked or not), sorted by location – one row per item. */
async function resultRows(inspection: InspectionRow): Promise<CellValue[][]> {
  const results = await resultsOf(inspection.id);
  const photos = await db.photos.where('inspectionId').equals(inspection.id).toArray();
  const photoCounts = new Map<string, number>();
  photos.forEach((p) => photoCounts.set(p.itemNumber, (photoCounts.get(p.itemNumber) ?? 0) + 1));

  return [...MOCK_ITEMS].sort(compareByLocation).map((item) => {
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
    ];
  });
}

/** CSV is a plain table (no title rows), so spreadsheet apps detect the columns. */
export async function resultsCsv(inspection: InspectionRow): Promise<string> {
  return csv(
    [RESULT_HEADER, ...(await resultRows(inspection))].map((row) => row.map((v) => v ?? '')),
  );
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
      widths: [22, 40],
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
        ['Fotek', s.photos],
      ],
    },
  ]);
}

/** ZIP with defect photos named `<item>_<nn>.jpg` and a sidecar CSV describing them. */
export async function photosZip(inspection: InspectionRow): Promise<Blob> {
  const photos = await db.photos.where('inspectionId').equals(inspection.id).toArray();
  const results = await resultsOf(inspection.id);
  photos.sort(
    (a, b) => a.itemNumber.localeCompare(b.itemNumber) || a.takenAt.localeCompare(b.takenAt),
  );

  const files: Record<string, Uint8Array> = {};
  const sidecar: (string | number)[][] = [
    [
      'Soubor',
      'Číslo artiklu',
      'Typ',
      'Umístění',
      'Výsledek',
      'Popis závady',
      'Vyřazeno',
      'Pořízeno',
    ],
  ];
  const perItem = new Map<string, number>();
  for (const photo of photos) {
    const index = (perItem.get(photo.itemNumber) ?? 0) + 1;
    perItem.set(photo.itemNumber, index);
    const name = `${photo.itemNumber}_${String(index).padStart(2, '0')}.jpg`;
    files[name] = await photoBytes(photo);
    const item = itemByNumber(photo.itemNumber);
    const result = results.get(photo.itemNumber);
    sidecar.push([
      name,
      photo.itemNumber,
      item?.type ?? '',
      item ? locationLabel(item) : '',
      result ? OUTCOME_LABEL[result.outcome] : '',
      result?.defectDescription ?? '',
      result?.outOfService ? 'ano' : 'ne',
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
