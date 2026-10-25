import { expect, test } from '@playwright/test';
import type { ApiClient, Poster, PosterCreateInput } from '@qc/contracts';
import { bootstrapNationalAdmin } from '../../support/people';
import { SEED } from '../../support/seed';
import { stack } from '../../support/env';
import { eventually } from '../../support/wait';

/**
 * The poster maker end to end: a staff request goes to the API, the worker hands it to the real
 * renderer (headless Chromium) and the finished files are downloaded again. English and Urdu.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function ready(api: ApiClient, sessionId: string, ids: string[]): Promise<Poster[]> {
  return eventually(
    'the posters to be made',
    async () => {
      const { items } = await api.adminPosters.list({ params: { sessionId } });
      const mine = items.filter((p) => ids.includes(p.id));
      if (mine.some((p) => p.status === 'failed')) {
        throw new Error(`a poster failed: ${mine.map((p) => p.failureCode).join(', ')}`);
      }
      return mine.length === ids.length && mine.every((p) => p.status === 'ready') ? mine : null;
    },
    90_000,
  );
}

test.describe('poster maker', () => {
  test.beforeEach(() => {
    const { rendererError } = stack();
    if (rendererError) throw new Error(`The poster renderer did not start: ${rendererError}`);
  });

  test('English and Urdu posters are drawn and downloadable as a picture and a print PDF', async () => {
    const admin = await bootstrapNationalAdmin();
    const sessionId = SEED.sessionTaraweehNoor;
    const { items: templates } = await admin.api.adminPosters.templates();
    expect(templates.map((t) => t.key)).toEqual(expect.arrayContaining(['cloud', 'night']));

    const request = (language: PosterCreateInput['language']): PosterCreateInput => ({
      templateKey: 'cloud',
      language,
      formats: ['story', 'print_a4'],
      fields: {
        title: { en: 'E2E Dars-e-Quran', ur: 'ہفتہ وار درسِ قرآن' },
        accent: 'tanzeem',
        qrTarget: 'register',
      },
    });
    for (const language of ['en', 'ur', 'en_ur'] as const) {
      const made = await admin.api.adminPosters.create({
        params: { sessionId },
        body: request(language),
      });
      const posters = await ready(
        admin.api,
        sessionId,
        made.items.map((p) => p.id),
      );
      expect(posters).toHaveLength(2);
      for (const poster of posters) {
        expect(poster.altText).not.toBeNull();
        const bytes = Buffer.from(
          await admin.api.adminPosters.file({ params: { posterId: poster.id } }),
        );
        if (poster.format === 'print_a4') {
          expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
          // Urdu is set in Mehr Nastaliq, embedded in the file; English-only posters do not use it.
          expect(bytes.includes('MehrNastaliqWeb')).toBe(language !== 'en');
        } else {
          expect(bytes.subarray(0, 8).equals(PNG)).toBe(true);
          // IHDR: width and height of the story size.
          expect(bytes.readUInt32BE(16)).toBe(1080);
          expect(bytes.readUInt32BE(20)).toBe(1920);
        }
        expect(bytes.length).toBeGreaterThan(5_000);
      }
    }
  });
});
