import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

/**
 * Proof that building the contract schemas lazily changed nothing: every exported schema and every
 * endpoint's params, query, body and success schema is loaded twice, once as shipped (lazy) and
 * once with `lazy` replaced by "build now" (the old, eager module), and the two must give the same
 * JSON Schema and the same parse result (success, output data, every issue) on the same inputs:
 * every value found in the fixtures, awkward values (wrong types, unsafe characters, long text),
 * values generated from each schema, and those values with one field removed or broken.
 */

type Module = Record<string, unknown>;
type Schema = z.ZodType;
type EndpointLike = {
  params?: Schema;
  query?: Schema;
  body?: Schema;
  success: { schema?: Schema };
};

let lazyModule: Module;
let eagerModule: Module;
let fakeFromSchema: (schema: Schema, rng: () => number, io: 'input' | 'output') => unknown;
let fixtures: unknown;

beforeAll(async () => {
  vi.resetModules();
  vi.doMock('./lazy', () => ({ lazy: (build: () => unknown) => build(), isBuilt: () => true }));
  eagerModule = (await import('./index')) as Module;
  vi.doUnmock('./lazy');
  vi.resetModules();
  lazyModule = (await import('./index')) as Module;
  ({ fakeFromSchema } = await import('./fake'));
  ({ fixtures } = await import('./fixtures'));
});

afterAll(() => {
  vi.resetModules();
});

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && '_zod' in value;

function pairs(): [string, Schema, Schema][] {
  const out: [string, Schema, Schema][] = [];
  for (const name of Object.keys(eagerModule)) {
    const eager = eagerModule[name];
    if (isSchema(eager)) out.push([name, eager, lazyModule[name] as Schema]);
  }
  const eagerEndpoints = eagerModule.endpoints as Record<string, EndpointLike>;
  const lazyEndpoints = lazyModule.endpoints as Record<string, EndpointLike>;
  for (const id of Object.keys(eagerEndpoints)) {
    const eager = eagerEndpoints[id]!;
    const lazy = lazyEndpoints[id]!;
    for (const part of ['params', 'query', 'body'] as const) {
      if (eager[part]) out.push([`${id}.${part}`, eager[part], lazy[part]!]);
    }
    if (eager.success.schema)
      out.push([`${id}.success`, eager.success.schema, lazy.success.schema!]);
  }
  return out;
}

/** A small seeded generator, so the generated inputs are the same on every run. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function fixturePool(): unknown[] {
  const seen = new Map<string, unknown>();
  const add = (value: unknown, depth: number): void => {
    const key = JSON.stringify(value);
    if (key === undefined || seen.has(key)) return;
    if (key.length <= 20_000) seen.set(key, value);
    if (depth > 6) return;
    if (Array.isArray(value)) value.slice(0, 3).forEach((item) => add(item, depth + 1));
    else if (value && typeof value === 'object')
      Object.values(value).forEach((item) => add(item, depth + 1));
  };
  add(JSON.parse(JSON.stringify(fixtures)), 0);
  return [...seen.values()];
}

const AWKWARD: unknown[] = [
  undefined,
  null,
  true,
  0,
  -1,
  1.5,
  Number.NaN,
  '',
  'x',
  'true',
  '0',
  '+923001234567',
  '+924211122233',
  '+12025550123',
  '00000000-0000-4000-8000-000000000001',
  'not-a-uuid',
  '2027-02-18T01:15:00Z',
  '2027-02-18',
  '19:30',
  'https://meet.example.org/c',
  'http://example.org/',
  'javascript:alert(1)',
  'https://user:pw@example.org/',
  'a‮b',
  'a‌b',
  'line\nbreak',
  'x'.repeat(5000),
  [],
  {},
  { en: 'A', ur: null },
  { en: '' },
  new Uint8Array([1, 2]),
];

function broken(value: unknown): unknown[] {
  if (Array.isArray(value)) return [[], [null], value.slice(1)];
  if (!value || typeof value !== 'object') return [];
  const out: unknown[] = [{ ...value, unexpected: 'x' }];
  for (const key of Object.keys(value)) {
    const rest: Record<string, unknown> = { ...value };
    delete rest[key];
    out.push(rest);
    for (const bad of [null, 7, '', 'a‮b', 'x'.repeat(5000), [], {}]) {
      out.push({ ...value, [key]: bad });
    }
  }
  return out;
}

const outcome = (schema: Schema, input: unknown): string => {
  try {
    const result = schema.safeParse(input instanceof Uint8Array ? input : structuredClone(input));
    if (result.success) return JSON.stringify({ ok: true, data: result.data });
    return JSON.stringify({ ok: false, issues: result.error.issues });
  } catch (error) {
    return JSON.stringify({ threw: String(error) });
  }
};

const jsonSchema = (schema: Schema, io: 'input' | 'output'): string => {
  try {
    return JSON.stringify(z.toJSONSchema(schema, { io, unrepresentable: 'any' }));
  } catch (error) {
    return `threw ${String(error)}`;
  }
};

describe('lazy contracts behave exactly like eager ones', () => {
  it('covers every exported schema and every endpoint schema', () => {
    const all = pairs();
    expect(all.length).toBeGreaterThan(300);
    for (const [name, , lazy] of all) expect(isSchema(lazy), name).toBe(true);
  });

  it('gives the same JSON Schema for input and output', () => {
    for (const [name, eager, lazy] of pairs()) {
      for (const io of ['input', 'output'] as const) {
        expect(jsonSchema(lazy, io), `${name} (${io})`).toBe(jsonSchema(eager, io));
      }
    }
  });

  it('accepts and refuses the same inputs with the same data and issues', () => {
    const pool = [...fixturePool(), ...AWKWARD];
    let compared = 0;
    for (const [name, eager, lazy] of pairs()) {
      const inputs = [...pool];
      for (const io of ['input', 'output'] as const) {
        for (let seed = 0; seed < 2; seed++) {
          let generated: unknown;
          try {
            generated = fakeFromSchema(eager, seeded(`${name}${seed}`), io);
          } catch {
            continue;
          }
          inputs.push(generated);
          if (seed === 0) inputs.push(...broken(generated));
        }
      }
      for (const input of inputs) {
        const want = outcome(eager, input);
        const got = outcome(lazy, input);
        if (got !== want)
          expect(got, `${name}: ${JSON.stringify(input)?.slice(0, 200)}`).toBe(want);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(100_000);
    // More than 100,000 parses: a few seconds alone, longer when every package tests at once.
  }, 120_000);
});
