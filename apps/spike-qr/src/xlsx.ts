import { strToU8, zipSync } from 'fflate';

/**
 * Minimal XLSX (Office Open XML) writer for the spike's exports: inline strings and numbers,
 * bold frozen header with autofilter, column widths. The real app exports on the server
 * with exceljs (M7); this keeps the offline PWA small.
 */
export type CellValue = string | number | null | undefined;

export interface Sheet {
  name: string;
  rows: CellValue[][];
  /** Width in characters per column. */
  widths?: number[];
  /** First row is a header: bold, frozen, with autofilter. */
  header?: boolean;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function escapeXml(text: string): string {
  return (
    text
      // Control characters are not allowed in XML 1.0.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  );
}

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function cell(value: CellValue, ref: string, style: number): string {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value))
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const columnCount = Math.max(1, ...sheet.rows.map((r) => r.length));
  const rows = sheet.rows
    .map((row, r) => {
      const style = sheet.header && r === 0 ? 1 : 2;
      const cells = row.map((value, c) => cell(value, `${columnName(c)}${r + 1}`, style)).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const view = sheet.header
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';
  const filter =
    sheet.header && sheet.rows.length > 0
      ? `<autoFilter ref="A1:${columnName(columnCount - 1)}${sheet.rows.length}"/>`
      : '';
  return `${XML_HEADER}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${view}${cols}<sheetData>${rows}</sheetData>${filter}</worksheet>`;
}

const STYLES = `${XML_HEADER}<styleSheet xmlns="${NS_MAIN}">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Sheet names: max 31 characters, none of []:*?/\ */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'List';
}

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const sheetEntries = sheets.map((sheet, i) => ({ sheet, id: i + 1 }));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheetEntries
          .map(
            ({ id }) =>
              `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
        sheetEntries
          .map(
            ({ sheet, id }) =>
              `<sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="${id}" r:id="rId${id}"/>`,
          )
          .join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="${NS_PKG_REL}">` +
        sheetEntries
          .map(
            ({ id }) =>
              `<Relationship Id="rId${id}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${id}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(STYLES),
  };
  for (const { sheet, id } of sheetEntries) {
    files[`xl/worksheets/sheet${id}.xml`] = strToU8(sheetXml(sheet));
  }
  return zipSync(files);
}
