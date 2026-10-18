import {
  COORDINATOR_IMPORT_MAX_ROWS,
  INVITE_DAILY_LIMIT,
  issueMessageKey,
  type ApiClient,
  type ImportResult,
  type ImportRowResult,
  type InviteBody,
  type SessionCreate,
  type ValidationIssue,
  type VenueCreate,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { issuesOf } from '../lib/errors';
import { COORDINATOR_PATH_COLUMNS } from './coordinators';
import { SESSION_PATH_COLUMNS } from './sessions';
import { columnForPath } from './table';
import {
  buildReport,
  issue,
  type DryRunReport,
  type DryRunRow,
  type ImportIssue,
  type ImportKind,
  type IssueCode,
} from './types';
import { VENUE_PATH_COLUMNS } from './venues';

/**
 * The server side of an import: `adminImport.venues | coordinators | sessions`. The console's
 * own check is a fast first pass that turns the file into contract bodies; the server's dry run
 * (`dryRun: true`) is the authority on what would be created, skipped or refused. The import
 * itself (`dryRun: false`) is one transaction: every row is written, or none is.
 */

const PATH_COLUMNS: Record<ImportKind, Readonly<Record<string, string>>> = {
  venues: VENUE_PATH_COLUMNS,
  coordinators: COORDINATOR_PATH_COLUMNS,
  sessions: SESSION_PATH_COLUMNS,
};

/** Rows the server is asked about: every row the console could turn into a body. */
export function rowsToSend<T>(report: DryRunReport<T>): DryRunRow<T>[] {
  return report.rows.filter((r) => r.status !== 'invalid' && r.body !== undefined);
}

/** One call to the bulk endpoint for this kind of file. */
export function sendImport(
  api: ApiClient,
  kind: ImportKind,
  rows: readonly unknown[],
  dryRun: boolean,
): Promise<ImportResult> {
  switch (kind) {
    case 'venues':
      return api.adminImport.venues({ body: { dryRun, rows: rows as VenueCreate[] } });
    case 'coordinators':
      return api.adminImport.coordinators({ body: { dryRun, rows: rows as InviteBody[] } });
    case 'sessions':
      return api.adminImport.sessions({ body: { dryRun, rows: rows as SessionCreate[] } });
  }
}

/** Why the server refused a whole file, in words, with what the words need. */
export interface RefusedFile {
  key: MessageKey;
  params?: Record<string, string | number>;
}

/**
 * The words for a server answer that refuses the whole file, dry run included, with no per-row
 * result (`IMPORT_REQUEST_ISSUE_CODES`, `validation_failed` on `rows`): a coordinator file over
 * `COORDINATOR_IMPORT_MAX_ROWS` rows (`too_big`), or rows that would take the person past their
 * invitations for the last 24 hours (`invite_daily_limit`). Null for any other failure, which
 * keeps its general message.
 */
export function refusedFile(error: unknown, kind: ImportKind): RefusedFile | null {
  for (const found of issuesOf(error)) {
    if (found.path !== 'rows') continue;
    if (found.code === INVITE_DAILY_LIMIT) return { key: issueMessageKey(INVITE_DAILY_LIMIT) };
    if (found.code === 'too_big' && kind === 'coordinators')
      return {
        key: 'console.import.issue.tooManyInviteRows',
        params: { max: COORDINATOR_IMPORT_MAX_ROWS },
      };
  }
  return null;
}

/** Codes the console's own check uses for "this is already there". */
const ALREADY_THERE: ReadonlySet<IssueCode> = new Set([
  'already_exists',
  'already_invited',
  'already_assigned',
]);

/**
 * A server issue as a line in the report: the column comes from the issue path, the message from
 * the code. Zod's own codes (`invalid_type`, `too_small`, ...) read as "not valid". Nothing from
 * the cell is repeated.
 */
export function serverIssue(kind: ImportKind, line: number, found: ValidationIssue): ImportIssue {
  const column = columnForPath(PATH_COLUMNS[kind], found.path.split('.'));
  const params = { column: column ?? 'row' };
  switch (found.code) {
    case 'forbidden':
      return issue(line, column, 'out_of_scope', params);
    case 'area_not_in_city':
      return issue(line, column, 'area_not_in_city', params);
    case 'invalid_reference':
      return issue(
        line,
        column,
        column === 'city'
          ? 'unknown_city'
          : column === 'area'
            ? 'unknown_area'
            : column === 'venue'
              ? 'unknown_venue'
              : 'invalid_reference',
        params,
      );
    default:
      return issue(line, column, 'invalid_value', params);
  }
}

/**
 * Puts the server's answer on the console's report, row by row. Rows the server was asked about
 * take its status; rows the console already refused keep their problems. Counts and `canApply`
 * are worked out again, so a report can only be applied after a clean server check.
 */
export function mergeServerResult<T>(
  report: DryRunReport<T>,
  sent: readonly DryRunRow<T>[],
  result: ImportResult,
): DryRunReport<T> {
  const byLine = new Map<number, ImportRowResult>();
  for (const answer of result.rows) {
    const row = sent[answer.index];
    if (row) byLine.set(row.line, answer);
  }
  const rows = report.rows.map((row): DryRunRow<T> => {
    const answer = byLine.get(row.line);
    if (!answer) return row;
    if (answer.status === 'invalid') {
      return {
        line: row.line,
        label: row.label,
        status: 'invalid',
        issues: [
          ...row.issues.filter((i) => !ALREADY_THERE.has(i.code)),
          ...answer.issues.map((i) => serverIssue(report.kind, row.line, i)),
        ],
      };
    }
    if (answer.status === 'duplicate') {
      const known = row.issues.some((i) => ALREADY_THERE.has(i.code));
      return {
        ...row,
        status: 'duplicate',
        issues: known
          ? row.issues
          : [...row.issues, issue(row.line, null, 'already_there', undefined, 'warning')],
      };
    }
    return {
      ...row,
      status: 'valid',
      issues: row.issues.filter((i) => !ALREADY_THERE.has(i.code)),
    };
  });
  return buildReport(report.kind, report.fileIssues, rows, true);
}

export type CommitOutcome =
  /** Written in one transaction. */
  | { applied: true; created: number; skipped: number }
  /** The server refused at least one row, so nothing was written. The report says which. */
  | { applied: false; report: DryRunReport<unknown> };

/**
 * The import itself, after the person confirmed a clean, server-checked report. It sends the same
 * rows as the dry run with `dryRun: false`. Either all rows are written or none are; a retry is
 * safe because rows already written come back as duplicates.
 */
export async function commitImport(
  report: DryRunReport<unknown>,
  api: ApiClient,
): Promise<CommitOutcome> {
  // Nothing is sent for a report that still has errors or was never checked by the server.
  if (!report.canApply || !report.serverChecked)
    throw new Error('Import has not passed the check and cannot be applied');
  const sent = rowsToSend(report);
  const result = await sendImport(
    api,
    report.kind,
    sent.map((r) => r.body),
    false,
  );
  if (result.applied)
    return { applied: true, created: result.counts.created, skipped: result.counts.duplicate };
  return { applied: false, report: mergeServerResult(report, sent, result) };
}
