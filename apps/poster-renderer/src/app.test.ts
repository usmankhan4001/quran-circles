import { describe, expect, it } from 'vitest';
import { createApp, MAX_BODY_BYTES } from './app';
import { RenderTimeoutError, TextTooLongError } from './browser';
import { silentLogger } from './logger';
import { sampleRequest } from './sample';
import { fakeRenderer } from './test/fakes';

const TOKEN = 'test-token-not-a-secret-0123456789';

function setup(options: Parameters<typeof fakeRenderer>[0] = {}) {
  const fake = fakeRenderer(options);
  const app = createApp({
    renderer: fake.renderer,
    limiter: fake.limiter,
    logger: silentLogger,
    token: TOKEN,
  });
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    app.request('/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { ...fake, app, post };
}

describe('renderer HTTP interface', () => {
  it('answers /healthz without a token', async () => {
    const { app } = setup();
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, active: 0, queued: 0 });
  });

  it('refuses every other route without the right bearer token', async () => {
    const { app, post } = setup();
    expect((await app.request('/templates')).status).toBe(401);
    expect((await post(sampleRequest(), { authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await post(sampleRequest(), { authorization: '' })).status).toBe(401);
    const ok = await app.request('/templates', { headers: { authorization: `Bearer ${TOKEN}` } });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as {
      items: Array<{ id: string; provisional: boolean; formats: string[] }>;
    };
    expect(body.items.map((t) => t.id)).toEqual(['cloud', 'night']);
    expect(body.items.every((t) => t.provisional && t.formats.length === 4)).toBe(true);
  });

  it('renders and returns the files as base64 with the snapshot', async () => {
    const { post } = setup();
    const res = await post(sampleRequest({ formats: ['story', 'print_a4'] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      files: Array<{ format: string; contentType: string; base64: string; byteLength: number }>;
      sourceSnapshot: { sessionId: string };
      locale: string;
    };
    expect(body.files.map((f) => [f.format, f.contentType])).toEqual([
      ['story', 'image/png'],
      ['print_a4', 'application/pdf'],
    ]);
    expect(Buffer.from(body.files[0]?.base64 ?? '', 'base64').length).toBe(
      body.files[0]?.byteLength,
    );
    expect(body.sourceSnapshot.sessionId).toBe(sampleRequest().session.sessionId);
    expect(body.locale).toBe('en');
  });

  it('names invalid fields by path and code only, never echoing what was sent', async () => {
    const { post, pages } = setup();
    const secretish = 'Private Person 0300 1234567';
    const res = await post({
      ...sampleRequest(),
      fields: { title: { en: secretish }, accent: 'pink' },
    });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toContain('Private');
    expect(text).not.toContain('pink');
    expect(JSON.parse(text)).toEqual({
      error: {
        code: 'validation_failed',
        issues: [{ path: 'fields.accent', code: 'invalid_value' }],
      },
    });
    expect(pages.jobs).toHaveLength(0);
    expect((await post('{not json')).status).toBe(400);
  });

  it('refuses a body over the size limit', async () => {
    const { post } = setup();
    const res = await post({ ...sampleRequest(), padding: 'x'.repeat(MAX_BODY_BYTES) });
    expect(res.status).toBe(413);
  });

  it('answers 422 naming the boxes when text does not fit', async () => {
    const { post, pages } = setup();
    pages.behaviour = async () => Promise.reject(new TextTooLongError(['title.ur'], []));
    const res = await post(sampleRequest());
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: { code: 'text_too_long', fields: ['title.ur'], regions: [] },
    });
  });

  it('answers 503 with Retry-After when busy, 504 on a timeout and 500 on any other failure', async () => {
    const { post, pages } = setup({ concurrency: 1, queue: 0 });
    let release!: () => void;
    pages.behaviour = () =>
      new Promise((resolve) => (release = () => resolve({ bytes: Buffer.from('x'), blocked: [] })));
    const slow = post(sampleRequest());
    await new Promise((r) => setTimeout(r, 10));
    const busy = await post(sampleRequest({ formats: ['link_preview'] }));
    expect(busy.status).toBe(503);
    expect(busy.headers.get('retry-after')).toBe('5');
    release();
    expect((await slow).status).toBe(200);

    pages.behaviour = async () => Promise.reject(new RenderTimeoutError('slow'));
    expect((await post(sampleRequest({ formats: ['print_a3'] }))).status).toBe(504);
    pages.behaviour = async () => Promise.reject(new Error('crash'));
    const failed = await post(sampleRequest({ formats: ['print_a4'] }));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: { code: 'render_failed' } });
  });

  it('answers 404 in the same error shape', async () => {
    const { app } = setup();
    const res = await app.request('/nothing', { headers: { authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'not_found' } });
  });
});
