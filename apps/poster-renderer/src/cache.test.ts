import { describe, expect, it } from 'vitest';
import { cacheKey, canonicalJson, MemoryCache, type CacheKeyParts } from './cache';
import { SAMPLE_FIELDS, SAMPLE_SESSION, sampleRequest } from './sample';
import { fakeRenderer } from './test/fakes';

const base: CacheKeyParts = {
  templateId: 'cloud',
  templateVersion: 1,
  format: 'story',
  language: 'en_ur',
  fields: SAMPLE_FIELDS,
  session: SAMPLE_SESSION,
  deepLink: 'https://example.org/register/x',
};

describe('cacheKey', () => {
  it('does not depend on the order of object keys', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }),
    );
    const reordered = {
      ...base,
      session: Object.fromEntries(Object.entries(SAMPLE_SESSION).reverse()),
    };
    expect(cacheKey(reordered)).toBe(cacheKey(base));
  });

  it('changes with the session version, the fields, the template version, the format, the language and the link', () => {
    const key = cacheKey(base);
    const variants: CacheKeyParts[] = [
      { ...base, session: { ...SAMPLE_SESSION, sessionVersion: 'next' } },
      { ...base, fields: { ...SAMPLE_FIELDS, accent: 'night' } },
      { ...base, templateVersion: 2 },
      { ...base, templateId: 'night' },
      { ...base, format: 'print_a4' },
      { ...base, language: 'ur_en' },
      { ...base, deepLink: 'https://example.org/session/x' },
    ];
    const keys = variants.map(cacheKey);
    expect(new Set([key, ...keys]).size).toBe(variants.length + 1);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('MemoryCache', () => {
  const file = (n: number) => ({ bytes: Buffer.alloc(n), contentType: 'image/png' });

  it('evicts the least recently used entries beyond its byte budget', () => {
    const cache = new MemoryCache(30);
    cache.set('a', file(10));
    cache.set('b', file(10));
    cache.set('c', file(10));
    cache.get('a'); // a is now the most recent
    cache.set('d', file(10));
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.size).toBe(30);
    expect(cache.count).toBe(3);
  });

  it('never keeps a file larger than the budget, and a budget of 0 keeps nothing', () => {
    const cache = new MemoryCache(5);
    cache.set('big', file(6));
    expect(cache.count).toBe(0);
    const off = new MemoryCache(0);
    off.set('a', file(1));
    expect(off.get('a')).toBeUndefined();
  });

  it('replaces an entry under the same key without double counting', () => {
    const cache = new MemoryCache(100);
    cache.set('a', file(10));
    cache.set('a', file(20));
    expect(cache.size).toBe(20);
  });
});

describe('PosterRenderer caching per session version', () => {
  it('renders once, then answers the same request from the cache', async () => {
    const { pages, renderer } = fakeRenderer();
    const first = await renderer.render(sampleRequest({ formats: ['story', 'print_a4'] }));
    const again = await renderer.render(sampleRequest({ formats: ['print_a4', 'story'] }));
    expect(pages.jobs).toHaveLength(2);
    expect(first.files.map((f) => f.cached)).toEqual([false, false]);
    expect(again.files.map((f) => f.cached)).toEqual([true, true]);
    expect(again.files.find((f) => f.format === 'story')?.sha256).toBe(
      first.files.find((f) => f.format === 'story')?.sha256,
    );
  });

  it('renders again for a new session version, and only the formats it has not got', async () => {
    const { pages, renderer } = fakeRenderer();
    await renderer.render(sampleRequest({ formats: ['story'] }));
    await renderer.render(sampleRequest({ formats: ['story', 'link_preview'] }));
    expect(pages.jobs).toHaveLength(2);
    const next = await renderer.render(
      sampleRequest({ formats: ['story'], session: { ...SAMPLE_SESSION, sessionVersion: 'v2' } }),
    );
    expect(pages.jobs).toHaveLength(3);
    expect(next.files[0]?.cached).toBe(false);
  });

  it('returns the snapshot, the deep link in the contract format, the leading locale and alt text', async () => {
    const { renderer } = fakeRenderer({ webBase: 'https://example.org' });
    const result = await renderer.render(sampleRequest({ language: 'ur_en' }));
    expect(result.sourceSnapshot).toEqual(SAMPLE_SESSION);
    expect(result.deepLink).toBe(`https://example.org/register/${SAMPLE_SESSION.sessionId}`);
    expect(result.locale).toBe('ur');
    expect(result.altText.en).toBe(
      'Weekly Dars-e-Quran: Quran circle at Al-Noor Sample Masjid, Every Friday at 9:30 pm',
    );
    expect(result.altText.ur).toContain('مسجد النور (نمونہ)');
    expect(result.files[0]?.filename).toBe('poster-0f6f1e4a-cloud-story-ur_en.png');
  });

  it('gives every format its own page size and output', async () => {
    const { pages, renderer } = fakeRenderer();
    await renderer.render(
      sampleRequest({ formats: ['story', 'print_a4', 'print_a3', 'link_preview'] }),
    );
    expect(pages.jobs.map((j) => [j.width, j.height, j.output])).toEqual([
      [1080, 1920, { kind: 'png' }],
      [794, 1123, { kind: 'pdf', format: 'A4' }],
      [1123, 1587, { kind: 'pdf', format: 'A3' }],
      [1200, 630, { kind: 'png' }],
    ]);
  });
});
