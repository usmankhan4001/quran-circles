import type { ApiClient } from '@qc/contracts';
import type { CoordinatorBody } from './coordinators';
import type { SessionBody } from './sessions';
import type { VenueBody } from './venues';
import type { DryRunReport, ImportKind } from './types';

/**
 * Writing a confirmed import. The P0 contract has no bulk endpoint, so rows go through the
 * existing create endpoints one at a time, in file order, and the run stops at the first failure.
 * Only `valid` rows are sent; `duplicate` rows are skipped. Running the same file again after a
 * failure is safe: the dry run sees what was created and marks those rows as duplicates.
 * A bulk endpoint that applies a file in one transaction is requested in the change request
 * `2026-10-16-console-bulk-import.md`.
 */
export type ApplyReport =
  | { status: 'done'; created: number; skipped: number }
  | {
      status: 'stopped';
      created: number;
      skipped: number;
      /** The line that failed, and what was thrown. */
      failedLine: number;
      error: unknown;
      /** Rows never attempted. */
      remaining: number;
    };

export interface ApplyProgress {
  done: number;
  total: number;
}

type Sender = (body: never) => Promise<unknown>;

function senderFor(kind: ImportKind, api: ApiClient): Sender {
  switch (kind) {
    case 'venues':
      return ((body: VenueBody) => api.adminVenues.create({ body })) as Sender;
    case 'coordinators':
      return ((body: CoordinatorBody) => api.adminRoles.invite({ body })) as Sender;
    case 'sessions':
      return ((body: SessionBody) => api.adminSessions.create({ body })) as Sender;
  }
}

export async function applyImport(
  report: DryRunReport<unknown>,
  api: ApiClient,
  onProgress?: (p: ApplyProgress) => void,
): Promise<ApplyReport> {
  // Nothing is sent for a file that still has errors, whatever the caller thinks.
  if (!report.canApply) throw new Error('Import has errors and cannot be applied');
  const send = senderFor(report.kind, api);
  const todo = report.rows.filter((r) => r.status === 'valid' && r.body !== undefined);
  const skipped = report.counts.duplicate;
  let created = 0;
  for (const row of todo) {
    onProgress?.({ done: created, total: todo.length });
    try {
      await send(row.body as never);
      created++;
    } catch (error) {
      return {
        status: 'stopped',
        created,
        skipped,
        failedLine: row.line,
        error,
        remaining: todo.length - created,
      };
    }
  }
  onProgress?.({ done: created, total: todo.length });
  return { status: 'done', created, skipped };
}
