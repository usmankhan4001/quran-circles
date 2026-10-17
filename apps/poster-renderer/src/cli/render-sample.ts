import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POSTER_FORMATS } from '@qc/contracts';
import { BrowserPool } from '../browser';
import { classify } from '../errors';
import { MemoryCache } from '../cache';
import { POSTER_LANGUAGES, TEMPLATE_IDS } from '../input';
import { runPosterJob, type FileStore } from '../job';
import { Limiter } from '../limiter';
import { createConsoleLogger } from '../logger';
import { PosterRenderer } from '../renderer';
import { SAMPLE_SESSION, SAMPLE_SESSION_NO_URDU_VENUE, sampleRequest } from '../sample';
import { outOfDate } from '../snapshot';

/**
 * Stand-in for the api and worker endpoints (brief): renders every template in every language and
 * format from synthetic sample data, then shows the job, the cache and out-of-date detection.
 *
 *   pnpm --filter @qc/poster-renderer render:sample [out-dir]
 */
const out = process.argv[2] ?? join(tmpdir(), 'qc-poster-samples');
mkdirSync(out, { recursive: true });

const logger = createConsoleLogger();
const pool = new BrowserPool({ logger, heapMb: 128, recycleAfter: 100 });
const renderer = new PosterRenderer({
  pages: pool,
  limiter: new Limiter(2, 64),
  cache: new MemoryCache(256 * 1024 * 1024),
  timeoutMs: 60_000,
  logger,
  webBase: 'https://example.org',
});
const store: FileStore = {
  async put(key, bytes) {
    const path = join(out, 'store', key);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, bytes);
  },
};

const manifest: unknown[] = [];
try {
  // 1. Every template, language and format.
  for (const templateId of TEMPLATE_IDS) {
    for (const language of POSTER_LANGUAGES) {
      for (const format of POSTER_FORMATS) {
        try {
          const result = await renderer.render(
            sampleRequest({ templateId, language, formats: [format] }),
          );
          for (const file of result.files) writeFileSync(join(out, file.filename), file.bytes);
          manifest.push({ templateId, language, format, file: result.files[0]?.filename });
        } catch (error) {
          manifest.push({
            templateId,
            language,
            format,
            error: classify(error).code,
            fields: (error as { fields?: string[] }).fields,
          });
        }
      }
    }
  }
  // 2. Mixed text: a venue with no Urdu name, on an Urdu-first poster.
  const mixed = await renderer.render(
    sampleRequest({
      templateId: 'night',
      language: 'ur_en',
      formats: ['story', 'link_preview'],
      session: SAMPLE_SESSION_NO_URDU_VENUE,
      fields: {
        title: { en: 'Open lecture: Surah Yaseen', ur: 'خصوصی درس: سورۃ یٰسٓ' },
        accent: 'deep',
        qrTarget: 'session',
      },
    }),
  );
  for (const file of mixed.files) writeFileSync(join(out, `mixed-${file.filename}`), file.bytes);

  // 3. The job, the cache and out-of-date detection.
  const first = await runPosterJob(
    { request: sampleRequest({ formats: ['story', 'print_a4'] }) },
    { renderer, store },
  );
  const again = await runPosterJob(
    { request: sampleRequest({ formats: ['story', 'print_a4'] }) },
    { renderer, store },
  );
  const moved = {
    ...SAMPLE_SESSION,
    localStartTime: '20:00',
    sessionVersion: '2026-10-18T12:00:00.000Z',
  };
  const reasons = first.status === 'ready' ? outOfDate(first.sourceSnapshot, moved) : [];
  const regenerated = await runPosterJob(
    { request: sampleRequest({ formats: ['story', 'print_a4'], session: moved }) },
    { renderer, store },
  );
  const summary = { first, again, outOfDateReasons: reasons, regenerated };
  writeFileSync(
    join(out, 'job-summary.json'),
    JSON.stringify(summary, (k, v: unknown) => (k === 'altText' ? undefined : v), 2),
  );
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  logger.info('sample.done', { files: manifest.length, outOfDate: reasons.join(',') || 'none' });
  console.log(`Sample posters written to ${out}`);
} finally {
  await pool.close();
}
