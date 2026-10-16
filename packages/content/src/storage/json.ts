import type { z } from 'zod';
import type { KeyValueStorage } from './types';

/** Reads a JSON value and checks it with a schema. Anything missing or invalid gives null. */
export async function readJson<S extends z.ZodType>(
  storage: KeyValueStorage,
  key: string,
  schema: S,
): Promise<z.output<S> | null> {
  let raw: string | null;
  try {
    raw = await storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Writes a JSON value. A storage that refuses the write does not break the caller. */
export async function writeJson(
  storage: KeyValueStorage,
  key: string,
  value: unknown,
): Promise<boolean> {
  try {
    await storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
