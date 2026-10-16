import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseCsvObjects } from './csv';
import { MigrationToolError } from './errors';
import type { Dataset } from './report';

export const DATASETS: readonly Dataset[] = ['venues', 'registrations', 'subscribers'];

export interface LoadedInputs {
  venues: unknown[] | null;
  registrations: unknown[] | null;
  subscribers: unknown[] | null;
  /** First 16 hex characters of the SHA-256 of each file read. Not reversible. */
  digests: Record<string, string>;
}

const digestOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

/** Reads one export file: a JSON array of row objects, or a CSV with a header row. */
export function readRowsFile(path: string): { rows: unknown[]; digest: string } {
  const bytes = readFileSync(path);
  const text = bytes.toString('utf8');
  if (path.endsWith('.json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new MigrationToolError('bad_json', 'An input file is not valid JSON');
    }
    if (!Array.isArray(parsed)) {
      throw new MigrationToolError('bad_json', 'An input JSON file must hold an array of rows');
    }
    return { rows: parsed, digest: digestOf(bytes) };
  }
  try {
    return { rows: parseCsvObjects(text), digest: digestOf(bytes) };
  } catch {
    throw new MigrationToolError('bad_csv', 'An input CSV file is malformed');
  }
}

/** Finds `venues`, `registrations` and `subscribers` (.json or .csv) in a directory. */
export function loadInputs(dir: string): LoadedInputs {
  const out: LoadedInputs = { venues: null, registrations: null, subscribers: null, digests: {} };
  for (const name of DATASETS) {
    const json = join(dir, `${name}.json`);
    const csv = join(dir, `${name}.csv`);
    if (existsSync(json) && existsSync(csv)) {
      throw new MigrationToolError('ambiguous_input', `Both ${name}.json and ${name}.csv exist`);
    }
    const path = existsSync(json) ? json : existsSync(csv) ? csv : null;
    if (path === null) continue;
    const { rows, digest } = readRowsFile(path);
    out[name] = rows;
    out.digests[name] = digest;
  }
  if (!out.venues && !out.registrations && !out.subscribers) {
    throw new MigrationToolError(
      'no_input',
      'No venues, registrations or subscribers file (.json or .csv) found in the input folder',
    );
  }
  return out;
}

/** Writes a file, creating its folder. `private` files are readable by the owner only. */
export function writeFileSafe(path: string, contents: string, isPrivate = false): void {
  mkdirSync(dirname(path), { recursive: true, mode: isPrivate ? 0o700 : 0o755 });
  writeFileSync(path, contents, { mode: isPrivate ? 0o600 : 0o644 });
}
