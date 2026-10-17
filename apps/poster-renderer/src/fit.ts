/**
 * Runs inside the page (as a string, so no build helper leaks into it; page scripts are disabled and
 * this runs in Playwright's evaluation world).
 *
 * Each `[data-fit]` box tries one line, shrinking from its size to its floor; then two lines, and
 * so on up to `data-lines`. If every box fits but a `[data-box]` region still overflows, all sizes
 * are scaled down a step (floors stay) and the pass repeats, down to 75%. Whatever still does not fit
 * is reported, never clipped (poster direction: shrink, then wrap, then refuse).
 */
export const FIT_SCRIPT = `(unit) => {
  const boxes = Array.from(document.querySelectorAll('[data-fit]'));
  const lines = (el) => {
    const style = getComputedStyle(el);
    const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    return Math.round(el.getBoundingClientRect().height / lh);
  };
  const wide = (el) => el.scrollWidth > el.clientWidth + 1;
  const fitOne = (el, scale) => {
    const start = Number(el.dataset.size) * unit * scale;
    const floor = Number(el.dataset.min) * unit;
    const maxLines = Number(el.dataset.lines || '1');
    const step = Math.max(1, unit * 2);
    for (let allowed = 1; allowed <= maxLines; allowed++) {
      for (let size = Math.max(start, floor); size >= floor - 0.01; size -= step) {
        el.style.fontSize = size.toFixed(2) + 'px';
        if (lines(el) <= allowed && !wide(el)) return true;
      }
    }
    el.style.fontSize = floor.toFixed(2) + 'px';
    return false;
  };
  // Layout boxes, not scroll sizes: Nastaliq's tall inline boxes add scrollable overflow that is
  // only ink, so a region overflows when one of its children's boxes leaves its content box, or a
  // text box leaves the page.
  const inside = (r, b) => r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1;
  const contentBox = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      top: r.top + parseFloat(s.paddingTop), bottom: r.bottom - parseFloat(s.paddingBottom),
      left: r.left + parseFloat(s.paddingLeft), right: r.right - parseFloat(s.paddingRight),
    };
  };
  const overflowing = () => {
    const out = Array.from(document.querySelectorAll('[data-box]'))
      .filter((b) => { const box = contentBox(b); return Array.from(b.children).some((c) => !inside(c.getBoundingClientRect(), box)); })
      .map((b) => b.dataset.box);
    const view = { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
    if (boxes.some((el) => !inside(el.getBoundingClientRect(), view))) out.push('page');
    return out;
  };
  let scale = 1;
  for (;;) {
    const fields = boxes.filter((el) => !fitOne(el, scale)).map((el) => el.dataset.fit);
    const regions = overflowing();
    if (fields.length === 0 && regions.length === 0) return { ok: true, scale, fields: [], regions: [] };
    if (scale <= 0.75) return { ok: false, scale, fields, regions };
    scale = Math.round((scale - 0.05) * 100) / 100;
  }
}`;

/** Waits for the bundled faces and reports any that did not load (never draw with a fallback). */
export const FONTS_SCRIPT = `async (families) => {
  const sample = (f) => (f.startsWith('Mehr') ? 'قرآن' : 'Aa1');
  await Promise.all(families.map((f) => document.fonts.load('40px "' + f + '"', sample(f)).catch(() => [])));
  await document.fonts.ready;
  // check() alone answers true for a family with no @font-face at all, so look for a loaded face.
  const loaded = new Set();
  // A for-of loop, not forEach: with page scripts off, the browser will not call back into a function.
  for (const face of document.fonts) if (face.status === 'loaded') loaded.add(face.family.replace(/["']/g, ''));
  return families.filter((f) => !loaded.has(f));
}`;

export interface FitResult {
  ok: boolean;
  scale: number;
  fields: string[];
  regions: string[];
}
