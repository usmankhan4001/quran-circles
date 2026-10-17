import type { FormatSpec } from '../formats';
import type { PosterLocale } from '../strings';
import { fitText } from './layout';
import type { PosterBlock, PosterView } from './view';

interface Size {
  size: number;
  min: number;
  lines: number;
}
type Sizes = Record<'title' | 'when' | 'venue' | 'area' | 'details', Record<PosterLocale, Size>>;

const s = (size: number, min: number, lines: number): Size => ({ size, min, lines });

/** Starting sizes, floors (32 on a story, poster direction) and line limits, in design units. */
const SINGLE: Sizes = {
  title: { en: s(104, 72, 2), ur: s(108, 72, 2) },
  when: { en: s(64, 44, 2), ur: s(60, 44, 2) },
  venue: { en: s(52, 38, 2), ur: s(52, 38, 2) },
  area: { en: s(40, 32, 1), ur: s(40, 32, 1) },
  details: { en: s(40, 32, 2), ur: s(40, 32, 2) },
};
const BILINGUAL: Sizes = {
  title: { en: s(80, 56, 2), ur: s(84, 56, 2) },
  when: { en: s(50, 38, 2), ur: s(48, 38, 2) },
  venue: { en: s(42, 34, 2), ur: s(42, 34, 2) },
  area: { en: s(36, 32, 1), ur: s(36, 32, 1) },
  details: { en: s(36, 32, 2), ur: s(36, 32, 2) },
};
const PREVIEW: Sizes = {
  title: { en: s(68, 44, 2), ur: s(66, 44, 1) },
  when: { en: s(40, 32, 1), ur: s(38, 30, 1) },
  venue: { en: s(36, 30, 1), ur: s(34, 30, 1) },
  area: { en: s(30, 28, 1), ur: s(30, 28, 1) },
  details: { en: s(30, 28, 1), ur: s(30, 28, 1) },
};

const text = (
  spec: FormatSpec,
  sizes: Sizes,
  part: keyof Sizes,
  block: PosterBlock,
  value: string,
): string =>
  fitText(spec, {
    field: `${part}.${block.locale}`,
    locale: block.locale,
    value,
    className: part,
    ...sizes[part][block.locale],
  });

/**
 * The text of one language: title, when, venue (and area), details. On a link preview a bilingual
 * poster shows both titles but the time and venue only in the leading language; the area is only
 * ever printed in the leading language.
 */
export function blockHtml(view: PosterView, block: PosterBlock, index: number): string {
  const { spec } = view;
  const preview = spec.format === 'link_preview';
  const sizes = preview ? PREVIEW : view.blocks.length > 1 ? BILINGUAL : SINGLE;
  const lead = index === 0;
  const parts = [text(spec, sizes, 'title', block, block.title)];
  if (!preview || lead) {
    parts.push(text(spec, sizes, 'when', block, block.when));
    parts.push(text(spec, sizes, 'venue', block, block.venue));
    // The area is printed once, in the leading language: a bilingual poster is short of room.
    if (block.area && lead) parts.push(text(spec, sizes, 'area', block, block.area));
  }
  if (block.details && !preview) parts.push(text(spec, sizes, 'details', block, block.details));
  return `<article class="block" lang="${block.locale}" dir="${block.locale === 'ur' ? 'rtl' : 'ltr'}">${parts.join('')}</article>`;
}

/** "Scan to register" lines, one per language shown. */
export function scanHtml(view: PosterView, size: number): string {
  return view.scan
    .map((line) =>
      fitText(view.spec, {
        field: `scan.${line.locale}`,
        locale: line.locale,
        value: line.text,
        className: 'scan',
        size,
        min: Math.min(size, 28),
        lines: 2,
      }),
    )
    .join('');
}
