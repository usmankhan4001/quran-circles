import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkg = join(import.meta.dirname, '..');
const target = join(pkg, 'build', 'catalog', 'index.html');

describe('catalog', () => {
  const components = [
    'Text',
    'Button',
    'IconButton',
    'TextField',
    'Chip',
    'Checkbox',
    'Card',
    'ListItem',
    'Badge',
    'TabBar',
    'Sheet',
    'Select',
    'Switch',
    'SegmentedControl',
    'EmptyState',
    'ErrorState',
    'Skeleton',
    'Toast',
    'Avatar',
    'Header',
  ];

  it('builds one page that shows every component in every mode and both directions', () => {
    execFileSync(process.execPath, [join(pkg, 'scripts', 'catalog.mjs')], {
      cwd: pkg,
      stdio: 'pipe',
    });
    const html = readFileSync(target, 'utf8');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    for (const name of components) {
      expect(html, name).toContain(`<h2>${name}</h2>`);
    }
    for (const mode of ['Light', 'Dark', 'High contrast']) {
      expect(html).toContain(`${mode} · English, left to right`);
      expect(html).toContain(`${mode} · Urdu, right to left`);
    }
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('dir="ltr"');
    // Four text sizes are shown.
    for (const size of ['size 1 of 4', 'size 2 of 4', 'size 3 of 4', 'size 4 of 4']) {
      expect(html).toContain(size);
    }
    // The tokens section reports the contrast of the pairs, and none of them fails.
    expect(html).toContain('<h2>Tokens</h2>');
    expect(html).not.toContain('FAIL');
  }, 60_000);
});
