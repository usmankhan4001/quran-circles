import { execFileSync } from 'node:child_process';
import {
  chownSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { freePort, run } from './processes';

/**
 * A throwaway Postgres for one run. Two ways, in this order:
 *
 * 1. `E2E_DATABASE_URL` names a server you already run (for example
 *    `docker compose -f infra/docker-compose.dev.yml up -d`, then
 *    `E2E_DATABASE_URL=postgres://qc:qc@localhost:5432/qc`). A fresh database `qc_e2e_<random>`
 *    is created on it and dropped afterwards; your own database is never touched.
 * 2. Otherwise the Postgres server binaries on this machine (`initdb`, `pg_ctl`) start a private
 *    cluster in a temporary directory on a free port, deleted afterwards. As root, the cluster
 *    runs as the `postgres` system user, because Postgres refuses to run as root.
 *
 * If neither is available the run fails with this explanation; it never falls back to skipping.
 */
export interface Database {
  url: string;
  how: string;
  stop(): Promise<void>;
}

export async function startDatabase(): Promise<Database> {
  const external = process.env.E2E_DATABASE_URL;
  if (external) return freshDatabaseOn(external);
  const bin = findPostgresBin();
  if (!bin) {
    throw new Error(
      'No Postgres for the end-to-end run. Either set E2E_DATABASE_URL to a server where the user ' +
        'may create databases (infra/docker-compose.dev.yml gives postgres://qc:qc@localhost:5432/qc), ' +
        'or install the Postgres server binaries (initdb, pg_ctl).',
    );
  }
  return privateCluster(bin);
}

async function freshDatabaseOn(serverUrl: string): Promise<Database> {
  const name = `qc_e2e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    how: 'E2E_DATABASE_URL (fresh database)',
    async stop() {
      const client = new pg.Client({ connectionString: serverUrl });
      await client.connect();
      try {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await client.end();
      }
    },
  };
}

function findPostgresBin(): string | null {
  const candidates: string[] = [];
  try {
    candidates.push(execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim());
  } catch {
    // No pg_config on PATH.
  }
  for (const root of ['/usr/lib/postgresql', '/opt/homebrew/opt', '/usr/local/opt']) {
    if (!existsSync(root)) continue;
    const versions = readdirSync(root)
      .filter((d) => /^(postgresql@)?\d+$/.test(d))
      .sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')));
    for (const v of versions) candidates.push(join(root, v, 'bin'));
  }
  candidates.push('/usr/local/pgsql/bin', '/usr/bin');
  return (
    candidates.find((dir) => existsSync(join(dir, 'initdb')) && existsSync(join(dir, 'pg_ctl'))) ??
    null
  );
}

interface RunAs {
  command: (bin: string, args: string[]) => { command: string; args: string[] };
  uid?: number;
  gid?: number;
}

function runAs(): RunAs {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
    return { command: (command, args) => ({ command, args }) };
  }
  let uid: number;
  let gid: number;
  try {
    uid = Number(execFileSync('id', ['-u', 'postgres'], { encoding: 'utf8' }).trim());
    gid = Number(execFileSync('id', ['-g', 'postgres'], { encoding: 'utf8' }).trim());
  } catch {
    throw new Error(
      'Running as root and there is no "postgres" system user to run the private cluster as. ' +
        'Set E2E_DATABASE_URL instead.',
    );
  }
  return {
    command: (command, args) => ({
      command: 'runuser',
      args: ['-u', 'postgres', '--', command, ...args],
    }),
    uid,
    gid,
  };
}

/** Removes clusters left behind by a run that was killed before it could clean up. */
function pruneStaleClusters(): void {
  for (const name of readdirSync(tmpdir())) {
    if (!name.startsWith('qc-e2e-pg-')) continue;
    const dir = join(tmpdir(), name);
    // A cluster still being created has no pid file yet: leave anything younger than an hour.
    if (Date.now() - statSync(dir).mtimeMs < 60 * 60 * 1000) continue;
    try {
      const pid = Number(readFileSync(join(dir, 'data', 'postmaster.pid'), 'utf8').split('\n')[0]);
      process.kill(pid, 0);
      continue; // Still running: another run's cluster.
    } catch {
      // No pid file or no such process: stale.
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

async function privateCluster(bin: string): Promise<Database> {
  pruneStaleClusters();
  const as = runAs();
  const dir = mkdtempSync(join(tmpdir(), 'qc-e2e-pg-'));
  if (as.uid !== undefined && as.gid !== undefined) chownSync(dir, as.uid, as.gid);
  const data = join(dir, 'data');
  const port = await freePort();
  const exec = async (tool: string, args: string[]): Promise<void> => {
    const { command, args: full } = as.command(join(bin, tool), args);
    await run({ name: tool, command, args: full, cwd: dir, env: {}, timeoutMs: 120_000 });
  };
  await exec('initdb', ['-D', data, '-U', 'qc', '--auth=trust', '-E', 'UTF8', '--no-sync']);
  await exec('pg_ctl', [
    '-D',
    data,
    '-l',
    join(dir, 'postgres.log'),
    '-w',
    '-o',
    `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off -c full_page_writes=off -c synchronous_commit=off`,
    'start',
  ]);
  const server = `postgres://qc@127.0.0.1:${port}/postgres`;
  const admin = new pg.Client({ connectionString: server });
  await admin.connect();
  try {
    await admin.query('CREATE DATABASE qc_e2e');
  } finally {
    await admin.end();
  }
  return {
    url: `postgres://qc@127.0.0.1:${port}/qc_e2e`,
    how: `private cluster (${bin})`,
    async stop() {
      try {
        await exec('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
