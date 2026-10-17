import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The bundled fonts (`assets/fonts/`, licences in `assets/fonts/LICENSES.md`). They are embedded in
 * every page as `data:` URLs, so the browser never loads a font from disk or from the network.
 *
 * `../assets/fonts` resolves the same from `src/` (tsx, tests) and from `dist/` (the bundle).
 */
export const FONT_DIR = fileURLToPath(new URL('../assets/fonts/', import.meta.url));

export const LATIN_FAMILY = 'Figtree';
export const URDU_FAMILY = 'Mehr Nastaliq Web';

interface FontFile {
  family: string;
  weight: number;
  file: string;
  sha256: string;
}

/** Unmodified copies; the checksums match `assets/fonts/LICENSES.md`. */
export const FONT_FILES: readonly FontFile[] = [
  {
    family: LATIN_FAMILY,
    weight: 400,
    file: 'Figtree_400Regular.ttf',
    sha256: '4e2e9876c4a908c2cbe410ceb648e4724464a84492bd49cb2d6e7b0d3f769a66',
  },
  {
    family: LATIN_FAMILY,
    weight: 600,
    file: 'Figtree_600SemiBold.ttf',
    sha256: '1b76aae525b51758fc0c9c5096f33d90831657d3ad2fe3c34fb7e666d76f8960',
  },
  {
    family: LATIN_FAMILY,
    weight: 700,
    file: 'Figtree_700Bold.ttf',
    sha256: '183bf1a8523731738c72be9aa8236453a21d6a3ed70bd8e5266723b212331dc4',
  },
  {
    family: URDU_FAMILY,
    weight: 400,
    file: 'MehrNastaliqWeb-Regular.ttf',
    sha256: '1339f7fbf3531908048a0b2965d3c79deb7d41a98614c77ac1d2f691cd6aa373',
  },
];

export class FontIntegrityError extends Error {
  override name = 'FontIntegrityError';
}

let cached: string | undefined;

/** The `@font-face` rules for every bundled font. Checks each file's checksum on first use. */
export function fontFaceCss(dir: string = FONT_DIR): string {
  if (cached && dir === FONT_DIR) return cached;
  const rules = FONT_FILES.map((font) => {
    const bytes = readFileSync(`${dir}${font.file}`);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== font.sha256) throw new FontIntegrityError(`font file changed: ${font.file}`);
    return (
      `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};` +
      `font-display:block;src:url(data:font/ttf;base64,${bytes.toString('base64')}) format('truetype');}`
    );
  }).join('\n');
  if (dir === FONT_DIR) cached = rules;
  return rules;
}

/** Latin first, so spaces and digits inside Urdu come from Figtree (decision 0012, rule 2). */
export const URDU_STACK = `'${LATIN_FAMILY}','${URDU_FAMILY}'`;
export const LATIN_STACK = `'${LATIN_FAMILY}','${URDU_FAMILY}'`;
