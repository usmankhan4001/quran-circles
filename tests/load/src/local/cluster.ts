import { execFileSync } from 'node:child_process';
import { chownSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { freePort, run } from '@qc/e2e/src/stack/processes';

/**
 * A private Postgres 16 cluster for one local run, like the e2e stack's, but started with
 * `pg_stat_statements` preloaded so the load run can report per-statement database load. The
 * e2e stack is then pointed at it with E2E_DATABASE_URL and creates its own fresh database on it.
 * Loopback only, trust auth, deleted afterwards.
 */
export interface Cluster {
  serverUrl: string;
  port: number;
  /** The postmaster's PID, so the caller can report and stop exactly this process. */
  pid: number;
  stop(): Promise<void>;
}

const BIN_DIRS = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/17/bin'];

export async function startCluster(): Promise<Cluster> {
  const bin = BIN_DIRS.find((d) => existsSync(join(d, 'initdb')));
  if (!bin) throw new Error(`no Postgres server binaries in ${BIN_DIRS.join(' or ')}`);
  const root = typeof process.getuid === 'function' && process.getuid() === 0;
  const dir = mkdtempSync(join(tmpdir(), 'qc-load-pg-'));
  if (root) {
    const uid = Number(execFileSync('id', ['-u', 'postgres'], { encoding: 'utf8' }).trim());
    const gid = Number(execFileSync('id', ['-g', 'postgres'], { encoding: 'utf8' }).trim());
    chownSync(dir, uid, gid);
  }
  const data = join(dir, 'data');
  const port = await freePort();
  const exec = async (tool: string, args: string[]): Promise<string> => {
    const full = join(bin, tool);
    return run({
      name: tool,
      command: root ? 'runuser' : full,
      args: root ? ['-u', 'postgres', '--', full, ...args] : args,
      cwd: dir,
      env: {},
      timeoutMs: 120_000,
    });
  };
  await exec('initdb', ['-D', data, '-U', 'qc', '--auth=trust', '-E', 'UTF8', '--no-sync']);
  // Settings as the e2e cluster (durability off: this is a throwaway), plus statement stats and
  // enough connections for the API, the worker, pg-boss and the sampler.
  const opts = [
    `-p ${port}`,
    `-k ${dir}`,
    '-c listen_addresses=127.0.0.1',
    '-c fsync=off',
    '-c full_page_writes=off',
    '-c synchronous_commit=off',
    '-c max_connections=200',
    '-c shared_preload_libraries=pg_stat_statements',
    '-c pg_stat_statements.track=all',
    '-c track_io_timing=on',
  ].join(' ');
  await exec('pg_ctl', ['-D', data, '-l', join(dir, 'postgres.log'), '-w', '-o', opts, 'start']);
  const serverUrl = `postgres://qc@127.0.0.1:${port}/postgres`;
  const client = new pg.Client({ connectionString: serverUrl });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
  } finally {
    await client.end();
  }
  const pid = Number(readFileSync(join(data, 'postmaster.pid'), 'utf8').split('\n')[0]);
  return {
    serverUrl,
    port,
    pid,
    async stop() {
      try {
        await exec('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
