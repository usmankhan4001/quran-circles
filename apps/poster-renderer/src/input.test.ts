import { describe, expect, it } from 'vitest';
import { posterLanguagesOf as languagesOf } from '@qc/contracts';
import { RenderRequest } from './input';
import { buildView } from './renderer';
import { SAMPLE_SESSION, sampleRequest } from './sample';

const paths = (input: unknown): string[] => {
  const r = RenderRequest.safeParse(input);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join('.')))];
};

describe('RenderRequest', () => {
  it('accepts the sample and fills the defaults', () => {
    const parsed = RenderRequest.parse({
      ...sampleRequest(),
      fields: { title: { en: 'A', ur: 'ب' } },
    });
    expect(parsed.fields.accent).toBe('tanzeem');
    expect(parsed.fields.qrTarget).toBe('register');
  });

  it('needs a title in every language the poster shows', () => {
    expect(
      paths(sampleRequest({ language: 'en_ur', fields: { title: { en: 'Only English' } } })),
    ).toEqual(['fields.title.ur']);
    expect(
      paths(sampleRequest({ language: 'ur', fields: { title: { en: 'Only English' } } })),
    ).toEqual(['fields.title.ur']);
    expect(
      paths(sampleRequest({ language: 'en', fields: { title: { en: 'Only English' } } })),
    ).toEqual([]);
  });

  it('refuses colours outside the palette, unknown fields and unknown templates', () => {
    expect(
      paths(sampleRequest({ fields: { title: { en: 'A', ur: 'ب' }, accent: '#ff0000' as never } })),
    ).toEqual(['fields.accent']);
    expect(
      paths({ ...sampleRequest(), fields: { title: { en: 'A', ur: 'ب' }, css: 'body{}' } }),
    ).toEqual(['fields']);
    expect(paths({ ...sampleRequest(), html: '<p>' })).toEqual(['']);
    expect(paths(sampleRequest({ templateId: 'custom' as never }))).toEqual(['templateId']);
  });

  it('refuses repeated formats and unknown formats', () => {
    expect(paths(sampleRequest({ formats: ['story', 'story'] }))).toEqual(['formats']);
    expect(paths(sampleRequest({ formats: ['square' as never] }))).toEqual(['formats.0']);
    expect(paths(sampleRequest({ formats: [] }))).toEqual(['formats']);
  });

  it('refuses text that is too long, empty, or carries control or bidi override characters', () => {
    const title = (en: string) => sampleRequest({ language: 'en', fields: { title: { en } } });
    expect(paths(title('x'.repeat(81)))).toEqual(['fields.title.en']);
    expect(paths(title('   '))).toEqual(['fields.title.en']);
    expect(paths(title('Free ‮eerf'))).toEqual(['fields.title.en']);
    expect(paths(title('Line\u0007bell'))).toEqual(['fields.title.en']);
    expect(paths(title('Dars ⁦isolate⁩'))).toEqual(['fields.title.en']);
  });

  it('refuses the same characters as every other name (SEC-08), and keeps real Urdu text', () => {
    const title = (ur: string) => sampleRequest({ language: 'ur', fields: { title: { ur } } });
    expect(paths(title('ہفتہ وار درسِ قرآن؛ «تفسیر» اور ترجمہ؟'))).toEqual([]);
    expect(paths(title('ناظرہ\u200cقرآن ۱–۲۰'))).toEqual([]);
    expect(paths(title('درس\u200dقرآن'))).toEqual(['fields.title.ur']);
    expect(paths(title('درس\u200fقرآن'))).toEqual(['fields.title.ur']);
    expect(paths(title('درس\u061cقرآن'))).toEqual(['fields.title.ur']);
    expect(paths(title('درس\u0085قرآن'))).toEqual(['fields.title.ur']);
    expect(paths(title('One\nTwo'))).toEqual(['fields.title.ur']);
  });

  it('refuses bidi controls in the venue and area names of the snapshot', () => {
    const r = sampleRequest();
    const venue = SAMPLE_SESSION.venue;
    const withVenue = (name: { en: string; ur: string | null }, area: typeof venue.area) => ({
      ...r,
      session: { ...SAMPLE_SESSION, venue: { ...venue, name, area } },
    });
    expect(paths(withVenue({ en: 'Masjid \u202eroon', ur: null }, null))).toEqual([
      'session.venue.name.en',
    ]);
    expect(paths(withVenue(venue.name, { en: 'Block 7', ur: 'بلاک\u2067 7' }))).toEqual([
      'session.venue.area.ur',
    ]);
  });

  it('strips those characters again before drawing, as a second guard', () => {
    const checked = RenderRequest.parse(sampleRequest({ language: 'en_ur' }));
    // Built by hand, past the contract check, as text from another path might arrive.
    const unchecked: RenderRequest = {
      ...checked,
      fields: {
        ...checked.fields,
        title: { en: 'Free \u202eeerf', ur: 'درس\u2066 قرآن\u2069' },
        details: { en: 'Line\u0007bell', ur: 'ناظرہ\u200cقرآن' },
      },
      session: {
        ...checked.session,
        venue: {
          ...checked.session.venue,
          name: { en: 'Masjid\u200b Noor', ur: null },
          area: { en: 'Block\u200f 7', ur: null },
        },
      },
    };
    const [en, ur] = buildView(unchecked, 'story').blocks;
    expect(en).toMatchObject({
      title: 'Free eerf',
      details: 'Linebell',
      venue: 'Masjid Noor',
      area: 'Block 7',
    });
    expect(ur).toMatchObject({ title: 'درس قرآن', details: 'ناظرہ\u200cقرآن' });
  });

  it('refuses a snapshot that is not a session', () => {
    const r = sampleRequest();
    expect(paths({ ...r, session: { ...r.session, sessionId: 'not-a-uuid' } })).toEqual([
      'session.sessionId',
    ]);
    expect(paths({ ...r, session: { ...r.session, localStartTime: '25:00' } })).toEqual([
      'session.localStartTime',
    ]);
  });

  it('orders languages with the leading one first', () => {
    expect(languagesOf('en')).toEqual(['en']);
    expect(languagesOf('ur')).toEqual(['ur']);
    expect(languagesOf('en_ur')).toEqual(['en', 'ur']);
    expect(languagesOf('ur_en')).toEqual(['ur', 'en']);
  });
});
