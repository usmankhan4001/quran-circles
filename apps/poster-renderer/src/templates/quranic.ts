import { POSTER_FORMATS, type PosterAccent } from '@qc/contracts';
import { artDataUrl } from '../art';
import { escapeHtml } from '../escape';
import { COLOURS } from '../palette';
import { scanHtml } from './blocks';
import { dirOf, fitText, page, px } from './layout';
import type { PosterBlock, PosterTemplate, PosterView, TextPair } from './view';

/**
 * "Quranic Circles": the owner's Canva design (page 14 of "Quranic Circles"). The photo of a hand
 * holding the Mushaf on deep green, with the Tanzeem marks, is bundled art; the template draws the
 * title as the headline, the details as the tagline, a green band with the day and time, the venue
 * and the QR code on a white card. Final design, so not provisional.
 */

/** The design's own colours, beyond the shared palette. Cream is the accent text on green. */
const CREAM = '#fffdb2';
/** Behind all text below the photo: the photo's green darkened, so contrast does not hang on it. */
const BASE = '#08321b';

/** Line icons in the design's cream. Decoration: hidden from readers. */
const ICONS = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
} as const;

const icon = (name: keyof typeof ICONS): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon" fill="none" stroke="${CREAM}" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

type Part = 'title' | 'details' | 'when' | 'venue' | 'area';

/** Starting size, floor and line limit in design units, for one language or for two. */
const SIZES: Record<'single' | 'bilingual' | 'preview', Record<Part, [number, number, number]>> = {
  single: {
    title: [170, 72, 2],
    details: [40, 32, 2],
    when: [52, 36, 2],
    venue: [40, 32, 2],
    area: [34, 32, 1],
  },
  bilingual: {
    title: [118, 56, 2],
    details: [34, 32, 2],
    when: [42, 34, 2],
    venue: [36, 32, 2],
    area: [32, 32, 1],
  },
  preview: {
    title: [96, 44, 2],
    details: [30, 28, 1],
    when: [36, 30, 1],
    venue: [32, 28, 1],
    area: [28, 28, 1],
  },
};

function text(view: PosterView, part: Part, block: PosterBlock, value: string): string {
  const preview = view.spec.format === 'link_preview';
  const set = preview ? 'preview' : view.blocks.length > 1 ? 'bilingual' : 'single';
  const [size, min, lines] = SIZES[set][part];
  return fitText(view.spec, {
    field: `${part}.${block.locale}`,
    locale: block.locale,
    value,
    className: part,
    size,
    min,
    lines,
  });
}

/** The headline: every language's title, then every language's tagline (not on a link preview). */
function headline(view: PosterView): string {
  const titles = view.blocks.map((b) => text(view, 'title', b, b.title)).join('');
  const preview = view.spec.format === 'link_preview';
  const lines = view.blocks
    .filter((b) => b.details && !preview)
    .map((b) => text(view, 'details', b, b.details ?? ''));
  return `<div class="headline">${titles}${lines.join('')}</div>`;
}

/** The green band: the day and time in each language shown (the preview only the leading one). */
function band(view: PosterView, blocks: PosterBlock[]): string {
  const rows = blocks
    .map(
      (b) =>
        `<div class="row" lang="${b.locale}" dir="${dirOf(b.locale)}">${text(view, 'when', b, b.when)}</div>`,
    )
    .join('');
  return `<div class="band">${icon('calendar')}<div class="rows">${rows}</div>${icon('clock')}</div>`;
}

/** The venue in each language shown, the area once in the leading language. */
function venue(view: PosterView, blocks: PosterBlock[]): string {
  const lead = blocks[0];
  const lines = blocks.map((b) => text(view, 'venue', b, b.venue));
  if (lead?.area) lines.push(text(view, 'area', lead, lead.area));
  return `<div class="place">${icon('pin')}<div class="lines">${lines.join('')}</div></div>`;
}

function qrCard(view: PosterView): string {
  if (!view.qr) return '';
  return (
    `<div class="card"><div class="qr">${view.qr.svg}</div>` +
    `<div class="scan-text">${scanHtml(view, 26)}</div></div>`
  );
}

function sharedCss(view: PosterView): string {
  const u = (n: number) => px(view.spec, n);
  const accent = COLOURS[view.accent];
  return `
.icon{flex:none;display:block}
.title{color:${COLOURS.white};text-shadow:0 0 .35em rgba(4,24,13,.75)}
.title[lang=en]{font-weight:700;line-height:1;letter-spacing:-.03em;text-transform:uppercase}
.title[lang=ur]{line-height:2}
.details{color:${CREAM}}
.details[lang=en]{font-weight:600;line-height:1.2;text-transform:uppercase}
.when{color:${COLOURS.white}}
.when[lang=en]{font-weight:700;line-height:1.15;text-transform:uppercase}
.venue{color:${COLOURS.white}}
.venue[lang=en]{font-weight:700;line-height:1.2}
.area{color:${CREAM}}
.area[lang=en]{font-weight:600;line-height:1.25}
[lang=ur].details,[lang=ur].when,[lang=ur].venue,[lang=ur].area{line-height:2.1}
.band{display:flex;align-items:center;gap:${u(24)};padding:${u(18)} ${u(32)};
  background:linear-gradient(90deg,${COLOURS.night},${accent});border:${u(2)} solid ${COLOURS.white}}
.band .rows{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:${u(4)}}
.place{display:flex;align-items:flex-start;gap:${u(20)}}
.place .lines{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:${u(4)}}
`;
}

function portrait(view: PosterView): string {
  const { spec } = view;
  const u = (n: number) => px(spec, n);
  const lead = view.blocks[0]?.locale ?? 'en';
  const art = artDataUrl('quranicCircles');
  // Two languages need more room, so their text may start higher, over the faded arm. The fade
  // follows, so the text below the photo always sits on BASE (the contrast pairs assume it).
  const top = view.blocks.length > 1 ? 340 : 520;
  // At least 280 px of code on a story (QR test); print scales it, and 280 units is 54 mm on A4.
  const qr = spec.output === 'pdf' ? 280 : 330;
  const css = `${sharedCss(view)}
main.poster{position:relative;width:100%;height:100%;overflow:hidden;background:${BASE};color:${COLOURS.white}}
.art{position:absolute;inset:0 0 auto 0;height:${u(1350)};
  background:url(${art}) top center/100% auto no-repeat}
.fade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 0,transparent ${u(top + 40)},
  rgba(8,50,27,.72) ${u(top + 340)},${BASE} ${u(top + 580)},${BASE} 100%)}
.content{position:absolute;inset:${u(top)} ${u(spec.safe.side - 20)} ${u(spec.safe.bottom - 40)};
  display:flex;flex-direction:column;justify-content:flex-end;gap:${u(30)}}
.headline{display:flex;flex-direction:column;gap:${u(10)}}
.band .icon{width:${u(52)};height:${u(52)}}
.foot{display:flex;align-items:center;gap:${u(32)}}
.foot .place{flex:1 1 auto;min-width:0}
.place .icon{width:${u(44)};height:${u(44)};margin-top:${u(6)}}
.card{flex:none;display:flex;flex-direction:column;align-items:center;gap:${u(8)};width:${u(qr)}}
.qr{width:${u(qr)};height:${u(qr)};padding:${u(14)};background:${COLOURS.white};border-radius:${u(16)}}
.qr svg{display:block;width:100%;height:100%}
.scan-text{width:100%;text-align:center}
.scan{color:${CREAM}}
.scan[lang=en]{font-weight:700;line-height:1.2;text-transform:uppercase}
.scan[lang=ur]{line-height:2}
.host{text-align:center;color:${COLOURS.white};font-weight:600;font-size:${u(26)};letter-spacing:.12em;line-height:1.3}
`;
  const host = view.host
    ? `<div class="host" lang="en" dir="ltr">${escapeHtml(view.host)}</div>`
    : '';
  const body =
    `<main class="poster" dir="${dirOf(lead)}">` +
    `<div class="art" aria-hidden="true"></div><div class="fade" aria-hidden="true"></div>` +
    `<section class="content" data-box="content">${headline(view)}${band(view, view.blocks)}` +
    `<div class="foot">${venue(view, view.blocks)}${qrCard(view)}</div>${host}</section></main>`;
  return page(spec, lead, css, body);
}

function preview(view: PosterView): string {
  const { spec } = view;
  const u = (n: number) => px(spec, n);
  const lead = view.blocks[0]?.locale ?? 'en';
  const leadBlock = view.blocks.slice(0, 1);
  const art = artDataUrl('quranicCircles');
  // The photo sits at the trailing side, the text at the leading side.
  const towards = lead === 'ur' ? 'left' : 'right';
  const css = `${sharedCss(view)}
main.poster{position:relative;width:100%;height:100%;overflow:hidden;background:${BASE};color:${COLOURS.white}}
.art{position:absolute;top:0;bottom:0;${towards}:0;width:${u(560)};
  background:url(${art}) 50% 12%/cover no-repeat}
.fade{position:absolute;inset:0;background:linear-gradient(to ${towards},${BASE} 0,${BASE} ${u(480)},rgba(8,50,27,.55) ${u(640)},transparent ${u(800)})}
.content{position:absolute;top:${u(spec.safe.top)};bottom:${u(spec.safe.bottom)};inset-inline-start:${u(spec.safe.side)};
  width:${u(640)};display:flex;flex-direction:column;justify-content:center;gap:${u(18)}}
.headline{display:flex;flex-direction:column;gap:${u(6)}}
.band{padding:${u(10)} ${u(20)};gap:${u(16)}}
.band .icon{width:${u(36)};height:${u(36)}}
.place .icon{width:${u(32)};height:${u(32)};margin-top:${u(4)}}
`;
  const body =
    `<main class="poster" dir="${dirOf(lead)}">` +
    `<div class="art" aria-hidden="true"></div><div class="fade" aria-hidden="true"></div>` +
    `<section class="content" data-box="content">${headline(view)}${band(view, leadBlock)}` +
    `${venue(view, leadBlock)}</section></main>`;
  return page(spec, lead, css, body);
}

export const quranicTemplate: PosterTemplate = {
  id: 'quranic_circles',
  version: 1,
  name: { en: 'Quranic Circles', ur: 'قرآنی حلقے' },
  formats: POSTER_FORMATS,
  provisional: false,
  build: (view) => (view.spec.orientation === 'landscape' ? preview(view) : portrait(view)),
  // Text sits on BASE (the fade is solid behind the content box), the band on its darker end.
  textPairs: (accent: PosterAccent): TextPair[] => [
    { name: 'title, venue', fg: COLOURS.white, bg: BASE, small: false },
    { name: 'details, area', fg: CREAM, bg: BASE, small: false },
    { name: 'when (band)', fg: COLOURS.white, bg: COLOURS[accent], small: false },
    { name: 'scan', fg: CREAM, bg: BASE, small: true },
    { name: 'host', fg: COLOURS.white, bg: BASE, small: true },
  ],
};
