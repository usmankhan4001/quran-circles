import { POSTER_FORMATS } from '@qc/contracts';
import { escapeHtml } from '../escape';
import { COLOURS, type Accent } from '../palette';
import { blockHtml, scanHtml } from './blocks';
import { dirOf, page, px, star } from './layout';
import type { PosterTemplate, PosterView, TextPair } from './view';

/**
 * "Cloud": light page, a Tanzeem green band with the mark at the top, text aligned to the leading
 * language's start side, the QR code beside "Scan to register" at the foot. PROVISIONAL until the
 * ui lane and a human approve it.
 */
function markHtml(view: PosterView, size: number): string {
  const names = view.appName
    .map((n) => `<span lang="${n.locale}" dir="${dirOf(n.locale)}">${escapeHtml(n.text)}</span>`)
    .join('<i class="sep"></i>');
  return `<div class="mark" style="--mark:${px(view.spec, size)}">${star(COLOURS.white, 6)}${names}</div>`;
}

function rules(blocks: string[]): string {
  return blocks.join('<div class="rule" aria-hidden="true"></div>');
}

function portrait(view: PosterView): string {
  const { spec } = view;
  const accent = COLOURS[view.accent];
  const u = (n: number) => px(spec, n);
  const lead = view.blocks[0]?.locale ?? 'en';
  const css = `
main.poster{width:100%;height:100%;display:flex;flex-direction:column;background:${COLOURS.cloud};color:${COLOURS.ink}}
.band{flex:none;position:relative;overflow:hidden;height:${u(spec.safe.top + 150)};background:${accent};
  display:flex;align-items:flex-end;padding:0 ${u(spec.safe.side)} ${u(40)}}
.band .pattern{position:absolute;inset-inline-end:${u(-90)};top:${u(-70)};width:${u(460)};height:${u(460)};opacity:.22}
.band .pattern .star{width:100%;height:100%}
.mark{position:relative;display:flex;align-items:center;gap:${u(20)};color:${COLOURS.white}}
.mark .star{width:${u(64)};height:${u(64)}}
.mark [lang=en]{font-weight:700;font-size:var(--mark);letter-spacing:.01em}
.mark [lang=ur]{font-size:var(--mark);line-height:1.7}
.mark .sep{display:block;width:${u(2)};height:${u(44)};background:${COLOURS.white};opacity:.55}
.content{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:${u(30)};
  padding:${u(40)} ${u(spec.safe.side)}}
.block{display:flex;flex-direction:column;gap:${u(8)}}
.title{color:${COLOURS.ink}}
.title[lang=en]{font-weight:700;line-height:1.1;letter-spacing:-.01em}
.title[lang=ur]{line-height:2}
.when{color:${accent}}
.when[lang=en]{font-weight:700;line-height:1.2}
.venue[lang=en]{font-weight:600;line-height:1.25}
.area,.details{color:${COLOURS.muted}}
.area[lang=en],.details[lang=en]{font-weight:500;line-height:1.3}
[lang=ur].when,[lang=ur].venue,[lang=ur].area,[lang=ur].details{line-height:2.1}
.rule{flex:none;width:${u(160)};height:${u(5)};border-radius:${u(3)};background:${COLOURS.gilt}}
.cta{flex:none;display:flex;align-items:center;gap:${u(40)};padding:${u(24)} ${u(spec.safe.side)} ${u(spec.safe.bottom)};
  border-top:${u(3)} solid ${COLOURS.leaf}}
.qr{flex:none;width:${u(320)};height:${u(320)};padding:${u(12)};background:${COLOURS.white};border-radius:${u(24)};
  box-shadow:0 0 0 ${u(3)} ${COLOURS.leaf}}
.qr svg{display:block;width:100%;height:100%}
.cta-text{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:${u(6)}}
.cta-text>*{text-align:${lead === 'ur' ? 'right' : 'left'}}
.scan{color:${COLOURS.ink}}
.scan[lang=en]{font-weight:700;line-height:1.2}
.scan[lang=ur]{line-height:2}
.host{font-weight:600;color:${COLOURS.muted};font-size:${u(32)};line-height:1.3}
`;
  const blocks = view.blocks.map((b, i) => blockHtml(view, b, i));
  const cta = view.qr
    ? `<footer class="cta" dir="${dirOf(lead)}"><div class="qr">${view.qr.svg}</div>` +
      `<div class="cta-text">${scanHtml(view, 44)}` +
      (view.host ? `<div class="host" lang="en" dir="ltr">${escapeHtml(view.host)}</div>` : '') +
      `</div></footer>`
    : '';
  const body =
    `<main class="poster" dir="${dirOf(lead)}">` +
    `<header class="band"><div class="pattern" aria-hidden="true">${star(COLOURS.white, 3)}</div>${markHtml(view, 40)}</header>` +
    `<section class="content" data-box="content">${rules(blocks)}</section>${cta}</main>`;
  return page(spec, lead, css, body);
}

function preview(view: PosterView): string {
  const { spec } = view;
  const accent = COLOURS[view.accent];
  const u = (n: number) => px(spec, n);
  const lead = view.blocks[0]?.locale ?? 'en';
  const css = `
main.poster{width:100%;height:100%;display:flex;background:${COLOURS.cloud};color:${COLOURS.ink}}
.side{flex:none;width:${u(330)};background:${accent};position:relative;overflow:hidden;
  display:flex;flex-direction:column;justify-content:flex-end;padding:${u(spec.safe.top)} ${u(40)}}
.side .pattern{position:absolute;top:${u(-60)};inset-inline-start:${u(-60)};width:${u(420)};height:${u(420)};opacity:.22}
.side .pattern .star{width:100%;height:100%}
.mark{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:${u(6)};color:${COLOURS.white}}
.mark .star{width:${u(72)};height:${u(72)};margin-bottom:${u(10)}}
.mark [lang=en]{font-weight:700;font-size:var(--mark)}
.mark [lang=ur]{font-size:var(--mark);line-height:1.8}
.mark .sep{display:none}
.content{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:${u(18)};
  padding:${u(spec.safe.top)} ${u(spec.safe.side)}}
.block{display:flex;flex-direction:column;gap:${u(4)}}
.title[lang=en]{font-weight:700;line-height:1.1}
.title[lang=ur]{line-height:2}
.when{color:${accent}}
.when[lang=en]{font-weight:700;line-height:1.25}
.venue[lang=en]{font-weight:600;line-height:1.25}
.area{color:${COLOURS.muted}}
[lang=ur].when,[lang=ur].venue,[lang=ur].area{line-height:2}
.rule{flex:none;width:${u(120)};height:${u(4)};border-radius:${u(2)};background:${COLOURS.gilt}}
`;
  const blocks = view.blocks.map((b, i) => blockHtml(view, b, i));
  const body =
    `<main class="poster" dir="${dirOf(lead)}">` +
    `<aside class="side"><div class="pattern" aria-hidden="true">${star(COLOURS.white, 3)}</div>${markHtml(view, 34)}</aside>` +
    `<section class="content" data-box="content">${rules(blocks)}</section></main>`;
  return page(spec, lead, css, body);
}

export const cloudTemplate: PosterTemplate = {
  id: 'cloud',
  version: 1,
  name: { en: 'Cloud', ur: 'ہلکا' },
  formats: POSTER_FORMATS,
  provisional: true,
  build: (view) => (view.spec.orientation === 'landscape' ? preview(view) : portrait(view)),
  textPairs: (accent: Accent): TextPair[] => [
    { name: 'title', fg: COLOURS.ink, bg: COLOURS.cloud, small: false },
    { name: 'when', fg: COLOURS[accent], bg: COLOURS.cloud, small: false },
    { name: 'venue', fg: COLOURS.ink, bg: COLOURS.cloud, small: false },
    { name: 'area and details', fg: COLOURS.muted, bg: COLOURS.cloud, small: true },
    { name: 'mark', fg: COLOURS.white, bg: COLOURS[accent], small: false },
    { name: 'scan', fg: COLOURS.ink, bg: COLOURS.cloud, small: false },
    { name: 'host', fg: COLOURS.muted, bg: COLOURS.cloud, small: true },
  ],
};
