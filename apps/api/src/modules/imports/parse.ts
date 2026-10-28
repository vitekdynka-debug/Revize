import { IMPORT_LIMITS } from '@revize/shared';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { AppError } from '../../errors.js';

export type StoredCell = string | number | boolean | null;

export interface ParsedSheet {
  sheets: string[];
  sheet: string | null;
  /** 1-based row of the header in the spreadsheet. */
  headerRow: number;
  headers: string[];
  rows: StoredCell[][];
}

const invalidFile = (message: string) => new AppError(400, 'invalid_file', message);

function isEmpty(cell: StoredCell) {
  return cell === null || (typeof cell === 'string' && cell.trim() === '');
}

/** Excel dates are midnight UTC; store them as ISO dates (the import accepts that format). */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Flattens exceljs cell values (rich text, formulas, hyperlinks, errors) to plain values. */
function plainValue(value: ExcelJS.CellValue): StoredCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isoDate(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return plainValue((value.result ?? null) as ExcelJS.CellValue);
    if ('text' in value) return plainValue(value.text as ExcelJS.CellValue);
    if ('error' in value) return null;
  }
  return String(value);
}

/** Header row = first row with any content; rows after it until the last non-empty one. */
function tableFrom(
  grid: StoredCell[][],
  firstRowNumber: number,
): Omit<ParsedSheet, 'sheets' | 'sheet'> {
  const headerIndex = grid.findIndex((row) => row.some((c) => !isEmpty(c)));
  if (headerIndex < 0) throw invalidFile('Soubor neobsahuje žádná data.');
  const rawHeaders = grid[headerIndex]!;
  let width = rawHeaders.length;
  while (width > 0 && isEmpty(rawHeaders[width - 1] ?? null)) width--;
  if (width > IMPORT_LIMITS.maxColumns)
    throw invalidFile(`Soubor má víc než ${IMPORT_LIMITS.maxColumns} sloupců.`);
  const headers = rawHeaders
    .slice(0, width)
    .map((h, i) => (isEmpty(h) ? `Sloupec ${i + 1}` : String(h).trim()));

  let rows = grid.slice(headerIndex + 1).map((row) => {
    const cells = row.slice(0, width).map((c) => (typeof c === 'string' ? c.trim() : c));
    while (cells.length < width) cells.push(null);
    return cells;
  });
  let end = rows.length;
  while (end > 0 && rows[end - 1]!.every(isEmpty)) end--;
  rows = rows.slice(0, end);
  if (rows.length > IMPORT_LIMITS.maxRows)
    throw invalidFile(`Soubor má víc než ${IMPORT_LIMITS.maxRows} řádků.`);
  return { headerRow: firstRowNumber + headerIndex, headers, rows };
}

async function parseXlsx(buffer: Buffer, sheetName: string | undefined): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw invalidFile(
      'Soubor nelze přečíst jako XLSX. Uložte ho v Excelu jako „Sešit Excelu (.xlsx)“ nebo CSV.',
    );
  }
  const sheets = workbook.worksheets.map((ws) => ws.name);
  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!worksheet)
    throw invalidFile(
      sheetName ? `List „${sheetName}“ v souboru není.` : 'Sešit neobsahuje žádná data.',
    );

  const grid: StoredCell[][] = [];
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const cells: StoredCell[] = [];
    for (let c = 1; c <= worksheet.columnCount; c++) cells.push(plainValue(row.getCell(c).value));
    grid.push(cells);
  }
  return { sheets, sheet: worksheet.name, ...tableFrom(grid, 1) };
}

/**
 * CSV from Czech Excel is often Windows-1250 and uses semicolons; others use UTF-8 and commas.
 * Strict UTF-8 is tried first, then Windows-1250.
 */
export function decodeText(buffer: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1250').decode(buffer);
  }
  return text.replace(/^\uFEFF/, '');
}

const DELIMITERS = [';', ',', '\t', '|'] as const;

/** The delimiter that splits the header line (outside quotes) into the most columns. */
export function detectDelimiter(headerLine: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let quoted = false;
  for (const char of headerLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  const [best, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return count > 0 ? best : ',';
}

function parseCsv(buffer: Buffer): ParsedSheet {
  const text = decodeText(buffer);
  const headerLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const result = Papa.parse<string[]>(text, {
    delimiter: detectDelimiter(headerLine),
    skipEmptyLines: false,
  });
  const fatal = result.errors.find((e) => e.type === 'Quotes');
  if (fatal)
    throw invalidFile(`CSV nelze přečíst (řádek ${(fatal.row ?? 0) + 1}: neuzavřené uvozovky).`);
  return { sheets: [], sheet: null, ...tableFrom(result.data, 1) };
}

export async function parseSpreadsheet(
  fileName: string,
  buffer: Buffer,
  sheet?: string,
): Promise<ParsedSheet> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return parseXlsx(buffer, sheet);
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return parseCsv(buffer);
  if (lower.endsWith('.xls')) {
    throw invalidFile(
      'Starý formát .xls není podporovaný. Uložte soubor v Excelu jako .xlsx nebo CSV.',
    );
  }
  throw invalidFile('Podporované soubory jsou XLSX a CSV.');
}
