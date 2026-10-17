import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { posterStorageKey } from '@qc/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDiskPosterStorage, PosterStorageKeyError, posterKeySegments } from './storage';

const SESSION = '00000000-0000-4000-8000-0000000000c2';
const CACHE = 'b'.repeat(64);

let dir: string;
let storage: LocalDiskPosterStorage;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'qc-poster-store-'));
  storage = new LocalDiskPosterStorage(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const bytes = (s: string) => new TextEncoder().encode(s);

describe('local disk poster storage', () => {
  it('puts, gets and deletes a file at <root>/<posterStorageKey>', async () => {
    const key = posterStorageKey(SESSION, CACHE, 'application/pdf');
    await storage.put(key, bytes('%PDF one'), 'application/pdf');
    expect(storage.pathOf(key)).toBe(path.join(dir, 'posters', SESSION, `${CACHE}.pdf`));
    expect(Buffer.from((await storage.get(key))!).toString()).toBe('%PDF one');

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it('overwrites in place and leaves no temporary files', async () => {
    const key = posterStorageKey(SESSION, CACHE, 'image/png');
    await storage.put(key, bytes('first'), 'image/png');
    await storage.put(key, bytes('second'), 'image/png');
    expect(Buffer.from((await storage.get(key))!).toString()).toBe('second');
    expect(await readdir(path.join(dir, 'posters', SESSION))).toEqual([`${CACHE}.png`]);
  });

  it('answers null for a missing file and ignores deleting one', async () => {
    const key = posterStorageKey(SESSION, CACHE, 'image/png');
    expect(await storage.get(key)).toBeNull();
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it('refuses keys that could leave the root or are not poster keys', async () => {
    for (const bad of [
      '../etc/passwd',
      'posters/../secret.png',
      'posters/a/../../b.png',
      '/posters/a/b.png',
      'other/a/b.png',
      'posters',
      'posters//b.png',
      'posters/a/.hidden',
      'posters/a/b.png.',
      `posters/${'x'.repeat(400)}.png`,
    ]) {
      expect(() => posterKeySegments(bad), bad).toThrow(PosterStorageKeyError);
      await expect(storage.put(bad, bytes('x'), 'image/png')).rejects.toThrow(
        PosterStorageKeyError,
      );
      await expect(storage.get(bad)).rejects.toThrow(PosterStorageKeyError);
      await expect(storage.delete(bad)).rejects.toThrow(PosterStorageKeyError);
    }
  });

  it('needs an absolute root', () => {
    expect(() => new LocalDiskPosterStorage('relative/posters')).toThrow(PosterStorageKeyError);
  });
});
