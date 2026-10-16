import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * "No endpoint authorises by checking a role directly." Every decision goes through `can`
 * (via `requireAction` or the api-core adapter). This scans the API source outside the auth lane
 * for code that reads roles or assignments by hand.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));
const ROLE_NAMES = '(?:national_admin|city_coordinator|venue_coordinator)';

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: 'comparing a role', pattern: /\.\s*role\s*(?:===?|!==?)/ },
  {
    name: 'comparing with a role name',
    pattern: new RegExp(`(?:===?|!==?)\\s*['"\`]${ROLE_NAMES}['"\`]`),
  },
  {
    name: 'role name on the left of a comparison',
    pattern: new RegExp(`['"\`]${ROLE_NAMES}['"\`]\\s*(?:===?|!==?)`),
  },
  {
    name: 'a role list lookup',
    pattern: new RegExp(`\\.includes\\(\\s*['"\`]${ROLE_NAMES}['"\`]`),
  },
  { name: 'reading the principal assignments', pattern: /\bprincipal\s*\??\.\s*assignments\b/ },
  { name: 'switching on a role', pattern: /switch\s*\(\s*[\w.]*role\s*\)/ },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

const isAuthLane = (path: string) => {
  const rel = relative(SRC, path).split(sep).join('/');
  return rel.startsWith('auth/') || rel.startsWith('modules/auth/');
};
const isTest = (path: string) => path.endsWith('.test.ts') || path.includes(`${sep}test${sep}`);

describe('the scan itself', () => {
  it('flags the ways of checking a role by hand', () => {
    const samples = [
      'if (a.role === x) {}',
      "if (role !== 'national_admin') {}",
      "if ('city_coordinator' == role) {}",
      "roles.includes('venue_coordinator')",
      'principal.assignments.some((a) => a)',
      'principal?.assignments',
      'switch (assignment.role) {',
    ];
    for (const sample of samples) {
      expect(
        FORBIDDEN.some(({ pattern }) => pattern.test(sample)),
        sample,
      ).toBe(true);
    }
    expect(FORBIDDEN.some(({ pattern }) => pattern.test('requireAction("venue.update")'))).toBe(
      false,
    );
  });
});

describe('no handler checks roles by hand', () => {
  const files = sourceFiles(SRC).filter((f) => !isAuthLane(f) && !isTest(f));

  it('looks at the API source outside the auth lane', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('finds no code $name', ({ pattern }) => {
    const offenders = files.filter((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .some(
          (line) =>
            !line.trim().startsWith('//') && !line.trim().startsWith('*') && pattern.test(line),
        ),
    );
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });
});
