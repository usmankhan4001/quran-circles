import {
  DEMO_POSTER_TEMPLATES,
  POSTER_ACCENTS,
  POSTER_FAILURE_CODES,
  POSTER_FAILURE_RETRYABLE,
  PosterSourceSnapshot,
  posterFailureFromRenderer,
  posterStorageKey,
  RendererErrorResponse,
  RendererRenderRequest,
  RendererRenderResponse,
} from '@qc/contracts';
import { messages } from '@qc/i18n';
import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { RenderTimeoutError, TextTooLongError } from './browser';
import { classify } from './errors';
import { RenderRequest } from './input';
import { runPosterJob, type FileStore } from './job';
import { BusyError } from './limiter';
import { silentLogger } from './logger';
import { COLOURS } from './palette';
import { SAMPLE_SESSION, SAMPLE_SESSION_NO_URDU_VENUE, sampleRequest } from './sample';
import { POSTER_KEYS, t } from './strings';
import { TEMPLATE_IDS, TEMPLATES, templateOf } from './templates';
import { fakeRenderer } from './test/fakes';

/**
 * The renderer validates against, and answers with, the shared schemas in `@qc/contracts`
 * (1.0.0-rc.5). The only rule it adds is refusing a template key it has no template for.
 */

const TOKEN = 'test-token-not-a-secret-0123456789';

const issues = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }) =>
  r.success ? [] : [...new Set((r.error?.issues ?? []).map((i) => i.path.join('.')))].sort();

function setup() {
  const fake = fakeRenderer({ webBase: 'https://example.org' });
  const app = createApp({
    renderer: fake.renderer,
    limiter: fake.limiter,
    logger: silentLogger,
    token: TOKEN,
  });
  const post = (body: unknown) =>
    app.request('/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
    });
  return { ...fake, app, post };
}

describe('the request schema is the contract’s RendererRenderRequest', () => {
  const r = sampleRequest();
  const cases: Array<[string, unknown]> = [
    ['the sample', r],
    ['defaults left out', { ...r, fields: { title: { en: 'A', ur: 'ب' } } }],
    ['English only', sampleRequest({ language: 'en', fields: { title: { en: 'Only' } } })],
    ['all formats', sampleRequest({ formats: ['story', 'print_a4', 'print_a3', 'link_preview'] })],
    ['a missing Urdu title', sampleRequest({ fields: { title: { en: 'Only English' } } })],
    ['a title over 80', sampleRequest({ fields: { title: { en: 'x'.repeat(81), ur: 'ب' } } })],
    [
      'details over 140',
      sampleRequest({ fields: { title: { en: 'A', ur: 'ب' }, details: { en: 'x'.repeat(141) } } }),
    ],
    ['a bidi override', sampleRequest({ language: 'en', fields: { title: { en: 'a ‮b' } } })],
    ['an accent outside the palette', { ...r, fields: { ...r.fields, accent: 'pink' } }],
    ['an unknown QR target', { ...r, fields: { ...r.fields, qrTarget: 'website' } }],
    ['an unknown field', { ...r, fields: { ...r.fields, css: 'body{}' } }],
    ['an unknown top-level key', { ...r, html: '<p>' }],
    ['repeated formats', sampleRequest({ formats: ['story', 'story'] })],
    ['five formats', { ...r, formats: ['story', 'print_a4', 'print_a3', 'link_preview', 'story'] }],
    ['an unknown language', { ...r, language: 'ar' }],
    ['a malformed template key', { ...r, templateId: 'Cloud!' }],
    ['a template key over 40', { ...r, templateId: `a${'b'.repeat(40)}` }],
    ['a bad snapshot', { ...r, session: { ...r.session, sessionId: 'not-a-uuid' } }],
    ['a bad snapshot time', { ...r, session: { ...r.session, localStartTime: '25:00' } }],
    ['no session', { ...r, session: undefined }],
  ];

  for (const [name, input] of cases) {
    it(`agrees with the contract on ${name}`, () => {
      const ours = RenderRequest.safeParse(input);
      const theirs = RendererRenderRequest.safeParse(input);
      expect(ours.success).toBe(theirs.success);
      expect(issues(ours)).toEqual(issues(theirs));
      if (ours.success && theirs.success) expect(ours.data).toEqual(theirs.data);
    });
  }

  it('parses the sample sessions with the shared snapshot schema', () => {
    expect(PosterSourceSnapshot.parse(SAMPLE_SESSION)).toEqual(SAMPLE_SESSION);
    expect(PosterSourceSnapshot.parse(SAMPLE_SESSION_NO_URDU_VENUE)).toEqual(
      SAMPLE_SESSION_NO_URDU_VENUE,
    );
  });
});

describe('template keys are open in the contract; the renderer refuses keys it does not have', () => {
  for (const key of ['custom', 'final-design-2026', 'constructor', 'tostring']) {
    it(`refuses the well-formed key ${key} with the contract's error shape`, async () => {
      const input = sampleRequest({ templateId: key });
      expect(RendererRenderRequest.safeParse(input).success).toBe(true);
      const ours = RenderRequest.safeParse(input);
      expect(ours.success).toBe(false);
      expect(ours.error?.issues.map((i) => [i.path.join('.'), i.code])).toEqual([
        ['templateId', 'invalid_value'],
      ]);

      const { post, pages } = setup();
      const res = await post(input);
      expect(res.status).toBe(400);
      const body = RendererErrorResponse.parse(await res.json());
      expect(body).toEqual({
        error: {
          code: 'validation_failed',
          issues: [{ path: 'templateId', code: 'invalid_value' }],
        },
      });
      expect(posterFailureFromRenderer(res.status, body.error.code)).toBe('invalid_request');
      expect(pages.jobs).toHaveLength(0);
    });
  }

  it('looks up own keys only', () => {
    expect(templateOf('cloud')).toBe(TEMPLATES.cloud);
    expect(templateOf('constructor')).toBeUndefined();
    expect(templateOf('hasOwnProperty')).toBeUndefined();
  });

  it('a job with an unknown key fails as invalid_request, not retried', async () => {
    const { renderer } = fakeRenderer();
    const store: FileStore = { put: async () => undefined };
    const result = await runPosterJob(
      { request: sampleRequest({ templateId: 'final-design' }) },
      { renderer, store },
    );
    expect(result).toEqual({ status: 'failed', code: 'invalid_request', retryable: false });
  });
});

describe('answers are the contract’s shapes', () => {
  it('answers /render with a RendererRenderResponse, nothing added or left out', async () => {
    const { post } = setup();
    const res = await post(sampleRequest({ formats: ['story', 'print_a4', 'link_preview'] }));
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = RendererRenderResponse.parse(body);
    expect(parsed).toEqual(body);
    expect(parsed.provisional).toBe(true);
    expect(parsed.altText.en).toBeTruthy();
    expect(parsed.altText.ur).toBeTruthy();
  });

  it('answers every error with a RendererErrorResponse', async () => {
    const { app, post, pages } = setup();
    const bodies: unknown[] = [];
    bodies.push(await (await app.request('/templates')).json());
    bodies.push(
      await (
        await app.request('/nothing', { headers: { authorization: `Bearer ${TOKEN}` } })
      ).json(),
    );
    bodies.push(await (await post({ ...sampleRequest(), fields: { accent: 'pink' } })).json());
    pages.behaviour = async () => Promise.reject(new TextTooLongError(['title.ur'], ['venue']));
    bodies.push(await (await post(sampleRequest())).json());
    pages.behaviour = async () => Promise.reject(new RenderTimeoutError('slow'));
    bodies.push(await (await post(sampleRequest({ formats: ['print_a3'] }))).json());
    pages.behaviour = async () => Promise.reject(new Error('crash'));
    bodies.push(await (await post(sampleRequest({ formats: ['print_a4'] }))).json());
    for (const body of bodies) expect(RendererErrorResponse.parse(body)).toEqual(body);
    expect(bodies.map((b) => RendererErrorResponse.parse(b).error.code)).toEqual([
      'unauthenticated',
      'not_found',
      'validation_failed',
      'text_too_long',
      'render_timeout',
      'render_failed',
    ]);
  });

  it('classifies failures with the contract’s codes and retry rule', () => {
    const results = [
      classify(new ZodError([])),
      classify(new TextTooLongError(['title.en'], [])),
      classify(new BusyError()),
      classify(new RenderTimeoutError('slow')),
      classify(new Error('crash')),
    ];
    expect(results.map((r) => r.code)).toEqual([...POSTER_FAILURE_CODES]);
    for (const r of results) expect(r.retryable).toBe(POSTER_FAILURE_RETRYABLE[r.code]);
  });

  it('stores files under the contract’s posterStorageKey', async () => {
    const { renderer } = fakeRenderer();
    const keys: string[] = [];
    const store: FileStore = { put: async (key) => void keys.push(key) };
    const result = await runPosterJob(
      { request: sampleRequest({ formats: ['story', 'print_a4'] }) },
      { renderer, store },
    );
    if (result.status !== 'ready') throw new Error('expected ready');
    const rendered = await renderer.render(sampleRequest({ formats: ['story', 'print_a4'] }));
    expect(keys).toEqual(
      rendered.files.map((f) =>
        posterStorageKey(SAMPLE_SESSION.sessionId, f.cacheKey, f.contentType),
      ),
    );
  });
});

describe('the demo templates', () => {
  it('are the contract’s DEMO_POSTER_TEMPLATES, all provisional', () => {
    expect(TEMPLATE_IDS).toEqual(DEMO_POSTER_TEMPLATES.map((d) => d.key));
    for (const demo of DEMO_POSTER_TEMPLATES) {
      const template = templateOf(demo.key);
      expect(template?.id).toBe(demo.key);
      expect(template?.name).toEqual(demo.name);
      expect(template?.version).toBe(demo.version);
      expect(template?.formats).toEqual(demo.formats);
      expect(template?.provisional).toBe(true);
    }
  });

  it('are reported as provisional by /templates, with the contract’s accents', async () => {
    const { app } = setup();
    const res = await app.request('/templates', { headers: { authorization: `Bearer ${TOKEN}` } });
    const body = (await res.json()) as {
      items: Array<{ id: string; provisional: boolean; accents: string[] }>;
    };
    expect(body.items.map((i) => [i.id, i.provisional])).toEqual([
      ['cloud', true],
      ['night', true],
    ]);
    for (const item of body.items) expect(item.accents).toEqual([...POSTER_ACCENTS]);
  });

  it('have a colour for every accent in the contract', () => {
    for (const accent of POSTER_ACCENTS) expect(COLOURS[accent]).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('poster wording comes from @qc/i18n', () => {
  const ENGLISH: Record<(typeof POSTER_KEYS)[number], string> = {
    'poster.scanToRegister': 'Scan to register',
    'poster.scanToOpen': 'Scan to open in the app',
    'poster.dailyAt': 'Every day at {time}',
    'poster.onDateAt': '{date} at {time}',
    'poster.listAnd': ' and ',
    'poster.listComma': ', ',
    'poster.period.morning': 'am',
    'poster.period.noon': 'pm',
    'poster.period.evening': 'pm',
    'poster.period.night': 'pm',
    'poster.period.lateNight': 'am',
    'poster.alt': '{title}: Quran circle at {venue}, {when}',
  };
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('has every poster key in English and Urdu, with the same placeholders', () => {
    const catalogue = Object.keys(messages.en).filter((k) => k.startsWith('poster.'));
    expect(catalogue.sort()).toEqual([...POSTER_KEYS].sort());
    for (const key of POSTER_KEYS) {
      expect(messages.en[key]).toBe(ENGLISH[key]);
      expect(messages.ur[key]).toMatch(/[؀-ۿ]/);
      expect(placeholders(messages.ur[key])).toEqual(placeholders(messages.en[key]));
      expect(t('ur', key)).toBe(messages.ur[key]);
    }
  });

  it('keeps the Urdu catalogue under its review marker', () => {
    expect((messages.ur as Record<string, string>)['_meta.status']).toMatch(/review/i);
  });
});
