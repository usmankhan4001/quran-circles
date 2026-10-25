import { describe, expect, it } from 'vitest';
import { renderConsole, screen, shellReady, text } from '../test/harness';
import { resolveTheme, themeVariables } from './index';
import { textScale } from '../lib/ui-tokens';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('theme tokens', () => {
  it('resolves the system choice from the device preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('turns the shared design tokens into CSS variables for both modes', () => {
    const light = themeVariables('light');
    const dark = themeVariables('dark');
    expect(Object.keys(light)).toEqual(Object.keys(dark));
    expect(light['--c-background']).toBeTruthy();
    expect(light['--c-background']).not.toBe(dark['--c-background']);
    expect(light['--space-lg']).toMatch(/rem$/);
    expect(light['--touch-min']).toMatch(/rem$/);
  });
});

describe('stylesheet', () => {
  it('only uses CSS variables that the theme or the stylesheet defines', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    const own = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const themed = new Set([...Object.keys(themeVariables('light')), ...own]);
    expect([...used].filter((name) => !themed.has(name as string))).toEqual([]);
  });

  it('uses logical properties, so right to left needs no separate rules', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).not.toMatch(/\b(margin|padding)-(left|right)\s*:/);
    expect(css).not.toMatch(/\b(left|right)\s*:\s*[0-9-]/);
    expect(css).not.toMatch(/text-align\s*:\s*(left|right)/);
  });
});

describe('display controls', () => {
  it('switches between light and dark and remembers it', async () => {
    const { user, displayStore } = renderConsole({ role: 'national', path: '/sessions' });
    await shellReady();
    expect(document.documentElement.dataset.theme).toBe('light');
    const before = document.documentElement.style.getPropertyValue('--c-background');
    await user.selectOptions(screen.getByLabelText(text('console.shell.theme')), 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--c-background')).not.toBe(before);
    expect(displayStore.get('qc.console.theme')).toBe('dark');
  });

  it('scales all text from the root, so every rem size follows', async () => {
    const { user, displayStore } = renderConsole({ role: 'national', path: '/sessions' });
    await shellReady();
    expect(document.documentElement.style.fontSize).toBe('100%');
    await user.selectOptions(screen.getByLabelText(text('console.shell.textSize')), '3');
    expect(document.documentElement.style.fontSize).toBe(`${100 * textScale[3]}%`);
    expect(document.documentElement.dataset.textStep).toBe('3');
    expect(displayStore.get('qc.console.textSize')).toBe('3');
  });

  it('starts at a larger size when asked, and still shows the whole menu', async () => {
    renderConsole({ role: 'national', path: '/sessions', textStep: 3 });
    await shellReady();
    expect(document.documentElement.style.fontSize).toBe(`${100 * textScale[3]}%`);
    expect(screen.getAllByRole('link', { name: /./ }).length).toBeGreaterThanOrEqual(7);
  });
});
