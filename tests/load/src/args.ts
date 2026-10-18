import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `tests/load`. */
export const LOAD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Run output (JSON reports) goes under node_modules, so lint, format and git never see it, like
 * the e2e run output.
 */
export const RESULTS_DIR = join(LOAD_DIR, 'node_modules', '.cache', 'qc-load');

/** `--name value` / `--name=value`, falling back to an environment variable. */
export function arg(argv: readonly string[], name: string, env?: string): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === `--${name}`) return argv[i + 1];
    if (a?.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return env ? process.env[env] : undefined;
}

export function required(value: string | undefined, what: string): string {
  if (!value) throw new Error(`missing ${what}`);
  return value;
}

/**
 * Tests never target production. A non-local address is accepted only with
 * QC_ALLOW_REMOTE=staging, which the person running the test sets on purpose for staging.
 */
export function checkTarget(url: string): void {
  const host = new URL(url).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (local) return;
  if (process.env.QC_ALLOW_REMOTE !== 'staging') {
    throw new Error(
      `refusing to target ${host}: only localhost by default. For staging set QC_ALLOW_REMOTE=staging. Never production.`,
    );
  }
}

export function writeReport(name: string, data: unknown): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = join(RESULTS_DIR, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}
