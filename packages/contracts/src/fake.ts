import { z } from 'zod';
import { FIXTURE_NOW } from './fixtures';

type Json = Record<string, unknown>;

/** A small seeded random number generator, so mock data is repeatable. */
export function seeded(seed: string): () => number {
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

const hex = (rng: () => number, n: number): string =>
  Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join('');

const byName: Record<string, string> = {
  phone: '+923000000099',
  contactPhone: '+923000000001',
  displayName: 'Sample Person',
  name: 'Sample Person',
  userName: 'Sample Person',
  authorName: 'Sample Coordinator',
  actorName: 'Sample Coordinator',
  actorPhoneLast4: '0000',
  teacherName: 'Sample Teacher',
  accessToken: 'mock-user',
  refreshToken: 'mock-refresh-token-0000',
  token: 'mock-device-token-0000',
  timezone: 'Asia/Karachi',
  slug: 'sample',
  service: 'api',
  csv: 'name,phone,party_size\n',
};

/**
 * Builds a value that satisfies a JSON schema. Used by the mock server for any endpoint without
 * a hand-written handler. It prefers `examples`, then sensible defaults by format or field name.
 */
export function fakeFromJsonSchema(
  schema: Json,
  rng: () => number,
  name = '',
  depth = 0,
  defs: Json = {},
): unknown {
  if (depth > 12) return null;
  if (typeof schema.$ref === 'string') {
    const target = defs[schema.$ref.replace('#/$defs/', '')] as Json | undefined;
    return target ? fakeFromJsonSchema(target, rng, name, depth + 1, defs) : null;
  }
  const examples = schema.examples as unknown[] | undefined;
  if (examples?.length) return examples[0];
  if ('const' in schema) return schema.const;
  if (schema.enum) return (schema.enum as unknown[])[0];
  if (schema.allOf) {
    const merged = (schema.allOf as Json[]).reduce<Json>((acc, s) => ({ ...acc, ...s }), {});
    return fakeFromJsonSchema(merged, rng, name, depth + 1, defs);
  }
  const variants = (schema.oneOf ?? schema.anyOf) as Json[] | undefined;
  if (variants) {
    const nonNull = variants.filter((v) => v.type !== 'null');
    return fakeFromJsonSchema((nonNull[0] ?? variants[0])!, rng, name, depth + 1, defs);
  }
  let type = schema.type as string | string[] | undefined;
  if (Array.isArray(type)) type = type.find((t) => t !== 'null') ?? 'null';
  if (name === 'nextCursor') return null;

  switch (type) {
    case 'object': {
      const props = (schema.properties ?? {}) as Record<string, Json>;
      const out: Json = {};
      for (const [k, v] of Object.entries(props))
        out[k] = fakeFromJsonSchema(v, rng, k, depth + 1, defs);
      return out;
    }
    case 'array': {
      const min = (schema.minItems as number | undefined) ?? 1;
      const max = (schema.maxItems as number | undefined) ?? 10;
      const count = Math.min(Math.max(min, 1), max);
      return Array.from({ length: count }, () =>
        fakeFromJsonSchema((schema.items ?? {}) as Json, rng, name, depth + 1, defs),
      );
    }
    case 'integer':
    case 'number': {
      const min = (schema.minimum as number | undefined) ?? 1;
      const max = schema.maximum as number | undefined;
      const v = Math.max(min, name.endsWith('Count') || name === 'unreadCount' ? 0 : 1);
      return max !== undefined ? Math.min(v, max) : v;
    }
    case 'boolean':
      return false;
    case 'null':
      return null;
    case 'string': {
      if (name in byName && !schema.format) return byName[name];
      switch (schema.format) {
        case 'uuid':
          return `00000000-0000-4000-8000-${hex(rng, 12)}`;
        case 'date-time':
          return FIXTURE_NOW;
        case 'date':
          return FIXTURE_NOW.slice(0, 10);
        case 'uri':
        case 'url':
          return 'https://example.org/sample';
      }
      if (typeof schema.pattern === 'string' && /\[0-9\]\{6\}/.test(schema.pattern))
        return '123456';
      const min = (schema.minLength as number | undefined) ?? 1;
      const text = name === 'id' ? hex(rng, 12) : 'sample';
      return text.length >= min ? text : text.padEnd(min, 'x');
    }
    default:
      return {};
  }
}

export function fakeFromSchema(
  schema: z.ZodType,
  rng: () => number,
  io: 'input' | 'output' = 'output',
): unknown {
  const { $defs, ...root } = z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as Json & {
    $defs?: Json;
  };
  return fakeFromJsonSchema(root, rng, '', 0, $defs ?? {});
}
