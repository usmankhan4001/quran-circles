import { describe, expect, it } from 'vitest';
import { TextTooLongError } from './browser';
import { runPosterJob, type FileStore } from './job';
import { SAMPLE_SESSION, sampleRequest } from './sample';
import { outOfDate } from './snapshot';
import { fakeRenderer } from './test/fakes';

class MemoryStore implements FileStore {
  readonly files = new Map<string, { bytes: Buffer; contentType: string }>();
  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    this.files.set(key, { bytes, contentType });
  }
}

describe('runPosterJob', () => {
  it('stores each format under a content-addressed key and returns what the API stores', async () => {
    const { renderer } = fakeRenderer({ webBase: 'https://example.org' });
    const store = new MemoryStore();
    const result = await runPosterJob(
      { request: sampleRequest({ formats: ['story', 'print_a4'] }) },
      { renderer, store },
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.files.map((f) => f.format)).toEqual(['story', 'print_a4']);
    for (const file of result.files) {
      expect(file.storageKey).toMatch(
        new RegExp(`^posters/${SAMPLE_SESSION.sessionId}/[0-9a-f]{64}\\.(png|pdf)$`),
      );
      expect(store.files.get(file.storageKey)?.contentType).toBe(file.contentType);
    }
    expect(result.sourceSnapshot).toEqual(SAMPLE_SESSION);
    expect(result.locale).toBe('en');
  });

  it('repeats without rendering again and lands on the same keys', async () => {
    const { renderer, pages } = fakeRenderer();
    const store = new MemoryStore();
    const a = await runPosterJob({ request: sampleRequest() }, { renderer, store });
    const b = await runPosterJob({ request: sampleRequest() }, { renderer, store });
    expect(pages.jobs).toHaveLength(1);
    expect(
      a.status === 'ready' &&
        b.status === 'ready' &&
        a.files[0]?.storageKey === b.files[0]?.storageKey,
    ).toBe(true);
    expect(store.files.size).toBe(1);
  });

  it('flags a poster made before a time change, and regenerates it under a new key', async () => {
    const { renderer } = fakeRenderer();
    const store = new MemoryStore();
    const before = await runPosterJob({ request: sampleRequest() }, { renderer, store });
    if (before.status !== 'ready') throw new Error('expected ready');
    const changed = {
      ...SAMPLE_SESSION,
      localStartTime: '20:00',
      sessionVersion: '2026-10-18T12:00:00.000Z',
    };
    expect(outOfDate(before.sourceSnapshot, changed)).toEqual(['time']);
    const after = await runPosterJob(
      { request: sampleRequest({ session: changed }) },
      { renderer, store },
    );
    if (after.status !== 'ready') throw new Error('expected ready');
    expect(after.files[0]?.storageKey).not.toBe(before.files[0]?.storageKey);
    expect(outOfDate(after.sourceSnapshot, changed)).toEqual([]);
    expect(store.files.size).toBe(2);
  });

  it('reports failures with a code and whether a retry may help', async () => {
    const { renderer, pages } = fakeRenderer();
    const store = new MemoryStore();
    pages.behaviour = async () => Promise.reject(new TextTooLongError(['title.en'], []));
    expect(await runPosterJob({ request: sampleRequest() }, { renderer, store })).toEqual({
      status: 'failed',
      code: 'text_too_long',
      retryable: false,
    });
    expect(
      await runPosterJob(
        { request: { ...sampleRequest(), templateId: 'nope' as never } },
        { renderer, store },
      ),
    ).toEqual({
      status: 'failed',
      code: 'invalid_request',
      retryable: false,
    });
    pages.behaviour = async () => Promise.reject(new Error('browser crashed'));
    expect(
      await runPosterJob(
        { request: sampleRequest({ formats: ['print_a3'] }) },
        { renderer, store },
      ),
    ).toEqual({
      status: 'failed',
      code: 'render_failed',
      retryable: true,
    });
    expect(store.files.size).toBe(0);
  });
});
