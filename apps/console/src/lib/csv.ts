/**
 * A small RFC 4180 CSV reader and writer. The bulk import reads files in the browser, so the
 * parser reports problems with their line numbers instead of throwing, and never guesses.
 */
export type CsvErrorCode =
  'empty_file' | 'file_too_large' | 'too_many_rows' | 'unterminated_quote' | 'stray_quote';

export interface CsvError {
  code: CsvErrorCode;
  /** 1-based physical line in the file where the problem starts. 0 when it is about the file. */
  line: number;
}

export interface CsvRecord {
  /** 1-based physical line where the record starts. The header is line 1. */
  line: number;
  cells: string[];
}

export interface CsvTable {
  delimiter: string;
  header: string[];
  records: CsvRecord[];
  errors: CsvError[];
}

export interface CsvParseOptions {
  /** Maximum number of data rows. */
  maxRows?: number;
  /** Maximum size in characters. */
  maxChars?: number;
  delimiter?: string;
}

export const DEFAULT_MAX_ROWS = 2000;
export const DEFAULT_MAX_CHARS = 2_000_000;

const DELIMITERS = [',', ';', '\t'] as const;

/** Picks the delimiter that appears most in the first line outside quotes. Excel in some regions saves with semicolons. */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  let best: string = ',';
  for (const d of DELIMITERS) if ((counts[d] ?? 0) > (counts[best] ?? 0)) best = d;
  return best;
}

export function parseCsv(input: string, options: CsvParseOptions = {}): CsvTable {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const errors: CsvError[] = [];
  const text = input.startsWith('﻿') ? input.slice(1) : input;

  if (text.length > maxChars) {
    return {
      delimiter: ',',
      header: [],
      records: [],
      errors: [{ code: 'file_too_large', line: 0 }],
    };
  }
  if (text.trim() === '') {
    return { delimiter: ',', header: [], records: [], errors: [{ code: 'empty_file', line: 0 }] };
  }

  const delimiter = options.delimiter ?? detectDelimiter(text);
  const rows: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let line = 1;
  let recordLine = 1;
  let inQuotes = false;
  let quoteOpenedAt = 0;
  /** True once a quoted field has closed, until the next delimiter or newline. */
  let afterQuote = false;
  let cellStarted = false;

  const endCell = () => {
    cells.push(cell);
    cell = '';
    cellStarted = false;
    afterQuote = false;
  };
  const endRecord = () => {
    endCell();
    if (cells.some((c) => c.trim() !== '')) rows.push({ line: recordLine, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (!cellStarted && !afterQuote && cell === '') {
        inQuotes = true;
        quoteOpenedAt = line;
        cellStarted = true;
      } else {
        errors.push({ code: 'stray_quote', line });
        cell += ch;
      }
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      if (afterQuote) errors.push({ code: 'stray_quote', line });
      cell += ch;
      cellStarted = true;
    }
  }
  if (inQuotes) {
    errors.push({ code: 'unterminated_quote', line: quoteOpenedAt });
  } else if (cellStarted || cell !== '' || cells.length > 0) {
    endRecord();
  }

  const [headerRow, ...data] = rows;
  const header = (headerRow?.cells ?? []).map((h) => h.trim());
  if (data.length > maxRows) {
    errors.push({ code: 'too_many_rows', line: 0 });
    return { delimiter, header, records: data.slice(0, maxRows), errors };
  }
  return { delimiter, header, records: data, errors };
}

const needsQuotes = /[",;\r\n\t]|^\s|\s$/;

export function toCsv(rows: readonly (readonly string[])[], delimiter = ','): string {
  return rows
    .map((row) =>
      row
        .map((value) => (needsQuotes.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
        .join(delimiter),
    )
    .join('\r\n')
    .concat('\r\n');
}

export interface CsvPart {
  key: string;
  csv: string;
}

/**
 * Joins several exports into one file with a leading `session_id` column. Columns are matched by
 * header name, so exports that differ in column order or have extra columns still line up.
 * Returns null when a part cannot be read, so a broken export is never silently dropped.
 */
export function mergeCsvParts(parts: readonly CsvPart[], keyColumn = 'session_id'): string | null {
  const headers: string[] = [];
  const parsed: { key: string; table: CsvTable }[] = [];
  for (const part of parts) {
    const table = parseCsv(part.csv, { maxRows: 1_000_000, maxChars: 50_000_000 });
    if (table.errors.some((e) => e.code !== 'empty_file')) return null;
    for (const h of table.header) if (!headers.includes(h)) headers.push(h);
    parsed.push({ key: part.key, table });
  }
  const out: string[][] = [[keyColumn, ...headers]];
  for (const { key, table } of parsed) {
    for (const record of table.records) {
      out.push([
        key,
        ...headers.map((h) => {
          const idx = table.header.indexOf(h);
          return idx === -1 ? '' : (record.cells[idx] ?? '');
        }),
      ]);
    }
  }
  return toCsv(out);
}
