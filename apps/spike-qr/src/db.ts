import Dexie, { type EntityTable } from 'dexie';
import type { InputMode } from './log.js';
import type { CatalogItem } from './mock-items.js';

export interface InspectionRow {
  id: string;
  customer: string;
  site: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'open' | 'closed';
}

export interface ResultRow {
  /** `${inspectionId}:${itemNumber}` – one result per item and inspection (as on the server). */
  id: string;
  inspectionId: string;
  itemNumber: string;
  outcome: 'ok' | 'defect';
  defectDescription: string;
  outOfService: boolean;
  recordedAt: string;
  mode: InputMode;
}

/**
 * What a photo belongs to – mirrors the server model (`photo` table):
 * - `result`: documents the result of an item in an inspection (defect photos),
 * - `item`: belongs to the item itself and stays across inspections (nameplate, overview),
 * - `inspection`: the inspection as a whole, not tied to an item (hall overview, access…).
 */
export type PhotoOwner = 'result' | 'item' | 'inspection';

export interface PhotoRow {
  id: string;
  owner: PhotoOwner;
  /** Inspection during which the photo was taken (all owners). */
  inspectionId: string;
  /** Set for owner `result` (`${inspectionId}:${itemNumber}`). */
  resultId: string | null;
  /** Set for owners `result` and `item`. */
  itemNumber: string | null;
  takenAt: string;
  /**
   * JPEG bytes. Stored as ArrayBuffer, not Blob: WebKit (iOS) intermittently fails to persist
   * Blobs in IndexedDB, especially in home-screen apps.
   */
  data: ArrayBuffer;
  type: string;
  /** Legacy rows from spike v2 (Blob). */
  blob?: Blob;
}

export type LocalItemRow = CatalogItem & { local: NonNullable<CatalogItem['local']> };

/** Local field data. In the real app the same rows feed the outbox (ADR-0004). */
class SpikeDb extends Dexie {
  inspections!: EntityTable<InspectionRow, 'id'>;
  results!: EntityTable<ResultRow, 'id'>;
  photos!: EntityTable<PhotoRow, 'id'>;
  items!: EntityTable<LocalItemRow, 'itemNumber'>;

  constructor() {
    super('revize-spike');
    this.version(1).stores({
      inspections: 'id, status, startedAt',
      results: 'id, inspectionId, itemNumber',
      photos: 'id, inspectionId, resultId',
    });
    // v2: photos as ArrayBuffer (same indexes; old Blob rows stay readable).
    this.version(2).stores({});
    // v3: photo owners (result / item / inspection) and items created in the field.
    this.version(3)
      .stores({
        photos: 'id, inspectionId, resultId, itemNumber, owner',
        items: 'itemNumber, qrCode',
      })
      .upgrade((tx) =>
        tx
          .table('photos')
          .toCollection()
          .modify((photo: PhotoRow) => {
            photo.owner ??= 'result';
          }),
      );
  }
}

export const db = new SpikeDb();

export async function photoBytes(photo: PhotoRow): Promise<Uint8Array> {
  if (photo.data) return new Uint8Array(photo.data);
  return new Uint8Array(await photo.blob!.arrayBuffer());
}

export async function photoBlob(photo: PhotoRow): Promise<Blob> {
  return photo.data ? new Blob([photo.data], { type: photo.type }) : photo.blob!;
}
