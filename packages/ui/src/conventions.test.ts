import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';

/**
 * Static checks on the source of the kit. They enforce the rules in
 * packages/ui/CLAUDE.md and docs/design/principles.md so a later change cannot quietly break them.
 */
const root = join(import.meta.dirname, '.');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'test' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const components = sourceFiles(join(root, 'components'));
const rel = (f: string) => f.slice(root.length + 1);

describe('component source', () => {
  it('finds the components', () => {
    expect(components.length).toBeGreaterThanOrEqual(20);
  });

  // Icon draws shapes physically on purpose and mirrors them as a whole.
  const logicalOnly = components.filter((f) => !f.endsWith('Icon.tsx'));

  it.each(logicalOnly.map((f) => [rel(f), f]))('%s uses logical (start/end) layout, never left/right', (_name, file) => {
    const src = readFileSync(file as string, 'utf8');
    const physical =
      /\b(margin|padding)(Left|Right)\b|\bborder(Left|Right)(Width|Color)\b|\bborder(Top|Bottom)(Left|Right)Radius\b|[{,]\s*(left|right)\s*:|textAlign:\s*['"](left|right)['"]|flexDirection:\s*['"]row-reverse['"]/;
    expect(src.match(physical)?.[0]).toBeUndefined();
  });

  it.each(components.map((f) => [rel(f), f]))('%s has no raw colours: it reads the theme', (_name, file) => {
    const src = readFileSync(file as string, 'utf8');
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/)?.[0]).toBeUndefined();
    expect(src.match(/\brgba?\(/)?.[0]).toBeUndefined();
  });

  it.each(components.map((f) => [rel(f), f]))('%s has no `any` and no hard-coded sentences', (_name, file) => {
    const src = readFileSync(file as string, 'utf8');
    expect(src.match(/:\s*any\b|<any>|as any\b/)?.[0]).toBeUndefined();
    // Text children must be props or theme.t() calls, not literal words.
    expect(src.match(/>\s*[A-Z][a-z]+(?:\s+[a-z]+)+\s*</)?.[0]).toBeUndefined();
  });

  it('every built-in string key the kit uses exists in English and Urdu', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(root)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/['"](ui\.[A-Za-z]+)['"]/g)) used.add(m[1] as string);
    }
    expect(used.size).toBeGreaterThan(10);
    for (const key of used) {
      expect((messages.en as Record<string, string>)[key], `en ${key}`).toBeTruthy();
      expect((messages.ur as Record<string, string>)[key], `ur ${key}`).toBeTruthy();
    }
  });
});
