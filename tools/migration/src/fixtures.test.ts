import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCsvObjects } from './csv';
import { readMapping } from './places';
import { runMigration } from './run';
import {
  fakeNational,
  syntheticMappingCsv,
  syntheticRegistrations,
  syntheticSubscribers,
  syntheticVenues,
} from './synthetic';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8');

describe('committed fixtures', () => {
  it('match the generator (run: pnpm --filter @qc/migration fixtures:write)', () => {
    expect(JSON.parse(read('venues.json'))).toEqual(JSON.parse(JSON.stringify(syntheticVenues())));
    expect(JSON.parse(read('registrations.json'))).toEqual(
      JSON.parse(JSON.stringify(syntheticRegistrations())),
    );
    expect(JSON.parse(read('subscribers.json'))).toEqual(
      JSON.parse(JSON.stringify(syntheticSubscribers())),
    );
    expect(read('mapping.csv')).toBe(syntheticMappingCsv());
  });

  it('contain only synthetic people, venues and numbers', () => {
    const text = ['venues.json', 'registrations.json', 'subscribers.json', 'mapping.csv']
      .map(read)
      .join('\n');
    // Every person is "Test Person N" and every Pakistani number is +92 300 followed by seven digits.
    const names = [...text.matchAll(/"name": "([^"]*)"/g)].map((m) => m[1]!);
    for (const name of names) expect(name).toMatch(/^(Test Person \d+|Sample [A-Za-z0-9 -]+|)$/);
    const numbers = [...text.matchAll(/\+?92[0-9]{10}|\b03[0-9]{9}\b|\+92 [0-9 ]{10,}/g)].map(
      (m) => m[0],
    );
    expect(numbers.length).toBeGreaterThan(5);
    for (const raw of numbers) expect(raw.replace(/\D/g, '')).toMatch(/^(0|92)?3000000[0-9]{3}$/);
    expect(text).not.toMatch(/https?:\/\/(?!maps\.example\.test)/);
    expect(fakeNational(5)).toBe('3000000005');
  });

  it('give the per-city dry run shown in the README, offline', async () => {
    const { report } = await runMigration({
      db: null,
      apply: false,
      now: new Date('2026-10-16T09:00:00Z'),
      input: {
        venues: JSON.parse(read('venues.json')),
        registrations: JSON.parse(read('registrations.json')),
        subscribers: JSON.parse(read('subscribers.json')),
        mapping: readMapping(parseCsvObjects(read('mapping.csv'))),
        createAreas: true,
      },
    });
    const perCity = Object.fromEntries(
      Object.entries(report.cities).map(([slug, c]) => [
        slug,
        [c.venues.toInsert, c.registrations.toInsert, c.subscribers.toInsert],
      ]),
    );
    expect(perCity).toEqual({
      faisalabad: [0, 0, 0],
      islamabad: [2, 2, 1],
      lahore: [2, 1, 1],
      multan: [2, 1, 0],
      rawalpindi: [2, 6, 1],
      unassigned: [0, 0, 1],
      'wah-cantt': [1, 0, 0],
    });
  });
});
