import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startStack, FIXED_CODE, type RunningStack } from '@qc/e2e/src/stack/stack';
import { REPO_DIR, TSX_BIN } from '@qc/e2e/src/stack/paths';
import { run } from '@qc/e2e/src/stack/processes';
import { LOAD_DIR, RESULTS_DIR, arg, writeReport } from '../args';
import { formatLoad } from '../load/format';
import { formatAnalyze, formatStatements, parseWaitSeconds } from '../load/prep';
import { runEvening } from '../load/run';
import { SCENARIO, type ScenarioFile } from '../load/scenario';
import { seedEvening } from '../load/seed';
import { Synthetic, signIn, type Api } from '../people';
import { formatMatrix, runScope } from '../scope/run';
import { startCluster, type Cluster } from './cluster';
import { analyzeDatabase } from './dbprep';
import { DbSampler, databaseProbe, insertBulkPushUsers, type DbStepStats } from './dbstats';
import { CpuSampler, pidOnPort } from './procstats';

/**
 * `pnpm --filter @qc/load local [--only scope|load|k6] [--steps 10,25,50] [--duration 40]
 *   [--users 800] [--venues 200] [--bulk-push-users 5000] [--k6-bin <path>] [--after-seed-wait <s>]`
 *
 * The stand-in for staging: starts a private Postgres 16 (with pg_stat_statements), the e2e
 * stack's real API and worker on free ports (no web targets, no stack file), bootstraps national
 * admins with the `@qc/db` command, runs the scope matrix and the evening load test, writes the
 * reports and stops everything it started. Between the seed and the first step it runs ANALYZE on
 * the seeded tables and resets pg_stat_statements; the report ends with the top 15 statements.
 * Results on a shared container are provisional.
 */
const argv = process.argv.slice(2);
const only = arg(argv, 'only');
const log = (line: string): void =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);

const synthetic = new Synthetic('+92316');

async function bootstrapAdmin(databaseUrl: string): Promise<string> {
  const phone = synthetic.phone();
  const output = await run({
    name: 'bootstrap-admin',
    command: TSX_BIN,
    args: ['src/cli/bootstrap-admin.ts', '--phone', phone, '--force-additional'],
    cwd: join(REPO_DIR, 'packages', 'db'),
    env: { DATABASE_URL: databaseUrl, APP_ENV: 'test' },
    timeoutMs: 60_000,
  });
  if (!/^invite [0-9a-f-]{36}$/m.test(output))
    throw new Error('bootstrap-admin printed no invite id');
  return phone;
}

function scenarioWithOverrides(): ScenarioFile {
  const num = (name: string): number | undefined => {
    const v = arg(argv, name);
    return v === undefined ? undefined : Number(v);
  };
  const duration = num('duration');
  const stepsArg = arg(argv, 'steps');
  const steps = stepsArg
    ? stepsArg.split(',').map((v) => ({ vus: Number(v), durationS: duration ?? 40 }))
    : SCENARIO.steps.map((s) => ({ ...s, durationS: duration ?? s.durationS }));
  return {
    ...SCENARIO,
    seed: {
      ...SCENARIO.seed,
      users: num('users') ?? SCENARIO.seed.users,
      venues: num('venues') ?? SCENARIO.seed.venues,
      bulkPushUsers: num('bulk-push-users') ?? SCENARIO.seed.bulkPushUsers,
    },
    steps,
  };
}

function dbLines(db: DbStepStats): string[] {
  const s = db.statements;
  const out = [
    `db: ${db.database.commits} commits, ${db.database.rollbacks} rollbacks, cache hit ${db.database.cacheHitRatio}, ` +
      `tuples ret ${db.database.tuplesReturned} ins ${db.database.tuplesInserted} upd ${db.database.tuplesUpdated} del ${db.database.tuplesDeleted}, ` +
      `deadlocks ${db.database.deadlocks}, temp ${db.database.tempBytes} B`,
    `db activity: max ${db.activity.maxConnections} connections, max ${db.activity.maxActive} active (mean ${db.activity.meanActive}), ` +
      `max ${db.activity.maxWaitingOnLock} waiting on locks; load average ${db.loadAverage1m}`,
    ...(db.cpu
      ? [
          `cpu (% of one core, ${db.cpu.cpus} cores): api ${db.cpu.api ?? '-'}, worker ${db.cpu.worker ?? '-'}, ` +
            `postgres ${db.cpu.postgres ?? '-'}, load generator ${db.cpu.loadGenerator}`,
        ]
      : []),
    s
      ? `db statements: ${s.calls} calls, ${s.totalMs} ms total; top by total time (max since the reset):`
      : 'db statements: pg_stat_statements not available',
  ];
  for (const t of s?.top.slice(0, 6) ?? []) {
    out.push(
      `  ${String(t.totalMs).padStart(10)} ms ${String(t.calls).padStart(7)} calls mean ${t.meanMs} max ${t.maxMs}  ${t.query.slice(0, 110)}`,
    );
  }
  return out;
}

let cluster: Cluster | null = null;
let stack: RunningStack | null = null;
const cleanup = async (): Promise<void> => {
  if (stack) await stack.stop().catch(() => undefined);
  stack = null;
  if (cluster) await cluster.stop().catch(() => undefined);
  cluster = null;
};
process.once('SIGINT', () => {
  void cleanup().finally(() => process.exit(130));
});

try {
  log('starting Postgres 16 with pg_stat_statements');
  cluster = await startCluster();
  log(`postgres pid ${cluster.pid} on port ${cluster.port}`);
  process.env.E2E_DATABASE_URL = cluster.serverUrl;
  log('starting the API and the worker (e2e stack, no web targets)');
  stack = await startStack({ web: false, writeStackFile: false });
  const info = stack.info;
  log(`api ${info.apiUrl}, worker ${info.workerUrl}, logs ${info.logDir}`);
  const dbName = new URL(info.databaseUrl).pathname.slice(1);

  if (only === undefined || only === 'scope') {
    log('scope matrix');
    const report = await runScope({
      baseUrl: info.apiUrl,
      fixedCode: FIXED_CODE,
      adminPhone: await bootstrapAdmin(info.databaseUrl),
      log,
    });
    console.log(`\n${formatMatrix(report)}\n`);
    const file = writeReport(`scope-local-${report.runTag}.json`, { provisional: true, ...report });
    log(
      `scope: ${report.totals.calls} calls, ${report.totals.mismatches} mismatch(es), ` +
        `${report.tampered.length} tampered, ${report.endpoints.covered}/${report.endpoints.total} endpoints; ${file}`,
    );
    for (const m of report.mismatches) log(`MISMATCH ${m.scenario} as ${m.caller}: ${m.reason}`);
  }

  if (only === undefined || only === 'load') {
    const scenario = scenarioWithOverrides();
    const api: Api = {
      baseUrl: info.apiUrl,
      fixedCode: FIXED_CODE,
      synthetic: new Synthetic('+92315'),
      options: { retry429: 4 },
    };
    const admin = await signIn(api, 'national admin', await bootstrapAdmin(info.databaseUrl));
    const bulk = await insertBulkPushUsers(info.databaseUrl, scenario.seed.bulkPushUsers);
    log(`inserted ${bulk} bulk synthetic push recipients (local only)`);
    const data = await seedEvening(api, admin, scenario, log);
    log(
      `seeded ${data.venueIds.length} venues, ${data.sessionIds.length} sessions, ${data.users.length} users`,
    );
    // Fresh planner statistics on what the seed just wrote, as a real evening has: without them
    // the planner still sees near-empty tables and one baseline spent about 9x the database time.
    const analyze = await analyzeDatabase(info.databaseUrl);
    log(analyze.ran ? formatAnalyze(analyze) : `WARNING ${formatAnalyze(analyze)}`);
    const cpu = new CpuSampler({
      api: pidOnPort(Number(new URL(info.apiUrl).port)),
      worker: pidOnPort(Number(new URL(info.workerUrl).port)),
      postmaster: cluster.pid,
    });
    const sampler = new DbSampler(cluster.serverUrl, dbName, cpu);
    const probe = databaseProbe(info.databaseUrl);
    try {
      log(
        (await sampler.statements.reset())
          ? 'pg_stat_statements reset just before the load steps'
          : 'pg_stat_statements not available; statement figures skipped',
      );
      const report = await runEvening<DbStepStats>({
        api,
        admin,
        scenario,
        data,
        probe,
        sampler,
        bulkPushUsers: bulk,
        log,
      });
      const statements = await sampler.statements.report(15);
      console.log(
        `\n${formatLoad(report, dbLines)}\n${[formatAnalyze(analyze), ...formatStatements(statements, 15)].join('\n')}\n`,
      );
      const file = writeReport(`load-local-${data.runTag}.json`, {
        ...report,
        analyze,
        statements,
        environment: {
          note: 'Local stack on a shared container: API, worker, Postgres and the load generator share the same CPUs. Provisional.',
          workerPollMs: 500,
          apiDbPool: 10,
          postgres: info.databaseHow,
        },
      });
      log(`load report: ${file}`);
    } finally {
      await probe.close();
      await sampler.close();
    }
  }

  if (only === 'k6') {
    // The k6 script against the local stack, to prove it before staging. `--k6-bin` names the
    // binary (k6 is not a dependency of the repository).
    const bin = arg(argv, 'k6-bin') ?? 'k6';
    const users = arg(argv, 'users') ?? '200';
    const summary = join(RESULTS_DIR, `k6-local-${Date.now().toString(36)}.json`);
    const adminPhone = await bootstrapAdmin(info.databaseUrl);
    mkdirSync(RESULTS_DIR, { recursive: true });
    log(`k6 run k6/ramadan-evening.js (${users} users)`);
    const code = await new Promise<number>((done, fail) => {
      const child = spawn(bin, ['run', '--summary-export', summary, 'k6/ramadan-evening.js'], {
        cwd: LOAD_DIR,
        stdio: 'inherit',
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          QC_BASE_URL: info.apiUrl,
          QC_WORKER_URL: info.workerUrl,
          QC_FIXED_CODE: FIXED_CODE,
          QC_ADMIN_PHONE: adminPhone,
          QC_USERS: users,
          // The k6 script seeds in its own setup, so the runner cannot ANALYZE between the seed
          // and the steps; `--after-seed-wait` lets autovacuum do it first.
          QC_AFTER_SEED_WAIT_S: String(parseWaitSeconds(arg(argv, 'after-seed-wait'))),
          K6_NO_USAGE_REPORT: 'true',
        },
      });
      child.once('error', fail);
      child.once('exit', (c) => done(c ?? 1));
    }).catch(async (error: unknown) => {
      log(`k6 did not start: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    });
    log(`k6 exited ${code}; summary ${summary}`);
  }
} finally {
  log('stopping the stack and Postgres');
  await cleanup();
}
