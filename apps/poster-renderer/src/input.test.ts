import { describe, expect, it } from 'vitest';
import { posterLanguagesOf as languagesOf } from '@qc/contracts';
import { RenderRequest } from './input';
import { sampleRequest } from './sample';

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
