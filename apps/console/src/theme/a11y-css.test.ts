import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Layout rules from the accessibility and right-to-left pass (docs/quality/accessibility-rtl.md).
 * jsdom has no layout, so these read the stylesheet; the real check is the e2e quality run.
 */
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[2] ?? '';
}

describe('reflow at large text and at 320 px (A-03, A-04)', () => {
  it('keeps the page one column no wider than the window', () => {
    expect(rule('.page')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('never asks a grid column or a field for more width than the window has', () => {
    // `minmax(14rem, 1fr)` is 336 px at the largest text, wider than a 320 px phone.
    expect(css).not.toMatch(/minmax\(\d+(\.\d+)?rem,/);
    const fixedMins = [...css.matchAll(/min-inline-size:\s*(\d+(\.\d+)?rem)\s*;/g)].map(
      (m) => m[0],
    );
    // Only boxes inside a horizontal scroller may keep a fixed minimum (the tables).
    expect(fixedMins).toEqual(['min-inline-size: 36rem;']);
    expect(rule('.table-wrap')).toMatch(/overflow-x:\s*auto/);
  });

  it('breaks a word that is longer than its line', () => {
    expect(rule('body')).toMatch(/overflow-wrap:\s*break-word/);
  });

  it('keeps one column with the side card at the two largest text sizes', () => {
    expect(css).toMatch(/html\[data-text-step='2'\] :is\(\.split, \.split-posters\)/);
    expect(css).toMatch(/html\[data-text-step='3'\] :is\(\.split, \.split-posters\)/);
  });
});

describe('targets of 48 dp (A-05, checklist O1)', () => {
  it('makes the pill itself the field control, with its label above it', () => {
    // The control is the pill (at least 48 dp unless a compact bar sets its own height), and the
    // label is a real label above it, so a click on either reaches the control.
    expect(rule('.field-box .input')).toMatch(
      /min-block-size:\s*var\(--field-h, var\(--touch-min\)\)/,
    );
    expect(rule('.input')).toMatch(/border-radius:\s*var\(--radius-field\)/);
    expect(rule('.field-box')).toMatch(/display:\s*grid/);
  });

  it('makes a tick box itself 48 dp, drawing the box smaller inside it', () => {
    const check = rule('.check input');
    expect(check).toMatch(/inline-size:\s*var\(--touch-min\)/);
    expect(check).toMatch(/block-size:\s*var\(--touch-min\)/);
    expect(check).toMatch(/border:\s*var\(--check-ring\) solid transparent/);
  });

  it('gives links in table rows, tabs, credits, small buttons and segments the full size', () => {
    expect(rule('.row-actions a')).toMatch(/min-block-size:\s*var\(--touch-min\)/);
    expect(rule('.row-actions a')).toMatch(/min-inline-size:\s*var\(--touch-min\)/);
    // Small buttons follow the console artboard's 36 px pills (above the 24 px WCAG 2.2 minimum).
    expect(rule('.btn-small')).toMatch(/min-block-size:\s*2\.25rem/);
    expect(rule('.segment')).toMatch(/min-block-size:\s*var\(--touch-min\)/);
    expect(rule('.segment')).toMatch(/min-inline-size:\s*var\(--touch-min\)/);
    expect(rule('.session-tab')).toMatch(/min-inline-size:\s*var\(--touch-min\)/);
    expect(rule('.credits-group a')).toMatch(/min-block-size:\s*var\(--touch-min\)/);
  });
});
