import type { CsvError, CsvTable } from '../lib/csv';
import { issue, type ImportIssue, type IssueCode } from './types';

/**
 * Reading a parsed CSV by column name. Header names are matched without case and with spaces,
 * dashes and underscores treated alike, so `City`, `city` and ` City ` are the same column.
 */
export interface ColumnSpec {
  name: string;
  aliases?: readonly string[];
  required?: boolean;
}

export const canonicalHeader = (raw: string): string =>
  raw
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');

export interface ReadRow {
  line: number;
  /** Trimmed cell text, or '' when the column is absent or empty. */
  get(column: string): string;
  has(column: string): boolean;
}

export interface ReadTable {
  fileIssues: ImportIssue[];
  rows: ReadRow[];
  /** Rows with a wrong number of cells, so the caller can mark them invalid. */
  malformed: Map<number, ImportIssue>;
}

const CSV_ERROR_CODES: Record<CsvError['code'], IssueCode> = {
  empty_file: 'csv_empty_file',
  file_too_large: 'csv_file_too_large',
  too_many_rows: 'csv_too_many_rows',
  unterminated_quote: 'csv_unterminated_quote',
  stray_quote: 'csv_stray_quote',
};

export function readTable(table: CsvTable, specs: readonly ColumnSpec[]): ReadTable {
  const fileIssues: ImportIssue[] = table.errors.map((e) =>
    issue(e.line, null, CSV_ERROR_CODES[e.code]),
  );
  const malformed = new Map<number, ImportIssue>();
  if (table.errors.some((e) => e.code === 'empty_file' || e.code === 'file_too_large'))
    return { fileIssues, rows: [], malformed };

  // Which file column feeds each wanted column.
  const index = new Map<string, number>();
  const seen = new Set<string>();
  const known = new Map<string, string>();
  for (const spec of specs) {
    known.set(spec.name, spec.name);
    for (const alias of spec.aliases ?? []) known.set(alias, spec.name);
  }
  table.header.forEach((raw, i) => {
    const key = canonicalHeader(raw);
    const wanted = known.get(key);
    if (!wanted) {
      if (key !== '') fileIssues.push(issue(1, raw.trim(), 'unknown_column', { column: raw.trim() }, 'warning'));
      return;
    }
    if (seen.has(wanted)) {
      fileIssues.push(issue(1, wanted, 'duplicate_column', { column: wanted }));
      return;
    }
    seen.add(wanted);
    index.set(wanted, i);
  });
  for (const spec of specs) {
    if (spec.required && !index.has(spec.name))
      fileIssues.push(issue(1, spec.name, 'missing_column', { column: spec.name }));
  }

  const rows: ReadRow[] = table.records.map((record) => {
    const tooMany =
      record.cells.length > table.header.length &&
      record.cells.slice(table.header.length).some((c) => c.trim() !== '');
    if (tooMany || record.cells.length < table.header.length) {
      malformed.set(
        record.line,
        issue(record.line, null, 'column_count', {
          expected: table.header.length,
          found: record.cells.length,
        }),
      );
    }
    return {
      line: record.line,
      get: (column) => {
        const i = index.get(column);
        return i === undefined ? '' : (record.cells[i] ?? '').trim();
      },
      has: (column) => index.has(column),
    };
  });
  return { fileIssues, rows, malformed };
}

/** Comparing names: case, extra spaces and punctuation do not make a different place. */
export const normalizeName = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const TRUE = new Set(['yes', 'y', 'true', '1']);
const FALSE = new Set(['no', 'n', 'false', '0']);

/** '' is "not given" (null). Anything else must be a clear yes or no. */
export function parseBoolean(text: string): boolean | null | 'invalid' {
  const v = text.trim().toLowerCase();
  if (v === '') return null;
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return false;
  return 'invalid';
}

export function parseNumber(text: string): number | null | 'invalid' {
  const v = text.trim();
  if (v === '') return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(v)) return 'invalid';
  const n = Number(v);
  return Number.isFinite(n) ? n : 'invalid';
}

/** Maps the first segments of a zod issue path to a CSV column. */
export function columnForPath(
  map: Readonly<Record<string, string>>,
  path: readonly PropertyKey[],
): string | null {
  const parts = path.map(String);
  for (let n = parts.length; n > 0; n--) {
    const hit = map[parts.slice(0, n).join('.')];
    if (hit) return hit;
  }
  return null;
}
