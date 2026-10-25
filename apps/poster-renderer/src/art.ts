import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Bundled poster art (`assets/art/`), embedded in the page as `data:` URLs like the fonts, so the
 * browser never loads an image from disk or the network. `../assets/art` resolves the same from
 * `src/` (tsx, tests) and from `dist/` (the bundle).
 */
export const ART_DIR = fileURLToPath(new URL('../assets/art/', import.meta.url));

interface ArtFile {
  file: string;
  sha256: string;
}

/** Text-free exports of the owner's Canva designs; the checksums match `assets/art/SOURCES.md`. */
export const ART_FILES = {
  /** "Quranic Circles", page 14, live text, icons and QR codes removed. 1080x1350 JPEG. */
  quranicCircles: {
    file: 'quranic-circles.jpg',
    sha256: 'b1f574367730800f89dc9a183bef4052ade2fd14809e92b2e0dbcab2e0d71c60',
  },
} as const satisfies Record<string, ArtFile>;

export type ArtKey = keyof typeof ART_FILES;

export class ArtIntegrityError extends Error {
  override name = 'ArtIntegrityError';
}

const cached = new Map<ArtKey, string>();

/** The art as a `data:image/jpeg` URL. Checks the file's checksum on first use. */
export function artDataUrl(key: ArtKey, dir: string = ART_DIR): string {
  const hit = dir === ART_DIR ? cached.get(key) : undefined;
  if (hit) return hit;
  const art = ART_FILES[key];
  const bytes = readFileSync(`${dir}${art.file}`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== art.sha256) throw new ArtIntegrityError(`art file changed: ${art.file}`);
  const url = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  if (dir === ART_DIR) cached.set(key, url);
  return url;
}
