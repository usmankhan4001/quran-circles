import { POSTER_FORMATS } from '@qc/contracts';
import { escapeHtml } from '../escape';
import { COLOURS, type Accent } from '../palette';
import { blockHtml, scanHtml } from './blocks';
import { dirOf, page, px, star } from './layout';
import type { PosterTemplate, PosterView, TextPair } from './view';

/**
 * "Night": the whole page in the chosen green, a thin gilt frame and a gilt eight-point star, text
 * centred, the QR code on a white card at the foot. Gilt is decoration only, never text (D3).
 * PROVISIONAL until the ui lane and a human approve it.
 */
function markHtml(view: PosterView): string {
  return view.appName
    .map((n) => `<span lang="${n.locale}" dir="${dirOf(n.locale)}">${escapeHtml(n.text)}</span>`)
    .join('<i class="dot" aria-hidden="true"></i>');
}

const between = (blocks: string[], spec: PosterView['spec']): string =>
  blocks.join(
    `<div class="divider" aria-hidden="true" style="width:${px(spec, 44)};height:${px(spec, 44)}">${star(COLOURS.gilt, 7)}</div>`,
  );

function portrait(view: PosterView): string {
  const { spec } = view;
  const bg = COLOURS[view.accent];
  const u = (n: number) => px(spec, n);
  const lead = view.blocks[0]?.locale ?? 'en';
  const css = `
main.poster{position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;
  background:${bg};color:${COLOURS.white};text-align:center;
  padding:${u(spec.safe.top - 20)} ${u(spec.safe.side)} ${u(spec.safe.bottom)}}
.frame{position:absolute;inset:${u(30)};border:${u(3)} solid ${COLOURS.gilt};border-radius:${u(40)};opacity:.75;pointer-events:none}
.corner{position:absolute;width:${u(120)};height:${u(120)};opacity:.35}
.corner .star{width:100%;height:100%}
.corner.tl{top:${u(70)};left:${u(70)}} .corner.br{bottom:${u(70)};right:${u(70)}}
.top{flex:none;display:flex;flex-direction:column;align-items:center;gap:${u(14)}}
.top .star{width:${u(100)};height:${u(100)}}
.mark{display:flex;align-items:center;gap:${u(18)};color:${COLOURS.mist};font-size:${u(36)}}
.mark [lang=en]{font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.mark [lang=ur]{line-height:1.8}
.mark .dot{display:block;width:${u(10)};height:${u(10)};border-radius:50%;background:${COLOURS.gilt}}
.content{flex:1 1 auto;min-height:0;width:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;
  gap:${u(22)};padding:${u(28)} 0}
.block{width:100%;display:flex;flex-direction:column;align-items:center;gap:${u(8)}}
.block>div{width:100%}
.title[lang=en]{font-weight:700;line-height:1.1}
.title[lang=ur]{line-height:2}
.when[lang=en]{font-weight:700;line-height:1.2}
.venue[lang=en]{font-weight:600;line-height:1.25}
.area,.details{color:${COLOURS.mist}}
.area[lang=en],.details[lang=en]{line-height:1.3}
[lang=ur].when,[lang=ur].venue,[lang=ur].area,[lang=ur].details{line-height:2.1}
.divider{flex:none}
.divider .star{width:100%;height:100%}
.card{flex:none;display:flex;align-items:center;gap:${u(32)};background:${COLOURS.white};color:${COLOURS.ink};
  border-radius:${u(36)};padding:${u(20)} ${u(36)} ${u(20)} ${u(20)};max-width:100%;text-align:start}
.card[dir=rtl]{padding:${u(20)} ${u(20)} ${u(20)} ${u(36)}}
.qr{flex:none;width:${u(300)};height:${u(300)}}
.qr svg{display:block;width:100%;height:100%}
.cta-text{flex:1 1 auto;min-width:0;max-width:${u(460)};display:flex;flex-direction:column;gap:${u(6)}}
.cta-text>*{text-align:${lead === 'ur' ? 'right' : 'left'}}
.scan[lang=en]{font-weight:700;line-height:1.2}
.scan[lang=ur]{line-height:2}
.host{font-weight:600;color:${COLOURS.muted};font-size:${u(30)};line-height:1.3}
`;
  const blocks = view.blocks.map((b, i) => blockHtml(view, b, i));
  const card = view.qr
    ? `<footer class="card" dir="${dirOf(lead)}"><div class="qr">${view.qr.svg}</div>` +
      `<div class="cta-text">${scanHtml(view, 40)}` +
      (view.host ? `<div class="host" lang="en" dir="ltr">${escapeHtml(view.host)}</div>` : '') +
      `</div></footer>`
    : '';
  const body =
    `<main class="poster" dir="${dirOf(lead)}"><div class="frame" aria-hidden="true"></div>` +
    `<div class="corner tl" aria-hidden="true">${star(COLOURS.gilt, 2)}</div>` +
    `<div class="corner br" aria-hidden="true">${star(COLOURS.gilt, 2)}</div>` +
    `<header class="top">${star(COLOURS.gilt, 4)}<div class="mark">${markHtml(view)}</div></header>` +
    `<section class="content" data-box="content">${between(blocks, spec)}</section>${card}</main>`;
  return page(spec, lead, css, body);
}

function preview(view: PosterView): string {
  const { spec } = view;
  const bg = COLOURS[view.accent];
  const u = (n: number) => px(spec, n);
  const lead = view.blocks[0]?.locale ?? 'en';
  const css = `
main.poster{position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:${u(10)};background:${bg};color:${COLOURS.white};text-align:center;padding:${u(spec.safe.top)} ${u(spec.safe.side + 60)}}
.frame{position:absolute;inset:${u(22)};border:${u(3)} solid ${COLOURS.gilt};border-radius:${u(28)};opacity:.75}
.side{position:absolute;top:50%;width:${u(90)};height:${u(90)};margin-top:${u(-45)};opacity:.6}
.side .star{width:100%;height:100%}
.side.s1{left:${u(50)}} .side.s2{right:${u(50)}}
.mark{display:flex;align-items:center;gap:${u(14)};color:${COLOURS.mist};font-size:${u(28)}}
.mark [lang=en]{font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.mark [lang=ur]{line-height:1.8}
.mark .dot{display:block;width:${u(8)};height:${u(8)};border-radius:50%;background:${COLOURS.gilt}}
.content{width:100%;min-height:0;display:flex;flex-direction:column;align-items:center;gap:${u(8)}}
.block{width:100%;display:flex;flex-direction:column;align-items:center;gap:${u(2)}}
.block>div{width:100%}
.title[lang=en]{font-weight:700;line-height:1.1}
.title[lang=ur]{line-height:2}
.when[lang=en]{font-weight:700;line-height:1.25}
.venue[lang=en]{font-weight:600;line-height:1.25}
.area{color:${COLOURS.mist}}
[lang=ur].when,[lang=ur].venue,[lang=ur].area{line-height:2}
.divider{flex:none}
.divider .star{width:100%;height:100%}
`;
  const blocks = view.blocks.map((b, i) => blockHtml(view, b, i));
  const body =
    `<main class="poster" dir="${dirOf(lead)}"><div class="frame" aria-hidden="true"></div>` +
    `<div class="side s1" aria-hidden="true">${star(COLOURS.gilt, 3)}</div>` +
    `<div class="side s2" aria-hidden="true">${star(COLOURS.gilt, 3)}</div>` +
    `<div class="mark">${markHtml(view)}</div>` +
    `<section class="content" data-box="content">${between(blocks, spec)}</section></main>`;
  return page(spec, lead, css, body);
}

export const nightTemplate: PosterTemplate = {
  id: 'night',
  version: 1,
  name: { en: 'Night', ur: 'رات' },
  formats: POSTER_FORMATS,
  provisional: true,
  build: (view) => (view.spec.orientation === 'landscape' ? preview(view) : portrait(view)),
  textPairs: (accent: Accent): TextPair[] => [
    { name: 'title, when, venue', fg: COLOURS.white, bg: COLOURS[accent], small: false },
    { name: 'area and details', fg: COLOURS.mist, bg: COLOURS[accent], small: false },
    { name: 'mark', fg: COLOURS.mist, bg: COLOURS[accent], small: false },
    { name: 'scan', fg: COLOURS.ink, bg: COLOURS.white, small: false },
    { name: 'host', fg: COLOURS.muted, bg: COLOURS.white, small: true },
  ],
};
