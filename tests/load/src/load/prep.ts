/**
 * The database steps around a load run, as they appear in the report: `ANALYZE` on the tables the
 * seed filled (fresh planner statistics, as a real evening has), and pg_stat_statements reset just
 * before the load steps with the top statements by total time afterwards.
 *
 * A local run does both itself (`../local/dbprep`). A remote run reaches the API only, so it says
 * so in the report and can pause after seeding (`--after-seed-wait`) for autovacuum or an operator
 * to analyse the seeded tables (CR `docs/engineering/change-requests/2026-10-18-load-runner-analyze.md`).
 */

export const CR = 'docs/engineering/change-requests/2026-10-18-load-runner-analyze.md';

export interface AnalyzeResult {
  ran: boolean;
  /** Tables analysed. */
  tables: string[];
  /** Tables the seed writes that this database does not have (schema changed). */
  missing: string[];
  ms: number | null;
  note: string;
}

export interface StatementRow {
  query: string;
  calls: number;
  totalMs: number;
  meanMs: number;
  /** pg_stat_statements keeps one maximum per statement since its last reset, not per interval. */
  maxMs: number;
  rows: number;
}

export interface StatementTotals {
  calls: number;
  totalMs: number;
  top: StatementRow[];
}

export type StatementsReport =
  | ({ available: true; resetAt: string | null; note: string } & StatementTotals)
  | { available: false; note: string };

/** The statements block of a remote report: the runner reaches the API only. */
export const REMOTE_STATEMENTS: StatementsReport = {
  available: false,
  note:
    'pg_stat_statements not read: a remote run reaches the API only. Reset it as qc in the postgres ' +
    'database after the seed and read the top statements after the run (infra/README.md, "Query statistics").',
};

/** The analyse block of a remote report. */
export function remoteAnalyze(afterSeedWaitS: number): AnalyzeResult {
  return {
    ran: false,
    tables: [],
    missing: [],
    ms: null,
    note:
      afterSeedWaitS > 0
        ? `ANALYZE not run by the runner (a remote run reaches the API only); waited ${afterSeedWaitS} s ` +
          `after seeding for autovacuum or ANALYZE as qc (${CR})`
        : `ANALYZE not run (a remote run reaches the API only): the seeded tables may have stale planner ` +
          `statistics. Run ANALYZE as qc between the seed and the steps, or pass --after-seed-wait (${CR})`,
  };
}

/**
 * `--after-seed-wait` / `QC_AFTER_SEED_WAIT_S`: whole seconds, 0 when not given. At most 900, so
 * the seeded people's 15-minute access tokens do not all expire before the first step.
 */
export function parseWaitSeconds(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 900) {
    throw new Error(`--after-seed-wait must be whole seconds from 0 to 900, got "${value}"`);
  }
  return n;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** The pause between the seed and the first step of a remote run. */
export async function afterSeedWait(
  seconds: number,
  log: (line: string) => void,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<void> {
  if (seconds <= 0) return;
  log(
    `seeded; waiting ${seconds} s before the first step so the seeded tables get analysed ` +
      `(autovacuum, or ANALYZE as qc now)`,
  );
  await sleep(seconds * 1000);
}

export function formatAnalyze(a: AnalyzeResult): string {
  return `analyze: ${a.note}`;
}

/** The whole-run statements block of the text summary. */
export function formatStatements(s: StatementsReport, limit = 15): string[] {
  if (!s.available) return [`db statements: ${s.note}`];
  const out = [
    `db statements over the load (${s.note}): ${s.calls} calls, ${s.totalMs} ms total; ` +
      `top ${Math.min(limit, s.top.length)} by total time:`,
    `  ${'total ms'.padStart(10)} ${'calls'.padStart(8)} ${'mean ms'.padStart(9)} ${'max ms'.padStart(9)}  query`,
  ];
  for (const t of s.top.slice(0, limit)) {
    out.push(
      `  ${String(t.totalMs).padStart(10)} ${String(t.calls).padStart(8)} ${String(t.meanMs).padStart(9)} ` +
        `${String(t.maxMs).padStart(9)}  ${t.query.slice(0, 140)}`,
    );
  }
  return out;
}
