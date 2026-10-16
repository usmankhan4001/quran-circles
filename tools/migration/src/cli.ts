import type { SqlExecutor } from '@qc/db';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { formatCsv, guardCell, parseCsvObjects } from './csv';
import { describeFailure, MigrationToolError } from './errors';
import {
  exportNeonTables,
  exportVenuesFromPostgres,
  exportVenuesFromRest,
  type QueryClient,
} from './export';
import { loadInputs, readRowsFile, writeFileSafe } from './files';
import { proposeMapping, readMapping } from './places';
import { ReportSchema, summaryLines } from './report';
import { planFingerprint, runMigration } from './run';
import { SnapshotSchema, takeSnapshot, verifySnapshots } from './snapshot';
import { V1VenueRow } from './v1';

export interface CliContext {
  cwd: string;
  env: Record<string, string | undefined>;
  now: () => Date;
  /** Everything printed goes through these two. Only fixed text, counts and city slugs reach them. */
  out: (line: string) => void;
  err: (line: string) => void;
  /** Connects to the V2 database (DATABASE_URL). */
  connectTarget: (url: string) => Promise<{ db: SqlExecutor; close: () => Promise<void> }>;
  /** Opens a read-only client on a V1 Postgres database. */
  connectV1: (url: string) => Promise<{ client: QueryClient; close: () => Promise<void> }>;
  fetchImpl?: typeof fetch;
}

const USAGE = `Usage: tsx src/bin.ts <command> [options]

Commands
  export            Read V1 into local files (read-only). Needs V1_* environment variables.
  propose-mapping   Propose city and area for each V1 venue, as a CSV for a person to review.
  migrate           Dry run by default; --apply writes. Needs DATABASE_URL (or --offline).
  snapshot          Write database row counts to a file.
  verify            Compare counts before and after an apply.

Common options
  --in <dir>        Folder with venues/registrations/subscribers .json or .csv (default out/export)
  --out <path>      Where to write (export: a folder; propose-mapping, snapshot: a file)
migrate options
  --mapping <csv>   The reviewed mapping
  --create-areas    Create the areas named in approved mapping rows (cities are never created)
  --offline         Dry run with no database (the nine V1 cities, nothing else)
  --apply           Write to the database in one transaction
  --confirm <id>    The plan fingerprint printed by the dry run you reviewed (required with --apply)
  --report <path>   Report file (default out/reports/<mode>-<time>.json)
verify options
  --before <json>   Snapshot taken before the apply (written next to the apply report)
  --report <json>   The apply report`;

const OPTIONS = {
  in: { type: 'string' },
  out: { type: 'string' },
  mapping: { type: 'string' },
  report: { type: 'string' },
  before: { type: 'string' },
  confirm: { type: 'string' },
  only: { type: 'string' },
  apply: { type: 'boolean' },
  offline: { type: 'boolean' },
  'create-areas': { type: 'boolean' },
  force: { type: 'boolean' },
  help: { type: 'boolean' },
} as const;

const stamp = (d: Date) => d.toISOString().replace(/[:.]/g, '-');

const readText = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new MigrationToolError('missing_file', 'A file given on the command line was not found');
  }
};

async function connectTarget(ctx: CliContext) {
  const url = ctx.env.DATABASE_URL;
  if (!url) {
    throw new MigrationToolError(
      'no_database',
      'DATABASE_URL is not set (use --offline for a dry run with no database)',
    );
  }
  return ctx.connectTarget(url);
}

// ------------------------------------------------------------------------------------ export
async function runExport(ctx: CliContext, values: Values): Promise<number> {
  const outDir = resolve(ctx.cwd, values.out ?? 'out/export');
  const only = new Set((values.only ?? 'venues,registrations,subscribers').split(','));
  const counts: Record<string, number> = {};

  if (only.has('venues')) {
    let rows: unknown[];
    const { V1_SUPABASE_URL, V1_SUPABASE_ANON_KEY, V1_VENUES_DATABASE_URL } = ctx.env;
    if (V1_SUPABASE_URL && V1_SUPABASE_ANON_KEY) {
      rows = await exportVenuesFromRest({
        url: V1_SUPABASE_URL,
        anonKey: V1_SUPABASE_ANON_KEY,
        ...(ctx.fetchImpl ? { fetchImpl: ctx.fetchImpl } : {}),
      });
    } else if (V1_VENUES_DATABASE_URL) {
      const conn = await ctx.connectV1(V1_VENUES_DATABASE_URL);
      try {
        rows = await exportVenuesFromPostgres(conn.client);
      } finally {
        await conn.close();
      }
    } else {
      throw new MigrationToolError(
        'no_venue_source',
        'Set V1_SUPABASE_URL and V1_SUPABASE_ANON_KEY, or V1_VENUES_DATABASE_URL',
      );
    }
    writeFileSafe(resolve(outDir, 'venues.json'), JSON.stringify(rows, null, 2), true);
    counts.venues = rows.length;
  }

  if (only.has('registrations') || only.has('subscribers')) {
    const url = ctx.env.V1_NEON_DATABASE_URL;
    if (!url) throw new MigrationToolError('no_neon_source', 'Set V1_NEON_DATABASE_URL');
    const conn = await ctx.connectV1(url);
    try {
      const data = await exportNeonTables(conn.client);
      if (only.has('registrations')) {
        writeFileSafe(
          resolve(outDir, 'registrations.json'),
          JSON.stringify(data.registrations, null, 2),
          true,
        );
        counts.registrations = data.registrations.length;
      }
      if (only.has('subscribers')) {
        writeFileSafe(
          resolve(outDir, 'subscribers.json'),
          JSON.stringify(data.subscribers, null, 2),
          true,
        );
        counts.subscribers = data.subscribers.length;
      }
    } finally {
      await conn.close();
    }
  }

  for (const [name, n] of Object.entries(counts)) ctx.out(`exported ${name}: ${n} rows`);
  ctx.out('Files are private (owner-only) and contain personal data. Never commit them.');
  return 0;
}

// ------------------------------------------------------------------------ propose-mapping
function runProposeMapping(ctx: CliContext, values: Values): number {
  const inDir = resolve(ctx.cwd, values.in ?? 'out/export');
  const outPath = resolve(ctx.cwd, values.out ?? 'out/mapping/venues-mapping.csv');
  if (existsSync(outPath) && !values.force) {
    throw new MigrationToolError(
      'would_overwrite',
      'The mapping file already exists and may hold a person\'s review; pass --force to replace it',
    );
  }
  const inputs = loadInputs(inDir);
  if (!inputs.venues) {
    throw new MigrationToolError('no_input', 'There is no venues file in the input folder');
  }
  const venues = inputs.venues.flatMap((row) => {
    const parsed = V1VenueRow.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  const rows = proposeMapping(venues);
  writeFileSafe(outPath, formatCsv(rows));
  ctx.out(`proposed mapping for ${rows.length - 1} venues (${inputs.venues.length} read)`);
  ctx.out('Review the file, fix city_slug and area_slug, and set approved to yes for each good row.');
  return 0;
}

// ------------------------------------------------------------------------------- migrate
async function runMigrate(ctx: CliContext, values: Values): Promise<number> {
  const apply = values.apply === true;
  const offline = values.offline === true;
  if (apply && offline) {
    throw new MigrationToolError('offline_apply', '--apply cannot be combined with --offline');
  }
  const inDir = resolve(ctx.cwd, values.in ?? 'out/export');
  const inputs = loadInputs(inDir);

  let mapping = null;
  const digests = { ...inputs.digests };
  if (values.mapping) {
    const path = resolve(ctx.cwd, values.mapping);
    const text = readText(path);
    mapping = readMapping(parseCsvObjects(text));
    digests.mapping = readRowsFile(path).digest;
  } else if (inputs.venues) {
    ctx.out('note: no --mapping given, so every venue is counted as not approved');
  }

  const confirm = values.confirm;
  if (apply && !confirm) {
    throw new MigrationToolError(
      'not_approved',
      'An apply needs --confirm <fingerprint> from a dry run that a person has reviewed',
    );
  }

  const now = ctx.now();
  const connection = offline ? null : await connectTarget(ctx);
  try {
    const result = await runMigration({
      db: connection?.db ?? null,
      apply,
      now,
      input: {
        venues: inputs.venues,
        registrations: inputs.registrations,
        subscribers: inputs.subscribers,
        mapping,
        createAreas: values['create-areas'] === true,
      },
      beforeApply: (report) => {
        if (planFingerprint(report, digests) !== confirm) {
          throw new MigrationToolError(
            'not_approved',
            'The plan does not match the approved fingerprint. Run the dry run again and review it',
          );
        }
      },
    });

    const mode = apply ? 'apply' : 'dry-run';
    const reportPath = resolve(ctx.cwd, values.report ?? `out/reports/${mode}-${stamp(now)}.json`);
    writeFileSafe(reportPath, JSON.stringify(result.report, null, 2) + '\n');
    const flaggedPath = reportPath.replace(/\.json$/, '') + '.flagged.csv';
    writeFileSafe(
      flaggedPath,
      formatCsv([
        ['dataset', 'row', 'source_id', 'reason', 'detail'],
        ...result.plan.flagged.map((f) => [
          f.dataset,
          String(f.row),
          guardCell(f.sourceId ?? ''),
          f.reason,
          f.detail ?? '',
        ]),
      ]),
    );
    if (apply && result.before) {
      writeFileSafe(
        reportPath.replace(/\.json$/, '') + '.before.json',
        JSON.stringify(result.before, null, 2) + '\n',
      );
    }

    ctx.out(`${mode}${offline ? ' (offline)' : ''}: per-city counts (new / already present)`);
    for (const line of summaryLines(result.report)) ctx.out(line);
    ctx.out(`rows needing a human decision or skipped: ${result.plan.flagged.length}`);
    ctx.out(`report: ${reportPath}`);
    ctx.out(`flagged rows (ids and reasons only): ${flaggedPath}`);
    if (apply) {
      ctx.out('applied in one transaction. Now run verify.');
    } else {
      ctx.out(`plan fingerprint: ${planFingerprint(result.report, digests)}`);
      ctx.out('Review the report and the flagged rows. To apply, run migrate:apply with --confirm and this fingerprint.');
    }
    return 0;
  } finally {
    await connection?.close();
  }
}

// ----------------------------------------------------------------------- snapshot / verify
async function runSnapshot(ctx: CliContext, values: Values): Promise<number> {
  const outPath = resolve(ctx.cwd, values.out ?? `out/reports/snapshot-${stamp(ctx.now())}.json`);
  const connection = await connectTarget(ctx);
  try {
    const snapshot = await takeSnapshot(connection.db, ctx.now());
    writeFileSafe(outPath, JSON.stringify(snapshot, null, 2) + '\n');
    ctx.out(`snapshot: ${outPath}`);
    return 0;
  } finally {
    await connection.close();
  }
}

async function runVerify(ctx: CliContext, values: Values): Promise<number> {
  if (!values.report) {
    throw new MigrationToolError('usage', 'verify needs --report <apply report> (and --before)');
  }
  const reportPath = resolve(ctx.cwd, values.report);
  const beforePath = resolve(ctx.cwd, values.before ?? reportPath.replace(/\.json$/, '.before.json'));
  const report = ReportSchema.parse(JSON.parse(readText(reportPath)));
  if (report.mode !== 'apply' || !report.applied) {
    throw new MigrationToolError('usage', 'verify needs the report of an apply, not a dry run');
  }
  const before = SnapshotSchema.parse(JSON.parse(readText(beforePath)));
  const connection = await connectTarget(ctx);
  try {
    const after = await takeSnapshot(connection.db, ctx.now());
    const result = verifySnapshots({
      before,
      after,
      inserted: report.applied.inserted,
      insertedByCity: report.applied.insertedByCity,
    });
    for (const check of result.checks) {
      ctx.out(
        `${check.ok ? 'ok  ' : 'FAIL'} ${check.name}: expected ${check.expected}, found ${check.actual}`,
      );
    }
    ctx.out(result.ok ? 'verification passed' : 'verification FAILED');
    return result.ok ? 0 : 1;
  } finally {
    await connection.close();
  }
}

type Values = ReturnType<typeof parse>['values'];

function parse(argv: readonly string[]) {
  return parseArgs({
    args: argv.filter((a) => a !== '--'),
    options: OPTIONS,
    allowPositionals: true,
    strict: true,
  });
}

/** Runs one command. Returns the process exit code. Never prints row data or error details. */
export async function runCli(argv: readonly string[], ctx: CliContext): Promise<number> {
  try {
    const { values, positionals } = parse(argv);
    const [command] = positionals;
    if (values.help || !command) {
      ctx.out(USAGE);
      return values.help ? 0 : 2;
    }
    switch (command) {
      case 'export':
        return await runExport(ctx, values);
      case 'propose-mapping':
        return runProposeMapping(ctx, values);
      case 'migrate':
        return await runMigrate(ctx, values);
      case 'snapshot':
        return await runSnapshot(ctx, values);
      case 'verify':
        return await runVerify(ctx, values);
      default:
        ctx.err(`error: unknown command "${command.slice(0, 40)}"`);
        ctx.out(USAGE);
        return 2;
    }
  } catch (error) {
    if (error instanceof TypeError && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS')) {
      ctx.err('error: bad command line options (see --help)');
      return 2;
    }
    ctx.err(`error: ${describeFailure(error)}`);
    return 1;
  }
}
