import type { PosterAccent } from '@qc/contracts';

/**
 * The colours posters may use: D3 in `docs/design/redesign-decisions.md`. The accents an editor can
 * pick are the contract's `PosterAccent` (`POSTER_ACCENTS`); each has a colour here, and every
 * template checks each one against its text in `palette.test.ts`.
 */
export const COLOURS = {
  tanzeem: '#226836',
  deep: '#154a27',
  night: '#0c2a17',
  leaf: '#e5f0e8',
  cloud: '#f7fbf9',
  mist: '#dbe7e6',
  gilt: '#b8913a',
  white: '#ffffff',
  /** Body ink on light posters: night green. */
  ink: '#0c2a17',
  /** Quiet text on light posters. */
  muted: '#33503e',
} as const satisfies Record<PosterAccent, string> & Record<string, string>;

const channel = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new RangeError(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => channel(parseInt(x ?? '0', 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** WCAG 2.1 contrast ratio between two `#rrggbb` colours (same formula as `@qc/ui`). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
