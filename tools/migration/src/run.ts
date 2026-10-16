import type { SqlExecutor } from '@qc/db';
import { createHash } from 'node:crypto';
import { applyPlan, type Inserted } from './apply';
import { ADVISORY_LOCK_KEY, REPORT_SCHEMA_VERSION, SEASON_TAG } from './constants';
import { MigrationToolError } from './errors';
import { buildPlan, type Plan, type PlanInput } from './plan';
import { ReportSchema, type Report } from './report';
import { takeSnapshot, type Snapshot } from './snapshot';
import { loadTargetState, offlineTarget, type TargetState } from './target';

export interface RunOptions {
  /** The V2 database connection. Omit for an offline dry run (nine fixture cities, empty target). */
  db: SqlExecutor | null;
  apply: boolean;
  input: Omit<PlanInput, 'target'>;
  now?: Date;
  /**
   * Called with the plan's report after the plan is made and before anything is written. Throw
   * to refuse: the transaction is rolled back. The CLI uses it to check the owner's approval.
   */
  beforeApply?: (report: Report) => void;
}

export interface RunResult {
  report: Report;
  plan: Plan;
  /** Counts in the database just before the writes (apply only). */
  before: Snapshot | null;
}

/**
 * The one code path for both modes. A dry run and an apply read the same state, build the same
 * plan and produce the same report; only the apply writes. The apply holds an advisory lock so
 * two runs take turns, and runs in a single transaction: any error rolls everything back.
 */
export async function runMigration(options: RunOptions): Promise<RunResult> {
  const { db, apply } = options;
  const now = options.now ?? new Date();
  if (apply && db === null) {
    throw new MigrationToolError(
      'no_database',
      'An apply needs a database; offline is dry run only',
    );
  }

  const reportFor = (plan: Plan, target: TargetState, applied: Applied | null): Report =>
    ReportSchema.parse({
      schemaVersion: REPORT_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      target: target.kind,
      seasonTag: SEASON_TAG,
      ...plan.counts,
      ...(applied ? { applied } : {}),
      notCarried: ['push_subscriptions', 'accounts'],
    });

  let target: TargetState;
  let plan: Plan;
  let before: Snapshot | null = null;
  let applied: Applied | null = null;

  if (db === null) {
    target = offlineTarget();
    plan = buildPlan({ ...options.input, target });
  } else {
    await db.exec(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    try {
      if (apply) await db.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK_KEY]);
      target = await loadTargetState(db);
      plan = buildPlan({ ...options.input, target });
      if (apply) {
        options.beforeApply?.(reportFor(plan, target, null));
        before = await takeSnapshot(db, now);
        const inserted = await applyPlan(db, plan, target);
        applied = { inserted, insertedByCity: insertedByCity(plan) };
      }
      await db.exec(apply ? 'COMMIT' : 'ROLLBACK');
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
      } catch {
        // The original error is the one worth reporting.
      }
      throw error;
    }
  }

  return { report: reportFor(plan, target, applied), plan, before };
}

interface Applied {
  inserted: Inserted;
  insertedByCity: Record<string, { venues: number; registrations: number }>;
}

function insertedByCity(plan: Plan): Applied['insertedByCity'] {
  const out: Applied['insertedByCity'] = {};
  const bump = (slug: string, key: 'venues' | 'registrations') => {
    const entry = (out[slug] ??= { venues: 0, registrations: 0 });
    entry[key] += 1;
  };
  for (const v of plan.venues) bump(v.citySlug, 'venues');
  for (const r of plan.registrations) bump(r.citySlug, 'registrations');
  return out;
}

/**
 * A short fingerprint of the reviewed plan: the report's counts (not its time or mode) plus the
 * digests of the input files. An apply must be given the fingerprint the owner approved, so the
 * data cannot change between review and apply.
 */
export function planFingerprint(report: Report, inputDigests: Record<string, string>): string {
  const { totals, cities, mapping, areas, provided } = report;
  const canonical = JSON.stringify({ provided, mapping, areas, totals, cities, inputDigests });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
