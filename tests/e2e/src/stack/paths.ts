import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `tests/e2e`. */
export const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The repository root. */
export const REPO_DIR = resolve(E2E_DIR, '..', '..');

/**
 * Everything a run produces (logs, the web builds, Playwright output) lives under node_modules, so
 * the root lint and format checks never see it and git ignores it.
 */
export const CACHE_DIR = join(E2E_DIR, 'node_modules', '.cache', 'qc-e2e');
/** Written by `pnpm --filter @qc/e2e stack` only, for E2E_REUSE_STACK=1. */
export const STACK_FILE = join(CACHE_DIR, 'stack.json');

/**
 * One directory per run (`runs/<pid>`), because a run started by the root `pnpm test` can overlap
 * with another: each has its own logs and builds. Directories of finished runs are pruned at the
 * start of the next one; the last run's logs stay for reading.
 */
export interface RunDirs {
  root: string;
  logs: string;
  pwa: string;
  admin: string;
}

export function runDirs(): RunDirs {
  const runs = join(CACHE_DIR, 'runs');
  mkdirSync(runs, { recursive: true });
  for (const name of readdirSync(runs)) {
    const pid = Number(name);
    if (pid === process.pid || !Number.isInteger(pid) || alive(pid)) continue;
    rmSync(join(runs, name), { recursive: true, force: true });
  }
  const root = join(runs, String(process.pid));
  const dirs = {
    root,
    logs: join(root, 'logs'),
    pwa: join(root, 'pwa'),
    admin: join(root, 'admin-app'),
  };
  mkdirSync(dirs.logs, { recursive: true });
  return dirs;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export const TSX_BIN = join(E2E_DIR, 'node_modules', '.bin', 'tsx');
