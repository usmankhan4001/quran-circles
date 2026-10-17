import type { PosterAccent, PosterFormat, PosterLanguage } from '@qc/contracts';
import type { FormatSpec } from '../formats';
import type { QrCode } from '../qr';
import type { PosterLocale } from '../strings';

/** One language's text on a poster. Values are plain text; templates escape and isolate them. */
export interface PosterBlock {
  locale: PosterLocale;
  title: string;
  when: string;
  venue: string;
  area: string | null;
  details: string | null;
}

/** Everything a template needs to draw one format. Built by the renderer from a checked request. */
export interface PosterView {
  spec: FormatSpec;
  language: PosterLanguage;
  accent: PosterAccent;
  /** Leading language first. One block, or two for a bilingual poster. */
  blocks: PosterBlock[];
  /** Null for the link preview. */
  qr: QrCode | null;
  /** "Scan to register" in each language shown. */
  scan: Array<{ locale: PosterLocale; text: string }>;
  appName: Array<{ locale: PosterLocale; text: string }>;
  /** The public host printed under the QR code, when the domain is set. */
  host: string | null;
}

/** A text pair a template draws, for the contrast check. `small` text needs 7:1, the rest 4.5:1. */
export interface TextPair {
  name: string;
  fg: string;
  bg: string;
  small: boolean;
}

export interface PosterTemplate {
  id: string;
  /** Bumped whenever the layout changes; part of the cache key. */
  version: number;
  name: { en: string; ur: string };
  formats: readonly PosterFormat[];
  /** The ui lane has not signed off the art yet (brief, stand-ins). */
  provisional: boolean;
  build(view: PosterView): string;
  textPairs(accent: PosterAccent): TextPair[];
}
