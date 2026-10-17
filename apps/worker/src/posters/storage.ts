import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** The two kinds of file the renderer makes. */
export type PosterContentType = 'image/png' | 'application/pdf';

/**
 * Where rendered poster files live. The worker writes and deletes; the API reads (`adminPosters.file`)
 * through the same interface. Keys are exactly the contract's `posterStorageKey`
 * (`posters/<session id>/<cache key>.<png|pdf>`); a store never invents its own layout, so a file
 * written by one process is found by the other under the key stored in `posters.storage_key`.
 */
export interface PosterStorage {
  /** Writes the bytes under `key`, replacing what is there. A repeat with the same bytes is harmless. */
  put(key: string, bytes: Uint8Array, contentType: PosterContentType): Promise<void>;
  /** The bytes under `key`, or null when there is no such file. */
  get(key: string): Promise<Uint8Array | null>;
  /** Removes the file under `key`. A missing file is not an error. */
  delete(key: string): Promise<void>;
}

export class PosterStorageKeyError extends Error {
  override name = 'PosterStorageKeyError';
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9]+)?$/;

/**
 * Checks a storage key before it touches a disk path: `posters/` then plain segments (letters,
 * digits, `-`, `_`, one extension on the last), no `.` or `..`, no absolute path. Returns the
 * segments.
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

const isMissing = (error: unknown): boolean =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';

/**
 * Files on a local disk (a volume in the container), rooted at `POSTER_STORAGE_DIR`. A key maps to
 * `<root>/<key>` with `/` as the separator. Writes go to a temporary file in the same directory and
 * are renamed into place, so a reader never sees half a file.
 */
export class LocalDiskPosterStorage implements PosterStorage {
  readonly root: string;

  constructor(root: string) {
    if (!path.isAbsolute(root)) throw new PosterStorageKeyError('storage root must be absolute');
    this.root = path.resolve(root);
  }

  /** The absolute path of a key. Throws for anything that is not a poster key. */
  pathOf(key: string): string {
    const full = path.join(this.root, ...posterKeySegments(key));
    if (!full.startsWith(this.root + path.sep)) {
      throw new PosterStorageKeyError('not a poster storage key');
    }
    return full;
  }

  /** The content type is not stored: the key's extension says it. */
  async put(key: string, bytes: Uint8Array, _contentType?: PosterContentType): Promise<void> {
    const file = this.pathOf(key);
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes);
      await rename(temporary, file);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathOf(key)));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }
}
