import Dexie, { type EntityTable } from 'dexie';
import type { InputMode } from './log.js';

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

export interface PhotoRow {
  id: string;
  inspectionId: string;
  resultId: string;
  itemNumber: string;
  takenAt: string;
  blob: Blob;
}

/** Local field data. In the real app the same rows feed the outbox (ADR-0004). */
class SpikeDb extends Dexie {
  inspections!: EntityTable<InspectionRow, 'id'>;
  results!: EntityTable<ResultRow, 'id'>;
  photos!: EntityTable<PhotoRow, 'id'>;

  constructor() {
    super('revize-spike');
    this.version(1).stores({
      inspections: 'id, status, startedAt',
      results: 'id, inspectionId, itemNumber',
      photos: 'id, inspectionId, resultId',
    });
  }
}

export const db = new SpikeDb();
