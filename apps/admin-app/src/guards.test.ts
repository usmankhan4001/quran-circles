import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { messages } from '@qc/i18n';
import { iconNames } from '@qc/ui';
import { describe, expect, it } from 'vitest';

const root = __dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'test' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(root).map((path) => ({
  path: path.slice(root.length + 1),
  text: readFileSync(path, 'utf8'),
}));

describe('what the admin app must never do', () => {
  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('never asks for a bulk export of registrants', () => {
    for (const f of files) {
      expect(f.text, f.path).not.toMatch(
        /registrations\s*\.\s*export|registrations\.export|\/export\b/,
      );
    }
  });

  it('never logs, so phone numbers and names cannot reach a log', () => {
    for (const f of files) {
      expect(f.text, f.path).not.toMatch(/\bconsole\s*\.\s*(log|info|warn|error|debug|trace)\b/);
    }
  });

  it('never imports another app or a database or push library', () => {
    for (const f of files) {
      expect(f.text, f.path).not.toMatch(
        /from\s+['"](@supabase|@neondatabase|onesignal|react-native-onesignal)/,
      );
      expect(f.text, f.path).not.toMatch(/from\s+['"]\.\.\/(\.\.\/)*apps\//);
    }
  });
});

describe('colours', () => {
  it('uses theme tokens only, with no raw colour in screen code', () => {
    for (const f of files) {
      expect(f.text, f.path).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    }
  });

  it('uses the kit green header on every screen, not a local copy', () => {
    const frame = files.find((f) => f.path === 'components/Screen.tsx')!;
    expect(frame.text).toMatch(/import \{[^}]*\bHeroHeader\b[^}]*\} from '@qc\/ui'/);
    expect(files.some((f) => f.path === 'components/HeroHeader.tsx')).toBe(false);
  });

  it('draws locally only the icons the kit line set does not have', () => {
    const glyphs = files.find((f) => f.path === 'components/glyphs.tsx')!;
    for (const name of iconNames) {
      expect(glyphs.text, name).not.toContain(`case '${name}'`);
    }
    // Only AppIcon draws a glyph; screens never pick the local drawing over the kit icon.
    for (const f of files.filter((x) => x.path !== 'components/glyphs.tsx')) {
      expect(f.text, f.path).not.toMatch(/<Glyph\b/);
    }
  });

  it('uses the kit pieces that replaced the local stand-ins', () => {
    for (const name of ['Tag', 'SessionCard', 'SeatMeter', 'ConfirmSheet']) {
      expect(
        files.some((f) => f.path === `components/${name}.tsx`),
        name,
      ).toBe(false);
      for (const f of files) {
        expect(f.text, f.path).not.toContain(`components/${name}'`);
      }
    }
  });
});

describe('the words on screen', () => {
  const en = messages.en as Record<string, string>;
  const ur = messages.ur as Record<string, string>;
  const literal = /['"]((?:admin|errors|ui)\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)['"]/g;

  it('only refers to keys that exist in English and Urdu', () => {
    const missing: string[] = [];
    for (const f of files) {
      for (const match of f.text.matchAll(literal)) {
        const key = match[1]!;
        const exists = (table: Record<string, string>) =>
          key in table || `${key}.one` in table || `${key}.other` in table;
        if (!exists(en) || !exists(ur)) missing.push(`${f.path}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('puts no readable English sentence straight into a screen', () => {
    // A JSX text node that starts with a capital letter and has a space is a sentence that skipped @qc/i18n.
    const offenders: string[] = [];
    for (const f of files.filter((x) => x.path.endsWith('.tsx'))) {
      for (const match of f.text.matchAll(/>\s*([A-Z][a-z]+(?: [a-z]+)+[.!?]?)\s*</g)) {
        offenders.push(`${f.path}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
