import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type AxeResult = AxeResults['violations'][number];

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface Violation {
  rule: string;
  impact: Impact;
  /** 'wcag' when a WCAG 2.x A/AA tag is on the rule, otherwise 'best-practice'. */
  kind: 'wcag' | 'best-practice';
  help: string;
  helpUrl: string;
  nodes: number;
  /** Up to three CSS targets, to find the element again. */
  targets: string[];
  /** Up to two failure summaries from axe. */
  summaries: string[];
}

export interface AxeOutcome {
  violations: Violation[];
  /** Rules axe could not decide (often contrast over an image or gradient): need a human. */
  incomplete: { rule: string; nodes: number }[];
}

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function toViolation(v: AxeResult): Violation {
  return {
    rule: v.id,
    impact: (v.impact ?? 'minor') as Impact,
    kind: v.tags.some((t) => WCAG_TAGS.includes(t)) ? 'wcag' : 'best-practice',
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target.map(String).join(' ')),
    summaries: v.nodes
      .slice(0, 2)
      .map((n) => (n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 300)),
  };
}

/** Runs axe-core with the WCAG 2.2 A/AA rules and the best-practice rules on the whole page. */
export async function runAxe(page: Page): Promise<AxeOutcome> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS, 'best-practice'])
    .setLegacyMode(true)
    .analyze();
  return {
    violations: results.violations.map(toViolation),
    incomplete: results.incomplete.map((r) => ({ rule: r.id, nodes: r.nodes.length })),
  };
}

export interface LayoutFinding {
  check:
    | 'dir'
    | 'lang'
    | 'overflow'
    | 'clipped-text'
    | 'target-size'
    | 'icon-mirroring'
    | 'text-arrow'
    | 'urdu-aligned-left'
    | 'tab-order';
  detail: string;
}

export interface LayoutProbe {
  htmlDir: string;
  htmlLang: string;
  /** The `dir` of the innermost wrapper that holds the screen's content. */
  contentDir: string;
  findings: LayoutFinding[];
}

/**
 * Right-to-left and layout checks that axe does not make, run inside the page:
 * - `dir` and `lang` on the document and on the content wrapper match the language;
 * - nothing with text or a control sticks out of the viewport sideways, unless it is inside a
 *   horizontal scroller (the guide's chip rows and carousels);
 * - text cut off inside its own box (a fixed height or width with hidden overflow), unless it is
 *   an intended ellipsis;
 * - controls smaller than the project's 48 dp target (checklist O1);
 * - kit icons that point (the guide's flip list) are mirrored in Urdu and only in Urdu;
 * - arrow characters typed into text, which never mirror;
 * - Urdu text aligned to the left in an Urdu screen;
 * - the first tab (or the console's sidebar) sits at the start side (right in Urdu).
 */
export async function probeLayout(
  page: Page,
  expected: {
    locale: 'en' | 'ur';
    flipping: readonly string[];
    /** Two selectors in reading order, e.g. the first and last tab: the first must be at the start. */
    tabs: [string, string] | null;
  },
): Promise<LayoutProbe> {
  return page.evaluate((exp) => {
    const findings: { check: string; detail: string }[] = [];
    const vw = window.innerWidth;
    const rtl = exp.locale === 'ur';
    const wantDir = rtl ? 'rtl' : 'ltr';
    const flipping = new Set(exp.flipping);
    const label = (el: Element): string => {
      const id = el.getAttribute('data-testid');
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
      return `${role}${id ? `#${id}` : ''}${text ? ` "${text}"` : ''}`;
    };
    const hidden = (el: Element): boolean => {
      if (el.closest('[aria-hidden="true"]')) return true;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0)
        return true;
      const r = el.getBoundingClientRect();
      return r.width === 0 || r.height === 0;
    };
    const ownText = (el: Element): string =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
    const interactive = (el: Element): boolean =>
      el.matches(
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="slider"], [role="menuitem"], [role="combobox"]',
      );

    const htmlDir = document.documentElement.getAttribute('dir') ?? '';
    const htmlLang = document.documentElement.getAttribute('lang') ?? '';
    if (htmlDir !== wantDir)
      findings.push({ check: 'dir', detail: `<html dir="${htmlDir}">, expected "${wantDir}"` });
    if (!htmlLang.startsWith(exp.locale))
      findings.push({
        check: 'lang',
        detail: `<html lang="${htmlLang}">, expected "${exp.locale}"`,
      });
    const probe = document.elementFromPoint(vw / 2, window.innerHeight / 3);
    const contentDir = probe ? getComputedStyle(probe).direction : '';
    if (contentDir && contentDir !== wantDir)
      findings.push({
        check: 'dir',
        detail: `content direction is ${contentDir}, expected ${wantDir}`,
      });

    const all = [...document.querySelectorAll('body *')];
    const scrollerOf = (el: Element): Element | null => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p;
      }
      return null;
    };
    let overflowCount = 0;
    let clippedCount = 0;
    let smallCount = 0;
    for (const el of all) {
      if (hidden(el)) continue;
      const text = ownText(el);
      const isControl = interactive(el);
      if (!text && !isControl) continue;
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && !scrollerOf(el)) {
        overflowCount += 1;
        if (overflowCount <= 6)
          findings.push({
            check: 'overflow',
            detail: `${label(el)} spans x ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`,
          });
      }
      if (text) {
        const style = getComputedStyle(el);
        const intended =
          style.textOverflow === 'ellipsis' ||
          (style.getPropertyValue('-webkit-line-clamp') || 'none') !== 'none';
        const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip';
        const clipsY = style.overflowY === 'hidden' || style.overflowY === 'clip';
        const cutX = clipsX && el.scrollWidth > el.clientWidth + 2;
        const cutY = clipsY && el.scrollHeight > el.clientHeight + 2;
        // A 1 px box is the visually-hidden pattern for screen-reader-only text, not clipping.
        const srOnly = el.clientWidth <= 2 || el.clientHeight <= 2;
        if (!intended && !srOnly && (cutX || cutY)) {
          clippedCount += 1;
          if (clippedCount <= 6)
            findings.push({
              check: 'clipped-text',
              detail:
                `${label(el)} ${cutX ? `width ${el.clientWidth}<${el.scrollWidth}` : ''}${cutY ? ` height ${el.clientHeight}<${el.scrollHeight}` : ''}`.trim(),
            });
        }
        if (rtl && /[؀-ۿ]/.test(text) && style.textAlign === 'left' && !el.closest('[lang="en"]')) {
          findings.push({ check: 'urdu-aligned-left', detail: label(el) });
        }
        if (rtl && /[←→›‹»«❯❮]/.test(text)) {
          findings.push({
            check: 'text-arrow',
            detail: `${label(el)} contains an arrow character that does not mirror`,
          });
        }
      }
      if (isControl && !el.closest('p') && (r.width < 47.5 || r.height < 47.5)) {
        // Inline links inside running text are exempt (WCAG 2.5.8 exception), as are controls
        // whose parent already gives the 48 dp hit area.
        const parent = el.parentElement?.getBoundingClientRect();
        const parentGives =
          parent !== undefined &&
          parent.width >= 47.5 &&
          parent.height >= 47.5 &&
          el.parentElement !== null &&
          interactive(el.parentElement);
        if (!parentGives) {
          smallCount += 1;
          if (smallCount <= 8)
            findings.push({
              check: 'target-size',
              detail: `${label(el)} is ${Math.round(r.width)}x${Math.round(r.height)}`,
            });
        }
      }
    }
    if (overflowCount > 6)
      findings.push({ check: 'overflow', detail: `…and ${overflowCount - 6} more` });
    if (clippedCount > 6)
      findings.push({ check: 'clipped-text', detail: `…and ${clippedCount - 6} more` });
    if (smallCount > 8)
      findings.push({ check: 'target-size', detail: `…and ${smallCount - 8} more` });

    for (const icon of document.querySelectorAll('[data-testid^="icon-"]')) {
      if (hidden(icon) && !icon.closest('[aria-hidden="true"]')) continue;
      const name = (icon.getAttribute('data-testid') ?? '').slice(5);
      const t = getComputedStyle(icon).transform;
      const m = /^matrix\(([-\d.e]+)/.exec(t);
      const flipped = m !== null && Number(m[1]) < 0;
      const should = rtl && flipping.has(name);
      if (flipped !== should)
        findings.push({
          check: 'icon-mirroring',
          detail: `icon "${name}" is ${flipped ? '' : 'not '}mirrored in ${exp.locale}`,
        });
    }

    if (exp.tabs) {
      const first = document.querySelector(exp.tabs[0]);
      const last = document.querySelector(exp.tabs[1]);
      if (first && last) {
        const a = first.getBoundingClientRect();
        const b = last.getBoundingClientRect();
        const firstAtStart = rtl ? a.left > b.left : a.left < b.left;
        if (!firstAtStart)
          findings.push({
            check: 'tab-order',
            detail: `${exp.tabs[0]} is not at the ${rtl ? 'right' : 'left'} of ${exp.tabs[1]}`,
          });
      }
    }
    return { htmlDir, htmlLang, contentDir, findings: findings as LayoutProbe['findings'] };
  }, expected);
}
