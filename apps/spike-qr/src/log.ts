export type InputMode = 'camera' | 'wedge' | 'manual' | 'keypad';
export type Outcome = 'ok' | 'defect' | 'unknown';

export interface CheckMeasurement {
  kind: 'check';
  at: string;
  mode: InputMode;
  raw: string;
  itemNumber: string | null;
  outcome: Outcome;
  /** From "ready for next item" until the code was recognized (ms). */
  toReadMs: number;
  /** From showing the item card until OK/defect was confirmed (ms). */
  decisionMs: number;
  /** toReadMs + decisionMs. */
  totalMs: number;
  decodeMs: number | null;
  photos: number;
  config: string;
}

export interface CameraEvent {
  kind: 'camera';
  at: string;
  event: 'start' | 'restart' | 'error';
  startMs: number | null;
  width: number | null;
  height: number | null;
  standalone: boolean;
  permission: string;
  detail: string;
}

export type LogEntry = CheckMeasurement | CameraEvent;

const KEY = 'revize-spike-log';
let entries: LogEntry[] = load();

function load(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LogEntry[];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked; the in-memory log still works for this session.
  }
}

export function addLog(entry: LogEntry): void {
  entries.push(entry);
  persist();
}

export function getLog(): readonly LogEntry[] {
  return entries;
}

export function clearLog(): void {
  entries = [];
  persist();
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const CSV_COLUMNS = [
  'kind',
  'at',
  'mode',
  'event',
  'raw',
  'itemNumber',
  'outcome',
  'toReadMs',
  'decisionMs',
  'totalMs',
  'decodeMs',
  'photos',
  'startMs',
  'width',
  'height',
  'standalone',
  'permission',
  'config',
  'detail',
] as const;

export function toCsv(list: readonly LogEntry[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const rows = list.map((entry) =>
    CSV_COLUMNS.map((column) => escape((entry as unknown as Record<string, unknown>)[column])).join(
      ';',
    ),
  );
  // BOM + semicolons so that Czech Excel opens it correctly.
  return '﻿' + [CSV_COLUMNS.join(';'), ...rows].join('\r\n');
}
