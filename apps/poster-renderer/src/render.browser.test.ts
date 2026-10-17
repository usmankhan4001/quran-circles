import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  POSTER_FORMATS,
  POSTER_LANGUAGES,
  type PosterFormat,
  type PosterLanguage,
} from '@qc/contracts';
import { BrowserPool, TextTooLongError } from './browser';
import { MemoryCache } from './cache';
import { FORMAT_SPECS } from './formats';
import { RenderRequest } from './input';
import { Limiter } from './limiter';
import { silentLogger } from './logger';
import { makeQr, QUIET_ZONE } from './qr';
import { buildView, PosterRenderer } from './renderer';
import { SAMPLE_SESSION, SAMPLE_SESSION_NO_URDU_VENUE, sampleRequest } from './sample';
import { TEMPLATE_IDS, TEMPLATES, type TemplateId } from './templates';
import { Inspector, pdfFacts, pngSize } from './test/inspect';

/**
 * Real renders in headless Chromium: every template, language and format; the fonts Chromium
 * actually used; the QR code in the exported image; and text that does not fit.
 */
const WEB = 'https://example.org';
let pool: BrowserPool;
let renderer: PosterRenderer;
let inspector: Inspector;

beforeAll(async () => {
  pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 50 });
  renderer = new PosterRenderer({
    pages: pool,
    limiter: new Limiter(2, 64),
    cache: new MemoryCache(0),
    timeoutMs: 30_000,
    logger: silentLogger,
    webBase: WEB,
  });
  inspector = await Inspector.start();
});
afterAll(async () => {
  await pool.close();
  await inspector.close();
});

const PDF_POINTS: Partial<Record<PosterFormat, [number, number]>> = {
  print_a4: [595, 842],
  print_a3: [842, 1191],
};

describe('every template, language and format renders', () => {
  for (const templateId of TEMPLATE_IDS) {
    for (const language of POSTER_LANGUAGES) {
      it(`${templateId} ${language}: story, A4, A3 and link preview`, async () => {
        const result = await renderer.render(
          sampleRequest({ templateId, language, formats: [...POSTER_FORMATS] }),
        );
        expect(result.files.map((f) => f.format)).toEqual([...POSTER_FORMATS]);
        for (const file of result.files) {
          const spec = FORMAT_SPECS[file.format];
          if (spec.output === 'png') {
            expect(file.contentType).toBe('image/png');
            expect(pngSize(file.bytes)).toEqual({ width: spec.width, height: spec.height });
          } else {
            expect(file.contentType).toBe('application/pdf');
            const facts = pdfFacts(file.bytes);
            expect(facts.pages).toBe(1);
            const [w, h] = PDF_POINTS[file.format] ?? [0, 0];
            expect(facts.mediaBox[0]).toBeCloseTo(w, -1);
            expect(facts.mediaBox[1]).toBeCloseTo(h, -1);
            expect(facts.fonts.some((f) => f.startsWith('Figtree'))).toBe(true);
            if (language !== 'ur') expect(facts.fonts).toContain('Figtree-Bold');
            if (language !== 'en') expect(facts.fonts).toContain('MehrNastaliqWeb');
            expect(
              facts.fonts.every((f) => f.startsWith('Figtree') || f === 'MehrNastaliqWeb'),
            ).toBe(true);
          }
        }
      });
    }
  }

  it('renders mixed text: an Urdu poster of a venue that has only an English name', async () => {
    const result = await renderer.render(
      sampleRequest({
        templateId: 'night',
        language: 'ur',
        session: SAMPLE_SESSION_NO_URDU_VENUE,
        formats: ['story', 'print_a4', 'link_preview'],
      }),
    );
    expect(result.files).toHaveLength(3);
    expect(result.altText.ur).toContain('Sample Community Hall');
  });
});

describe('Urdu is drawn in Mehr Nastaliq, Latin and digits in Figtree', () => {
  const view = (
    templateId: TemplateId,
    language: PosterLanguage,
    format: PosterFormat,
    session = SAMPLE_SESSION,
  ) =>
    TEMPLATES[templateId].build(
      buildView(
        RenderRequest.parse(sampleRequest({ templateId, language, formats: [format], session })),
        format,
        WEB,
      ),
    );

  for (const templateId of TEMPLATE_IDS) {
    it(`${templateId}: no system font is used anywhere`, async () => {
      const spec = FORMAT_SPECS.story;
      await inspector.layout(
        view(templateId, 'ur_en', 'story'),
        spec.width,
        spec.height,
        spec.unit,
      );
      const urdu = await inspector.fontsUsed('[lang=ur][data-fit] > bdi');
      expect(Object.keys(urdu).sort()).toEqual(['Figtree', 'Mehr Nastaliq Web']);
      expect(urdu['Mehr Nastaliq Web']).toBeGreaterThan(20);
      const latinInUrdu = await inspector.fontsUsed('[lang=ur] bdi.lat');
      expect(Object.keys(latinInUrdu)).toEqual(['Figtree']);
      const english = await inspector.fontsUsed('[lang=en][data-fit] > bdi');
      expect(Object.keys(english)).toEqual(['Figtree']);
    });
  }

  it('sets an English venue name inside Urdu text in Figtree', async () => {
    const spec = FORMAT_SPECS.story;
    await inspector.layout(
      view('cloud', 'ur', 'story', SAMPLE_SESSION_NO_URDU_VENUE),
      spec.width,
      spec.height,
      spec.unit,
    );
    expect(Object.keys(await inspector.fontsUsed('[data-fit="venue.ur"] bdi.lat'))).toEqual([
      'Figtree',
    ]);
  });
});

describe('the QR code in the exported image', () => {
  for (const templateId of TEMPLATE_IDS) {
    it(`${templateId} story: every module matches the deep link's code, with a quiet zone`, async () => {
      const request = sampleRequest({ templateId, language: 'ur_en', formats: ['story'] });
      const [file] = (await renderer.render(request)).files;
      const spec = FORMAT_SPECS.story;
      const html = TEMPLATES[templateId].build(
        buildView(RenderRequest.parse(request), 'story', WEB),
      );
      await inspector.layout(html, spec.width, spec.height, spec.unit);
      const box = await inspector.rect('.qr svg');
      const qr = makeQr(`${WEB}/register/${SAMPLE_SESSION.sessionId}`);
      const n = qr.matrix.length;
      const module = box.width / (n + 2 * QUIET_ZONE);
      expect(box.width).toBeGreaterThanOrEqual(280); // poster direction: at least 280 px on a story
      expect(module).toBeGreaterThanOrEqual(5);
      const points: Array<[number, number]> = [];
      for (let r = -QUIET_ZONE; r < n + QUIET_ZONE; r++) {
        for (let c = -QUIET_ZONE; c < n + QUIET_ZONE; c++) {
          points.push([
            box.x + (c + QUIET_ZONE + 0.5) * module,
            box.y + (r + QUIET_ZONE + 0.5) * module,
          ]);
        }
      }
      const rgb = await inspector.pixels(file!.bytes, points);
      let i = 0;
      for (let r = -QUIET_ZONE; r < n + QUIET_ZONE; r++) {
        for (let c = -QUIET_ZONE; c < n + QUIET_ZONE; c++) {
          const [red = 0, green = 0, blue = 0] = rgb[i++] ?? [];
          const dark = (red + green + blue) / 3 < 128;
          const expected =
            r >= 0 && c >= 0 && r < n && c < n ? (qr.matrix[r]?.[c] ?? false) : false;
          expect(dark, `module ${r},${c}`).toBe(expected);
        }
      }
    });
  }

  it('is at least 28 mm square on A4 and A3', async () => {
    for (const format of ['print_a4', 'print_a3'] as const) {
      for (const templateId of TEMPLATE_IDS) {
        const spec = FORMAT_SPECS[format];
        const html = TEMPLATES[templateId].build(
          buildView(
            RenderRequest.parse(sampleRequest({ templateId, formats: [format] })),
            format,
            WEB,
          ),
        );
        await inspector.layout(html, spec.width, spec.height, spec.unit);
        const mm = ((await inspector.rect('.qr svg')).width * 25.4) / 96;
        expect(mm, `${templateId} ${format}`).toBeGreaterThanOrEqual(28);
      }
    }
  });
});

describe('text that does not fit', () => {
  it('shrinks a long title rather than clipping it', async () => {
    const title = 'A Very Long Title For A Quran Circle That Wraps';
    const result = await renderer.render(
      sampleRequest({ language: 'en', fields: { title: { en: title } }, formats: ['story'] }),
    );
    expect(result.files).toHaveLength(1);
    const spec = FORMAT_SPECS.story;
    const html = TEMPLATES.cloud.build(
      buildView(
        RenderRequest.parse(sampleRequest({ language: 'en', fields: { title: { en: title } } })),
        'story',
      ),
    );
    await inspector.layout(html, spec.width, spec.height, spec.unit);
    const size = await inspector.fontSize('[data-fit="title.en"]');
    expect(size).toBeLessThan(104);
    expect(size).toBeGreaterThanOrEqual(72);
  });

  it('refuses a word too wide for the poster and names the box', async () => {
    const request = sampleRequest({
      language: 'en',
      fields: { title: { en: 'W'.repeat(40) } },
      formats: ['story'],
    });
    await expect(renderer.render(request)).rejects.toMatchObject({
      name: 'TextTooLongError',
      fields: ['title.en'],
    });
  });

  it('refuses Urdu text that cannot fit in its lines', async () => {
    const long =
      'ہفتہ وار درسِ قرآن اور ترجمہ و تفسیر کی خصوصی نشست برائے نوجوان، خواتین اور بزرگ حضرات';
    const request = sampleRequest({
      templateId: 'night',
      language: 'ur',
      fields: { title: { ur: long.slice(0, 80) } },
      formats: ['link_preview'],
    });
    const error = await renderer.render(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TextTooLongError);
    expect((error as TextTooLongError).fields).toContain('title.ur');
  });
});
