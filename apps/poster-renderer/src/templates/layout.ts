import { escapeHtml } from '../escape';
import { fontFaceCss, LATIN_STACK, URDU_STACK } from '../fonts';
import type { FormatSpec } from '../formats';
import type { PosterLocale } from '../strings';

/**
 * Shared building blocks for the locked templates. Every page:
 *
 * - carries a Content-Security-Policy that allows only inline styles and `data:` fonts and images,
 *   so even a mistake in a template cannot fetch anything (the browser layer blocks requests too);
 * - embeds the bundled fonts, never system ones;
 * - wraps every field value in a bidi isolate and isolates Latin runs inside Urdu and Urdu runs
 *   inside English (decision 0012, rule 1);
 * - marks every text box with `data-fit`, so the fit step can shrink it to its floor and refuse
 *   text that still does not fit, rather than clip it.
 */

export const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; " +
  "script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; " +
  "base-uri 'none'; form-action 'none'";

const ARABIC = '\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF';
const LATIN_RUN = /[A-Za-z0-9](?:[A-Za-z0-9 .,:;'&()/+-]*[A-Za-z0-9.)])?/g;
// Zero-width (non-)joiners are allowed inside a run, as alternatives rather than in a class.
const ARABIC_RUN = new RegExp(`[${ARABIC}](?:(?:[${ARABIC} ]|\\u200C|\\u200D)*[${ARABIC}])?`, 'g');

/**
 * Escapes `value` and isolates runs of the other script: Latin and digits inside Urdu text become
 * `<bdi dir="ltr">`, Urdu inside English text becomes `<bdi dir="rtl">` set in the Urdu stack.
 */
export function richText(value: string, locale: PosterLocale): string {
  const pattern = locale === 'ur' ? LATIN_RUN : ARABIC_RUN;
  const open =
    locale === 'ur' ? '<bdi dir="ltr" class="lat">' : '<bdi dir="rtl" class="ur-in" lang="ur">';
  let out = '';
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    const at = match.index ?? 0;
    out += escapeHtml(value.slice(last, at)) + open + escapeHtml(match[0]) + '</bdi>';
    last = at + match[0].length;
  }
  return out + escapeHtml(value.slice(last));
}

export const dirOf = (locale: PosterLocale): 'ltr' | 'rtl' => (locale === 'ur' ? 'rtl' : 'ltr');

export interface FitText {
  /** Name reported when it does not fit, e.g. `title.en`. */
  field: string;
  locale: PosterLocale;
  value: string;
  /** Starting size and floor in design units, and how many lines it may wrap to. */
  size: number;
  min: number;
  lines: number;
  className: string;
}

/** One text box that the fit step may shrink. */
export function fitText(spec: FormatSpec, t: FitText): string {
  return (
    `<div class="${t.className}" lang="${t.locale}" dir="${dirOf(t.locale)}" ` +
    `data-fit="${escapeHtml(t.field)}" data-size="${t.size}" data-min="${t.min}" data-lines="${t.lines}" ` +
    `style="font-size:${px(spec, t.size)}"><bdi dir="${dirOf(t.locale)}">${richText(t.value, t.locale)}</bdi></div>`
  );
}

/** Design units to CSS pixels for this format. */
export const px = (spec: FormatSpec, units: number): string =>
  `${(units * spec.unit).toFixed(2)}px`;

/** The eight-point star (two squares), the only ornament. Decoration: hidden from readers. */
export function star(stroke: string, strokeWidth: number, fill = 'none'): string {
  return (
    `<svg viewBox="-50 -50 100 100" aria-hidden="true" class="star">` +
    `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round">` +
    `<rect x="-33" y="-33" width="66" height="66"/>` +
    `<rect x="-33" y="-33" width="66" height="66" transform="rotate(45)"/></g>` +
    `<circle r="12" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/></svg>`
  );
}

/** A full page: CSP, fonts, page size, the shared text rules, then the template's own CSS. */
export function page(spec: FormatSpec, lang: PosterLocale, css: string, body: string): string {
  const base = `
@page{size:${spec.cssWidth} ${spec.cssHeight};margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${spec.cssWidth};height:${spec.cssHeight};overflow:hidden}
body{font-synthesis:none;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-kerning:normal}
[lang=en]{font-family:${LATIN_STACK}}
[lang=ur]{font-family:${URDU_STACK};font-weight:400}
.ur-in{font-family:${URDU_STACK};font-weight:400;font-size:1.15em}
.lat{font-family:${LATIN_STACK}}
[data-fit]{overflow-wrap:normal;word-break:normal;hyphens:none;line-height:1.3}
[data-fit][lang=ur]{line-height:2.1}
.star{display:block}
`;
  return (
    `<!doctype html><html lang="${lang}" dir="${dirOf(lang)}"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `<style>${fontFaceCss()}\n${base}\n${css}</style></head><body>${body}</body></html>`
  );
}
