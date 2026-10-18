import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CACHE_DIR } from '../stack/paths';
import { db } from '../support/db';

/**
 * Where the quality runs put their raw results and screenshots: under the e2e cache (ignored by
 * git, lint and format) unless QC_QUALITY_OUT names another directory. The reports in
 * docs/quality/ are written from these by a person, with a few small screenshots copied over.
 */
export const QUALITY_OUT = process.env.QC_QUALITY_OUT ?? join(CACHE_DIR, 'quality');

export function outPath(...parts: string[]): string {
  const path = join(QUALITY_OUT, ...parts);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

export function writeResult(name: string, data: unknown): string {
  const path = outPath(`${name}.json`);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  return path;
}

export function readResult<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(QUALITY_OUT, `${name}.json`), 'utf8')) as T;
  } catch {
    return null;
  }
}

/** With QC_QUALITY_STRICT=1 a measured budget miss or a serious violation fails the run. */
export const STRICT = process.env.QC_QUALITY_STRICT === '1';

/**
 * Switches feature flags on for the whole platform in this run's throwaway database, so the
 * screens behind them (memorisation, the ayah of the day) can be checked. The `feature_flags`
 * table is how operators switch a flag (there is no API for it). Returns a function that puts
 * every row back as it was.
 */
export async function enableFlags(keys: readonly string[]): Promise<() => Promise<void>> {
  const restore: (() => Promise<unknown>)[] = [];
  for (const key of keys) {
    const { rows } = await db().query<{ id: string; enabled: boolean }>(
      'select id, enabled from feature_flags where key = $1 and city_id is null',
      [key],
    );
    const row = rows[0];
    if (row) {
      await db().query('update feature_flags set enabled = true where id = $1', [row.id]);
      restore.push(() =>
        db().query('update feature_flags set enabled = $2 where id = $1', [row.id, row.enabled]),
      );
    } else {
      const inserted = await db().query<{ id: string }>(
        'insert into feature_flags (key, enabled) values ($1, true) returning id',
        [key],
      );
      const id = inserted.rows[0]?.id;
      restore.push(() => db().query('delete from feature_flags where id = $1', [id]));
    }
  }
  return async () => {
    for (const undo of restore.reverse()) await undo();
  };
}
