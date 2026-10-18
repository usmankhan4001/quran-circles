import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { isBuilt, lazy } from './lazy';

describe('lazy schemas', () => {
  it('builds on the first read, once, and not before', () => {
    const build = vi.fn(() => z.object({ name: z.string().min(2) }));
    const schema = lazy(build);
    expect(build).not.toHaveBeenCalled();
    expect(isBuilt(schema)).toBe(false);

    expect(schema.safeParse({ name: 'Ali' }).success).toBe(true);
    expect(schema.safeParse({ name: 'A' }).success).toBe(false);
    expect(schema.parse({ name: 'Sara' })).toEqual({ name: 'Sara' });
    expect(build).toHaveBeenCalledTimes(1);
    expect(isBuilt(schema)).toBe(true);
  });

  it('is not built by being put inside another schema, only when that one parses', () => {
    const build = vi.fn(() => z.string().min(1));
    const inner = lazy(build);
    const outer = z.object({ inner, list: z.array(inner).optional() });
    expect(build).not.toHaveBeenCalled();
    expect(outer.safeParse({ inner: 'x', list: ['y'] }).success).toBe(true);
    expect(outer.safeParse({ inner: '' }).success).toBe(false);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('is a real zod schema of the built kind', () => {
    const schema = lazy(() => z.object({ a: z.number() }));
    expect(schema instanceof z.ZodObject).toBe(true);
    expect(schema instanceof z.ZodType).toBe(true);
    expect(schema).toBeInstanceOf(z.ZodObject);
    expect(Object.keys(schema.shape)).toEqual(['a']);
    expect(schema.type).toBe('object');
    const other = lazy(() => z.string());
    expect('parse' in other).toBe(true);
    expect(other instanceof z.ZodObject).toBe(false);
  });

  it('gives the same refusals, codes and paths as the schema it builds', () => {
    const make = () =>
      z.object({
        phone: z.string().regex(/^\+92/),
        size: z.number().int().min(1).max(5),
        kind: z.enum(['a', 'b']),
        safe: z.string().refine((v) => !v.includes('‮'), { params: { code: 'unsafe' } }),
      });
    const eager = make();
    const lazySchema = lazy(make);
    for (const input of [
      { phone: '+923001234567', size: 2, kind: 'a', safe: 'ok' },
      { phone: '0300', size: 0, kind: 'c', safe: 'a‮b' },
      { phone: 1, size: 2.5 },
      null,
      'text',
    ]) {
      const a = eager.safeParse(input);
      const b = lazySchema.safeParse(input);
      expect(b.success).toBe(a.success);
      expect(b.error?.issues).toEqual(a.error?.issues);
      expect(b.data).toEqual(a.data);
    }
  });

  it('keeps the refusal code of factories that change the schema after building it', () => {
    const bytes = lazy(() => z.instanceof(Uint8Array));
    expect(bytes.safeParse(new Uint8Array([1])).success).toBe(true);
    expect(bytes.safeParse('x').error?.issues[0]?.code).toBe('invalid_type');
    expect(bytes.safeParse('x').error?.issues).toEqual(
      z.instanceof(Uint8Array).safeParse('x').error?.issues,
    );
  });

  it('keeps metadata, including ids, and the stand-in is what the registry knows', () => {
    const Named = lazy(() => z.object({ en: z.string() }).meta({ id: 'LazyNamedTest' }));
    const Example = lazy(() => z.string().meta({ examples: ['x'], description: 'An example' }));
    const Parent = z.object({ a: Named, b: Named.nullable(), c: Example });
    expect(Named.meta()).toEqual({ id: 'LazyNamedTest' });
    expect(Example.description).toBe('An example');
    const json = z.toJSONSchema(Parent) as {
      properties: Record<string, unknown>;
      $defs?: Record<string, unknown>;
    };
    expect(json.$defs?.LazyNamedTest).toBeDefined();
    expect(json.properties.a).toEqual({ $ref: '#/$defs/LazyNamedTest' });
    expect(json.properties.c).toMatchObject({ examples: ['x'], description: 'An example' });
    expect(z.globalRegistry.get(Named)?.id).toBe('LazyNamedTest');
  });

  it('wraps the stand-in itself in optional, nullable and extend', () => {
    const Base = lazy(() => z.object({ a: z.string() }));
    expect(Base.optional().unwrap()).toBe(Base);
    expect(Base.nullable().unwrap()).toBe(Base);
    const Wider = Base.extend({ b: z.number() });
    expect(Wider.parse({ a: 'x', b: 1 })).toEqual({ a: 'x', b: 1 });
    expect(Wider.safeParse({ a: 'x' }).success).toBe(false);
  });

  it('builds again on the next read when building threw', () => {
    let attempts = 0;
    const schema = lazy(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('not yet');
      return z.boolean();
    });
    expect(() => schema.parse(true)).toThrow('not yet');
    expect(schema.parse(true)).toBe(true);
    expect(attempts).toBe(2);
  });

  it('refuses a schema that reads itself while it is being built', () => {
    const self: z.ZodString = lazy((): z.ZodString => self.min(1));
    expect(() => self.parse('x')).toThrow('read while it was being built');
  });

  it('accepts assignment after the first read like any zod schema', () => {
    const schema = lazy(() => z.string()) as z.ZodString & { note?: string };
    schema.note = 'kept';
    expect(schema.note).toBe('kept');
    expect(schema.parse('x')).toBe('x');
  });
});

describe('importing @qc/contracts', () => {
  it('builds no schema until one is used', async () => {
    vi.resetModules();
    const config = (globalThis as { __zod_globalConfig?: { postProcessor?: unknown } })
      .__zod_globalConfig;
    expect(config).toBeDefined();
    let built = 0;
    const previous = config!.postProcessor;
    config!.postProcessor = () => {
      built += 1;
    };
    try {
      const contracts = await import('./index');
      expect(built).toBe(0);
      expect(contracts.Locale.parse('ur')).toBe('ur');
      expect(built).toBeGreaterThan(0);
    } finally {
      config!.postProcessor = previous;
    }
  });
});
