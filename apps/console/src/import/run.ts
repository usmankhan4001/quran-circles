import type { ApiClient, Principal } from '@qc/contracts';
import { fetchAllPages } from '../api/hooks';
import type { Directory } from '../api/directory';
import { parseCsv, toCsv } from '../lib/csv';
import { validateCoordinators } from './coordinators';
import { mergeServerResult, rowsToSend, sendImport } from './server';
import { validateSessions } from './sessions';
import { ISSUE_KEYS, type DryRunReport, type ImportIssue, type ImportKind } from './types';
import { citiesMentioned, validateVenues } from './venues';

export interface DryRunInput {
  kind: ImportKind;
  text: string;
  api: ApiClient;
  directory: Pick<Directory, 'cities' | 'venues'>;
  principal: Principal | null;
}

/**
 * The dry run, in two passes, and neither writes anything.
 * 1. The console reads the file, loads what already exists (read-only requests) and checks every
 *    row against the contract schemas and the person's scope, turning names into ids.
 * 2. Every row it could turn into a contract body goes to the server's dry run
 *    (`adminImport.<kind>` with `dryRun: true`), which is the authority: its per-row answer
 *    (created, duplicate, invalid with issues) replaces the console's guess for those rows.
 * A file with a problem in the file itself (a missing column, a broken quote) stops after pass 1.
 */
export async function dryRun(input: DryRunInput): Promise<DryRunReport<unknown>> {
  const report = await checkLocally(input);
  const sent = rowsToSend(report);
  const fileBlocked = report.fileIssues.some((i) => i.severity === 'error');
  if (fileBlocked || sent.length === 0) return report;
  const result = await sendImport(
    input.api,
    input.kind,
    sent.map((r) => r.body),
    true,
  );
  return mergeServerResult(report, sent, result);
}

/** Pass 1: the console's own check. Read-only. */
async function checkLocally({
  kind,
  text,
  api,
  directory,
  principal,
}: DryRunInput): Promise<DryRunReport<unknown>> {
  const table = parseCsv(text);
  const { cities, venues } = directory;

  if (kind === 'venues') {
    const mentioned = citiesMentioned(table, cities);
    const areaLists = await Promise.all(
      mentioned.map((c) => api.places.areas({ query: { cityId: c.id } }).then((r) => r.items)),
    );
    const existing = await Promise.all(
      mentioned.map((c) =>
        fetchAllPages((cursor) =>
          api.adminVenues.list({
            query: { cityId: c.id, includeArchived: 'true', limit: 100, cursor },
          }),
        ),
      ),
    );
    return validateVenues(table, {
      principal,
      cities,
      areasByCity: Object.fromEntries(mentioned.map((c, i) => [c.id, areaLists[i] ?? []])),
      venues: existing.flat(),
    });
  }

  if (kind === 'coordinators') {
    const [invites, assignments] = await Promise.all([
      api.adminRoles.invites().then((r) => r.items),
      fetchAllPages((cursor) => api.adminRoles.list({ query: { limit: 100, cursor } })),
    ]);
    return validateCoordinators(table, { principal, cities, venues, invites, assignments });
  }

  const sessions = await fetchAllPages((cursor) =>
    api.adminSessions.list({ query: { limit: 100, cursor } }),
  );
  return validateSessions(table, { principal, cities, venues, sessions });
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

export const issueMessage = (i: ImportIssue, t: Translate): string =>
  t(ISSUE_KEYS[i.code], i.params);

/** The problem report as a CSV the person can fix the file from. No cell contents are copied. */
export function reportToCsv(
  report: DryRunReport<unknown>,
  t: Translate,
  headers: { line: string; status: string; severity: string; column: string; message: string },
): string {
  const rows: string[][] = [
    [headers.line, headers.status, headers.severity, headers.column, headers.message],
  ];
  const push = (line: number, status: string, i: ImportIssue) =>
    rows.push([String(line), status, i.severity, i.column ?? '', issueMessage(i, t)]);
  for (const i of report.fileIssues) push(i.line, '', i);
  for (const row of report.rows) for (const i of row.issues) push(row.line, row.status, i);
  return toCsv(rows);
}
