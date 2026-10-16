import pg from 'pg';
import { pgExecutor } from '@qc/db';
import { runCli, type CliContext } from './cli';

/** Opens one connection that cannot write: the session itself is set read-only. */
async function connectV1(url: string) {
  const client = new pg.Client({
    connectionString: url,
    options: '-c default_transaction_read_only=on',
  });
  await client.connect();
  return { client, close: () => client.end() };
}

async function connectTarget(url: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return { db: pgExecutor(client), close: () => client.end() };
}

const context: CliContext = {
  cwd: process.cwd(),
  env: process.env,
  now: () => new Date(),
  out: (line) => process.stdout.write(line + '\n'),
  err: (line) => process.stderr.write(line + '\n'),
  connectTarget,
  connectV1,
};

process.exitCode = await runCli(process.argv.slice(2), context);
