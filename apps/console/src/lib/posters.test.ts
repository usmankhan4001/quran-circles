import { describe, expect, it } from 'vitest';
import {
  POSTER_FAILURE_CODES,
  POSTER_FORMATS,
  POSTER_LANGUAGES,
  type Poster,
  type PosterTemplate,
} from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import { messages } from '@qc/i18n';
import {
  OUT_OF_DATE_KEYS,
  POSTER_FAILURE_KEYS,
  POSTER_FORMAT_HINT_KEYS,
  POSTER_FORMAT_KEYS,
  POSTER_LANGUAGE_KEYS,
  beingReplaced,
  buildPosterCreate,
  failureAction,
  fieldOfPath,
  formFromPoster,
  formatLocalTime,
  hasQueued,
  initialPosterForm,
  mergePosters,
  outOfDateKind,
  posterActions,
  posterFileName,
  posterMime,
  serverPosterErrors,
  withTemplate,
  type PosterForm,
} from './posters';

/** The fixture posters as the list shows them (out of date worked out by the mock's rule). */
const asListed = (
  p: (typeof fx.posters)[number],
  outOfDate: Poster['outOfDate'] = null,
): Poster => ({
  ...p,
  outOfDate,
});
const [storyReady, a4OutOfDate, failedTooLong, lahoreLink, queuedAgain] = fx.posters.map((p) =>
  asListed(p),
);
const a4 = { ...a4OutOfDate!, outOfDate: { reasons: ['time' as const] } };
const templates = fx.posterTemplates;
const cloud = templates[0]!;

const form = (patch: Partial<PosterForm> = {}): PosterForm => ({
  templateKey: 'cloud',
  language: 'en_ur',
  formats: ['story'],
  titleEn: 'Taraweeh with Dora',
  titleUr: 'تراویح مع دورہ',
  detailsEn: '',
  detailsUr: '',
  accent: 'tanzeem',
  qrTarget: 'register',
  ...patch,
});

describe('wording', () => {
  const en = messages.en as Record<string, string>;
  const ur = messages.ur as Record<string, string>;
  const all = [
    ...Object.values(POSTER_FAILURE_KEYS),
    ...Object.values(POSTER_FORMAT_KEYS),
    ...Object.values(POSTER_FORMAT_HINT_KEYS),
    ...Object.values(POSTER_LANGUAGE_KEYS),
    ...Object.values(OUT_OF_DATE_KEYS),
  ];

  it('has a plain message for every failure code, format and language, in English and Urdu', () => {
    expect(Object.keys(POSTER_FAILURE_KEYS).sort()).toEqual([...POSTER_FAILURE_CODES].sort());
    expect(Object.keys(POSTER_FORMAT_KEYS).sort()).toEqual([...POSTER_FORMATS].sort());
    expect(Object.keys(POSTER_LANGUAGE_KEYS).sort()).toEqual([...POSTER_LANGUAGES].sort());
    for (const key of all) {
      expect(en[key], key).toBeTruthy();
      expect(ur[key], key).toBeTruthy();
    }
  });

  it('tells the person to shorten the title when the text did not fit', () => {
    expect(en[POSTER_FAILURE_KEYS.text_too_long]).toMatch(/Shorten the title/);
  });
});

describe('out of date', () => {
  it('names the time, the venue or both', () => {
    expect(outOfDateKind(['time'])).toBe('time');
    expect(outOfDateKind(['venue'])).toBe('venue');
    expect(outOfDateKind(['venue', 'time'])).toBe('both');
    expect(outOfDateKind([])).toBeNull();
  });
});

describe('what a poster offers', () => {
  const replaced = beingReplaced([storyReady!, a4, failedTooLong!, queuedAgain!]);

  it('knows which poster a queued regeneration replaces', () => {
    expect([...replaced]).toEqual([a4.id]);
  });

  it('retries the failures the worker retries, and asks for changes for the others', () => {
    expect(failureAction('busy')).toBe('retry');
    expect(failureAction('render_timeout')).toBe('retry');
    expect(failureAction('render_failed')).toBe('retry');
    expect(failureAction('text_too_long')).toBe('edit');
    expect(failureAction('invalid_request')).toBe('edit');
    expect(failureAction(null)).toBe('edit');
  });

  it('downloads a ready poster and regenerates one that is out of date', () => {
    expect(posterActions(storyReady!, true, new Set())).toEqual({
      download: true,
      regenerate: false,
      edit: false,
    });
    expect(posterActions(a4, true, new Set())).toEqual({
      download: true,
      regenerate: true,
      edit: false,
    });
  });

  it('does not regenerate a poster that is already being made again', () => {
    expect(posterActions(a4, true, replaced).regenerate).toBe(false);
  });

  it('offers a change for text that did not fit, and a retry for a busy renderer', () => {
    expect(posterActions(failedTooLong!, true, new Set())).toEqual({
      download: false,
      regenerate: false,
      edit: true,
    });
    const busy = { ...failedTooLong!, failureCode: 'busy' as const };
    expect(posterActions(busy, true, new Set())).toEqual({
      download: false,
      regenerate: true,
      edit: false,
    });
  });

  it('offers nothing for a queued poster', () => {
    expect(posterActions(queuedAgain!, true, new Set())).toEqual({
      download: false,
      regenerate: false,
      edit: false,
    });
  });

  it('only downloads when the person may read but not make posters', () => {
    expect(posterActions(a4, false, new Set())).toEqual({
      download: true,
      regenerate: false,
      edit: false,
    });
    expect(posterActions(failedTooLong!, false, new Set()).edit).toBe(false);
  });
});

describe('the list', () => {
  it('adds posters the list does not have yet, newest first, without repeats', () => {
    const fresh = { ...queuedAgain!, id: fx.fixtureId('poster', 950), createdAt: fx.FIXTURE_NOW };
    const merged = mergePosters([storyReady!, lahoreLink!], [fresh, storyReady!]);
    expect(merged.map((p) => p.id)).toEqual([fresh.id, storyReady!.id, lahoreLink!.id]);
  });

  it('knows when something is still being made', () => {
    expect(hasQueued([storyReady!])).toBe(false);
    expect(hasQueued([storyReady!, queuedAgain!])).toBe(true);
  });

  it('names files by template, format and language only, as PNG or PDF', () => {
    expect(posterFileName(storyReady!)).toBe('poster-cloud-story-en_ur.png');
    expect(posterFileName(a4)).toBe('poster-cloud-print_a4-en_ur.pdf');
    expect(posterMime('story')).toBe('image/png');
    expect(posterMime('link_preview')).toBe('image/png');
    expect(posterMime('print_a3')).toBe('application/pdf');
  });

  it('writes the session time the way people read it', () => {
    expect(formatLocalTime('21:30', 'en')).toBe('9:30 pm');
    expect(formatLocalTime('07:05', 'en')).toBe('7:05 am');
    expect(formatLocalTime('21:30', 'ur')).toMatch(/9:30/);
  });
});

describe('the form', () => {
  it('starts with the first template, both languages, story and A4, and the session title', () => {
    const f = initialPosterForm(templates, { en: 'Taraweeh with Dora', ur: 'تراویح مع دورہ' });
    expect(f).toMatchObject({
      templateKey: 'cloud',
      language: 'en_ur',
      formats: ['story', 'print_a4'],
      titleEn: 'Taraweeh with Dora',
      titleUr: 'تراویح مع دورہ',
      accent: 'tanzeem',
      qrTarget: 'register',
    });
  });

  it('leaves a session title that would not fit for the person to write', () => {
    const f = initialPosterForm(templates, { en: 'x'.repeat(81), ur: null });
    expect(f.titleEn).toBe('');
    expect(f.titleUr).toBe('');
  });

  it('keeps only the formats a template offers', () => {
    const storyOnly: PosterTemplate = { ...cloud, key: 'tall', formats: ['story'] };
    expect(withTemplate(form({ formats: ['story', 'print_a4'] }), storyOnly).formats).toEqual([
      'story',
    ]);
  });

  it('puts a failed poster back in the form', () => {
    expect(formFromPoster(failedTooLong!)).toEqual({
      templateKey: 'night',
      language: 'ur',
      formats: ['story'],
      titleEn: '',
      titleUr: 'تراویح مع دورہ',
      detailsEn: '',
      detailsUr: '',
      accent: 'night',
      qrTarget: 'session',
    });
  });

  it('sends the template, language, formats and fields, and never a date, time or venue', () => {
    const { body, errors } = buildPosterCreate(
      form({ formats: ['story', 'print_a4'], detailsEn: ' Sisters upstairs ' }),
      cloud,
    );
    expect(errors).toEqual({});
    expect(body).toEqual({
      templateKey: 'cloud',
      language: 'en_ur',
      formats: ['story', 'print_a4'],
      fields: {
        title: { en: 'Taraweeh with Dora', ur: 'تراویح مع دورہ' },
        details: { en: 'Sisters upstairs' },
        accent: 'tanzeem',
        qrTarget: 'register',
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/time|venue|date|startsOn/i);
  });

  it('sends only the languages the poster shows', () => {
    const { body } = buildPosterCreate(form({ language: 'en', detailsUr: 'نیچے' }), cloud);
    expect(body?.fields.title).toEqual({ en: 'Taraweeh with Dora' });
    expect(body?.fields.details).toBeUndefined();
  });

  it('asks for a title in every language the poster shows', () => {
    expect(buildPosterCreate(form({ titleUr: '  ' }), cloud)).toEqual({
      body: null,
      errors: { titleUr: 'required' },
    });
    expect(buildPosterCreate(form({ language: 'ur_en', titleEn: '' }), cloud).errors).toEqual({
      titleEn: 'required',
    });
    // Urdu only: the English title is not asked for.
    expect(buildPosterCreate(form({ language: 'ur', titleEn: '' }), cloud).errors).toEqual({});
  });

  it('refuses a title or details that are too long, and hidden control characters', () => {
    expect(buildPosterCreate(form({ titleEn: 'x'.repeat(81) }), cloud).errors).toEqual({
      titleEn: 'tooLong',
    });
    expect(buildPosterCreate(form({ detailsUr: 'ل'.repeat(141) }), cloud).errors).toEqual({
      detailsUr: 'tooLong',
    });
    expect(buildPosterCreate(form({ titleEn: 'Dora ‮ night' }), cloud).errors).toEqual({
      titleEn: 'invalid',
    });
  });

  it('asks for at least one format the template offers', () => {
    expect(buildPosterCreate(form({ formats: [] }), cloud).errors).toEqual({
      formats: 'required',
    });
    const storyOnly: PosterTemplate = { ...cloud, formats: ['story'] };
    expect(buildPosterCreate(form({ formats: ['print_a3'] }), storyOnly).errors).toEqual({
      formats: 'notOffered',
    });
  });

  it('asks for a template', () => {
    expect(buildPosterCreate(form({ templateKey: '' }), undefined).errors.template).toBe(
      'required',
    );
  });

  it('puts the server issues on the same fields', () => {
    expect(fieldOfPath('fields.title.ur')).toBe('titleUr');
    expect(fieldOfPath('formats.1')).toBe('formats');
    expect(fieldOfPath('somewhere.else')).toBeNull();
    expect(
      serverPosterErrors(
        [
          { path: 'fields.title.ur', code: 'custom' },
          { path: 'formats', code: 'invalid_value' },
          { path: 'fields.details.en', code: 'too_big' },
        ],
        form({ titleUr: '', detailsEn: 'long' }),
      ),
    ).toEqual({ titleUr: 'required', formats: 'notOffered', detailsEn: 'tooLong' });
  });
});
