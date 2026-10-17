import type { MessageKey } from '@qc/i18n';
import {
  IMPORT_KINDS as CONTRACT_IMPORT_KINDS,
  type ImportKind,
  type Principal,
} from '@qc/contracts';

export type { ImportKind };
export const IMPORT_KINDS: readonly ImportKind[] = CONTRACT_IMPORT_KINDS;

/**
 * Everything that can be wrong with a file or a row. Each code has a message in English and Urdu
 * (`console.import.issue.*`). Messages name the column and line, never the cell's contents, so a
 * report can be shared without sharing the people in it.
 */
export type IssueCode =
  | 'csv_empty_file'
  | 'csv_file_too_large'
  | 'csv_too_many_rows'
  | 'csv_unterminated_quote'
  | 'csv_stray_quote'
  | 'missing_column'
  | 'duplicate_column'
  | 'unknown_column'
  | 'column_count'
  | 'required'
  | 'invalid_value'
  | 'invalid_number'
  | 'invalid_boolean'
  | 'invalid_date'
  | 'invalid_time'
  | 'invalid_days'
  | 'invalid_phone'
  | 'phone_not_mobile'
  | 'unknown_city'
  | 'unknown_area'
  | 'unknown_venue'
  | 'ambiguous_venue'
  | 'unknown_role'
  | 'out_of_scope'
  | 'duplicate_in_file'
  | 'phone_repeated'
  | 'already_exists'
  | 'already_invited'
  | 'already_assigned'
  | 'invalid_reference'
  | 'area_not_in_city'
  | 'already_there';

export const ISSUE_KEYS = {
  csv_empty_file: 'console.import.issue.csvEmptyFile',
  csv_file_too_large: 'console.import.issue.csvFileTooLarge',
  csv_too_many_rows: 'console.import.issue.csvTooManyRows',
  csv_unterminated_quote: 'console.import.issue.csvUnterminatedQuote',
  csv_stray_quote: 'console.import.issue.csvStrayQuote',
  missing_column: 'console.import.issue.missingColumn',
  duplicate_column: 'console.import.issue.duplicateColumn',
  unknown_column: 'console.import.issue.unknownColumn',
  column_count: 'console.import.issue.columnCount',
  required: 'console.import.issue.required',
  invalid_value: 'console.import.issue.invalidValue',
  invalid_number: 'console.import.issue.invalidNumber',
  invalid_boolean: 'console.import.issue.invalidBoolean',
  invalid_date: 'console.import.issue.invalidDate',
  invalid_time: 'console.import.issue.invalidTime',
  invalid_days: 'console.import.issue.invalidDays',
  invalid_phone: 'console.import.issue.invalidPhone',
  phone_not_mobile: 'console.import.issue.phoneNotMobile',
  unknown_city: 'console.import.issue.unknownCity',
  unknown_area: 'console.import.issue.unknownArea',
  unknown_venue: 'console.import.issue.unknownVenue',
  ambiguous_venue: 'console.import.issue.ambiguousVenue',
  unknown_role: 'console.import.issue.unknownRole',
  out_of_scope: 'console.import.issue.outOfScope',
  duplicate_in_file: 'console.import.issue.duplicateInFile',
  phone_repeated: 'console.import.issue.phoneRepeated',
  already_exists: 'console.import.issue.alreadyExists',
  already_invited: 'console.import.issue.alreadyInvited',
  already_assigned: 'console.import.issue.alreadyAssigned',
  invalid_reference: 'console.import.issue.invalidReference',
  area_not_in_city: 'console.import.issue.areaNotInCity',
  already_there: 'console.import.issue.alreadyThere',
} as const satisfies Record<IssueCode, MessageKey>;

export type Severity = 'error' | 'warning';

export interface ImportIssue {
  /** 1-based line in the file. 0 for problems with the file as a whole. */
  line: number;
  column: string | null;
  code: IssueCode;
  severity: Severity;
  params?: Record<string, string | number>;
}

/**
 * - `valid`: will be created.
 * - `duplicate`: the same record already exists, so the row is skipped. Safe to run twice.
 *   The row keeps its body, so the server can decide; it skips true duplicates itself.
 * - `invalid`: must be fixed in the file. One invalid row stops the whole import.
 */
export type RowStatus = 'valid' | 'duplicate' | 'invalid';

export interface DryRunRow<T> {
  line: number;
  status: RowStatus;
  issues: ImportIssue[];
  /** A short label for the report that carries no personal data. */
  label: string;
  /** The contract request body, present for `valid` and `duplicate` rows. */
  body?: T;
}

export interface DryRunReport<T> {
  kind: ImportKind;
  fileIssues: ImportIssue[];
  rows: DryRunRow<T>[];
  counts: { total: number; valid: number; duplicate: number; invalid: number };
  /** True only when nothing needs fixing and at least one row would be created. */
  canApply: boolean;
  /** True once the server's dry run has checked the rows. Only then can a report be applied. */
  serverChecked: boolean;
}

export function buildReport<T>(
  kind: ImportKind,
  fileIssues: ImportIssue[],
  rows: DryRunRow<T>[],
  serverChecked = false,
): DryRunReport<T> {
  const counts = {
    total: rows.length,
    valid: rows.filter((r) => r.status === 'valid').length,
    duplicate: rows.filter((r) => r.status === 'duplicate').length,
    invalid: rows.filter((r) => r.status === 'invalid').length,
  };
  const fileBlocked = fileIssues.some((i) => i.severity === 'error');
  return {
    kind,
    fileIssues,
    rows,
    counts,
    canApply: !fileBlocked && counts.invalid === 0 && counts.valid > 0,
    serverChecked,
  };
}

/** The person doing the import, for scope checks that mirror the API's. */
export interface ImportActor {
  principal: Principal | null;
}

export const issue = (
  line: number,
  column: string | null,
  code: IssueCode,
  params?: Record<string, string | number>,
  severity: Severity = 'error',
): ImportIssue => ({ line, column, code, severity, ...(params ? { params } : {}) });
