import { randomBytes } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { startDatabase, type Database } from './postgres';
import { freePort, run, startProcess, waitForHttp, type Managed } from './processes';
import { REPO_DIR, runDirs, STACK_FILE, TSX_BIN } from './paths';
import { serveStatic } from './static-server';

/**
 * The fixed sign-in code of the API's test mode (`AUTH_FIXED_CODE`, refused when
 * APP_ENV=production). Every code request in the run is answered by this code.
 */
export const FIXED_CODE = '123456';

/** What the tests need to reach the stack. Written to `stack.json` and to `E2E_*` variables. */
export interface StackInfo {
  apiUrl: string;
  workerUrl: string;
  databaseUrl: string;
  databaseHow: string;
  fixedCode: string;
  pwaUrl: string | null;
  /** Why the PWA is not available, when it is not. The PWA tests fail with this message. */
  pwaError: string | null;
  consoleUrl: string | null;
  consoleError: string | null;
  /** The admin app's web export (the coordinators' phone app, provable on the web target). */
  adminUrl: string | null;
  adminError: string | null;
  /** This run's logs (api.log, worker.log, console.log). */
  logDir: string;
  startedAt: string;
}

export interface RunningStack {
  info: StackInfo;
  stop(): Promise<void>;
}

/**
 * Starts the real system for one run: Postgres with the real migrations and the synthetic
 * `@qc/db` seed, the real API, the real worker (fake messaging providers only; nothing leaves the
 * machine), the user app's and admin app's web exports and the console's dev server, all pointed at the real API
 * through their own public configuration.
 */
export async function startStack(
  options: { web?: boolean; writeStackFile?: boolean } = {},
): Promise<RunningStack> {
  const dirs = runDirs();
  const tsx = (name: string, script: string, cwd: string, env: Record<string, string>) =>
    startProcess({ name, command: TSX_BIN, args: [script], cwd, env, logDir: dirs.logs });
  const procs: Managed[] = [];
  const servers: Server[] = [];
  let db: Database | null = null;
  const stop = async (): Promise<void> => {
    for (const server of servers) await new Promise<void>((done) => server.close(() => done()));
    for (const proc of procs.reverse()) await proc.stop();
    if (db) await db.stop();
    rmSync(dirs.pwa, { recursive: true, force: true });
    rmSync(dirs.admin, { recursive: true, force: true });
    if (options.writeStackFile) rmSync(STACK_FILE, { force: true });
  };

  try {
    db = await startDatabase();
    const dbEnv = { DATABASE_URL: db.url, APP_ENV: 'test' };
    const dbDir = join(REPO_DIR, 'packages', 'db');
    await run({
      name: 'migrate',
      command: TSX_BIN,
      args: ['src/cli/migrate.ts'],
      cwd: dbDir,
      env: dbEnv,
    });
    await run({
      name: 'seed',
      command: TSX_BIN,
      args: ['src/cli/seed.ts'],
      cwd: dbDir,
      env: dbEnv,
    });

    const [apiPort, workerPort, pwaPort, consolePort, adminPort] = await Promise.all([
      freePort(),
      freePort(),
      freePort(),
      freePort(),
      freePort(),
    ]);
    const apiUrl = `http://127.0.0.1:${apiPort}`;
    const pwaUrl = `http://127.0.0.1:${pwaPort}`;
    const consoleUrl = `http://127.0.0.1:${consolePort}`;
    const adminUrl = `http://127.0.0.1:${adminPort}`;
    // A fresh random secret per run: nothing to leak, nothing in the repository.
    const authSecret = randomBytes(32).toString('hex');
    const messagingEnv = { MESSAGING_MODE: 'fake' };

    const api = tsx('api', 'src/index.ts', join(REPO_DIR, 'apps', 'api'), {
      ...dbEnv,
      ...messagingEnv,
      PORT: String(apiPort),
      AUTH_SECRET: authSecret,
      AUTH_FIXED_CODE: FIXED_CODE,
      // Behind the production proxy the caller address comes from X-Forwarded-For. The API-level
      // tests give each synthetic person their own address so per-address limits behave as live.
      TRUST_PROXY: 'true',
      AUTH_TRUST_PROXY: 'true',
      CORS_ORIGINS: [pwaUrl, consoleUrl, adminUrl].join(','),
      // Runtime deprecations print a stack trace, so a finding can name the code that caused it.
      NODE_OPTIONS: '--trace-deprecation --stack-trace-limit=60',
    });
    procs.push(api);
    const worker = tsx('worker', 'src/main.ts', join(REPO_DIR, 'apps', 'worker'), {
      ...dbEnv,
      ...messagingEnv,
      WORKER_HTTP_PORT: String(workerPort),
      WORKER_POLL_MS: '500',
      NODE_OPTIONS: '--trace-deprecation --stack-trace-limit=60',
    });
    procs.push(worker);
    await waitForHttp(`${apiUrl}/health`, 60_000, api);
    await waitForHttp(`http://127.0.0.1:${workerPort}/healthz`, 60_000, worker);

    let pwaError: string | null = null;
    let consoleError: string | null = null;
    let adminError: string | null = null;
    if (options.web ?? true) {
      try {
        await exportExpoWeb('user-app', dirs.pwa, apiUrl);
        servers.push(await serveStatic(dirs.pwa, pwaPort));
      } catch (error) {
        pwaError = error instanceof Error ? error.message : String(error);
      }
      try {
        await exportExpoWeb('admin-app', dirs.admin, apiUrl);
        servers.push(await serveStatic(dirs.admin, adminPort));
      } catch (error) {
        adminError = error instanceof Error ? error.message : String(error);
      }
      try {
        const vite = startProcess({
          name: 'console',
          command: join(REPO_DIR, 'apps', 'console', 'node_modules', '.bin', 'vite'),
          args: ['--port', String(consolePort), '--strictPort', '--host', '127.0.0.1'],
          cwd: join(REPO_DIR, 'apps', 'console'),
          env: { CONSOLE_API_PROXY_TARGET: apiUrl },
          logDir: dirs.logs,
        });
        procs.push(vite);
        await waitForHttp(`${consoleUrl}/`, 60_000, vite);
        // The proxy must reach the real API, not the contract mock.
        await waitForHttp(`${consoleUrl}/health`, 10_000, vite);
      } catch (error) {
        consoleError = error instanceof Error ? error.message : String(error);
      }
    } else {
      pwaError = consoleError = adminError = 'web targets not started (startStack({ web: false }))';
    }

    const info: StackInfo = {
      apiUrl,
      workerUrl: `http://127.0.0.1:${workerPort}`,
      databaseUrl: db.url,
      databaseHow: db.how,
      fixedCode: FIXED_CODE,
      pwaUrl: pwaError ? null : pwaUrl,
      pwaError,
      consoleUrl: consoleError ? null : consoleUrl,
      consoleError,
      adminUrl: adminError ? null : adminUrl,
      adminError,
      logDir: dirs.logs,
      startedAt: new Date().toISOString(),
    };
    if (options.writeStackFile) writeFileSync(STACK_FILE, JSON.stringify(info, null, 2));
    return { info, stop };
  } catch (error) {
    await stop().catch(() => undefined);
    throw error;
  }
}

/**
 * Exports an Expo app for the web with the real API's address in its own public setting
 * (`EXPO_PUBLIC_API_URL`), as a release build would. Output goes to the run's cache, never into
 * the app's directory.
 */
async function exportExpoWeb(app: string, outDir: string, apiUrl: string): Promise<void> {
  rmSync(outDir, { recursive: true, force: true });
  const appDir = join(REPO_DIR, 'apps', app);
  await run({
    name: `${app}-export`,
    command: join(appDir, 'node_modules', '.bin', 'expo'),
    args: ['export', '--platform', 'web', '--output-dir', outDir],
    cwd: appDir,
    env: { EXPO_PUBLIC_API_URL: apiUrl, CI: '1' },
    timeoutMs: 600_000,
  });
}

/** Reads the stack a running `pnpm --filter @qc/e2e stack` wrote, if any. */
export function readStackFile(): StackInfo | null {
  try {
    return JSON.parse(readFileSync(STACK_FILE, 'utf8')) as StackInfo;
  } catch {
    return null;
  }
}

/** Puts the stack's addresses where the test workers read them. */
export function exportStackEnv(info: StackInfo): void {
  process.env.E2E_STACK = JSON.stringify(info);
}
