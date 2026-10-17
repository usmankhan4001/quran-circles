import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Where rendered poster files live. The worker writes and deletes them
 * (`apps/worker/src/posters/storage.ts`) under the key `posterStorageKey` gives
 * (`posters/<session id>/<cache key>.<png|pdf>`) and stores the key in `posters.storage_key`; the
 * API only reads (in production it mounts the volume read-only). The key-to-path rule below mirrors
 * the worker's exactly, so a file one writes is the file the other reads.
 */
export interface PosterStorage {
  /** The file's bytes, or null when nothing is stored under the key. */
  read(key: string): Promise<Uint8Array<ArrayBuffer> | null>;
}

/** Thrown for a key or root the rule refuses. Never echoes the key. */
export class PosterStorageKeyError extends Error {
  override name = 'PosterStorageKeyError';
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9]+)?$/;

/**
 * Checks a storage key before it touches a disk path, as the worker does: `posters/` then plain
 * segments (letters, digits, `-`, `_`, one extension on the last), no `.` or `..`, no absolute
 * path, at most 300 characters. Returns the segments.
 */
export function posterKeySegments(key: string): string[] {
  const segments = key.split('/');
  if (
    segments.length < 2 ||
    segments[0] !== 'posters' ||
    !segments.every((s) => SEGMENT.test(s)) ||
    key.length > 300
  ) {
    throw new PosterStorageKeyError('not a poster storage key');
  }
  return segments;
}

/** `<root>/<key>`, refusing a relative root and anything that is not a poster key. */
export function resolvePosterPath(root: string, key: string): string {
  if (!path.isAbsolute(root)) throw new PosterStorageKeyError('storage root must be absolute');
  const base = path.resolve(root);
  const full = path.join(base, ...posterKeySegments(key));
  if (!full.startsWith(base + path.sep))
    throw new PosterStorageKeyError('not a poster storage key');
  return full;
}

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  ((error as { code?: unknown }).code === 'ENOENT' ||
    (error as { code?: unknown }).code === 'ENOTDIR');

/** Read-only access to the files on the local disk (the shared volume) under `root`. */
export function localDiskPosterStorage(root: string): PosterStorage {
  return {
    async read(key) {
      const file = resolvePosterPath(root, key);
      try {
        return new Uint8Array(await readFile(file));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
  };
}

/** The default root when `POSTER_STORAGE_DIR` is not set: a folder under the OS temp dir. */
export const DEFAULT_POSTER_STORAGE_DIR = path.join(tmpdir(), 'qc-posters');

/**
 * The poster store from the environment: `POSTER_STORAGE_DIR`, the absolute path of the folder the
 * worker writes to (the platform lane sets it for both services). Unset or blank, a folder under the
 * OS temp dir, which is only right for tests and local development.
 */
export function posterStorageFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PosterStorage {
  const dir = env.POSTER_STORAGE_DIR?.trim();
  return localDiskPosterStorage(dir ? dir : DEFAULT_POSTER_STORAGE_DIR);
}
