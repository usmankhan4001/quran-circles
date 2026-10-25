import { describe, expect, it } from 'vitest';
import { POSTER_FORMATS, POSTER_LANGUAGES } from '@qc/contracts';
import { RenderRequest } from '../input';
import { buildView } from '../renderer';
import { sampleRequest } from '../sample';
import { CSP, richText } from './layout';
import { TEMPLATES } from '.';

describe('richText', () => {
  it('escapes markup', () => {
    expect(richText('<img src=x onerror=alert(1)>', 'en')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(richText('"quoted" & \'single\'', 'en')).toBe(
      '&quot;quoted&quot; &amp; &#39;single&#39;',
    );
  });

  it('isolates Latin runs and digits inside Urdu (decision 0012, rule 1)', () => {
    expect(richText('مقام: Sample Masjid، بلاک 7', 'ur')).toBe(
      'مقام: <bdi dir="ltr" class="lat">Sample Masjid</bdi>، بلاک <bdi dir="ltr" class="lat">7</bdi>',
    );
    expect(richText('رات 9:30 pm بجے', 'ur')).toContain('<bdi dir="ltr" class="lat">9:30 pm</bdi>');
  });

  it('isolates Urdu runs inside English in the Urdu stack', () => {
    expect(richText('Weekly ہفتہ وار درس class', 'en')).toBe(
      'Weekly <bdi dir="rtl" class="ur-in" lang="ur">ہفتہ وار درس</bdi> class',
    );
  });

  it('escapes inside isolated runs too', () => {
    expect(richText('<b>Sample</b> مسجد', 'ur')).toBe(
      '&lt;<bdi dir="ltr" class="lat">b</bdi>&gt;<bdi dir="ltr" class="lat">Sample</bdi>&lt;/<bdi dir="ltr" class="lat">b</bdi>&gt; مسجد',
    );
  });
});

describe('locked templates', () => {
  for (const template of Object.values(TEMPLATES)) {
    for (const format of POSTER_FORMATS) {
      for (const language of POSTER_LANGUAGES) {
        it(`${template.id} ${format} ${language}: self-contained HTML with a strict CSP`, () => {
          const request = RenderRequest.parse(
            sampleRequest({ templateId: template.id as 'cloud', language, formats: [format] }),
          );
          const html = template.build(buildView(request, format, 'https://example.org'));
          expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`);
          expect(html).not.toMatch(/<script|<link|<iframe|<object|<embed|@import|javascript:/i);
          expect(html).not.toMatch(/(src|href)\s*=/i);
          // Every url() is an embedded font or embedded art.
          for (const m of html.matchAll(/url\(([^)]*)\)/g))
            expect(/^data:(font\/ttf|image\/jpeg);base64,/.test(m[1] ?? '')).toBe(true);
          // The only web address on the page is the printed host, never a fetchable reference.
          expect(
            html.replace(/data:(font\/ttf|image\/jpeg);base64,[A-Za-z0-9+/=]+/g, ''),
          ).not.toMatch(/https?:\/\//);
          expect(html).toContain('data-fit="title.');
          expect(html.includes('<div class="qr">')).toBe(format !== 'link_preview');
        });
      }
    }
  }

  it('escapes a hostile title and never lets it become markup', () => {
    const request = RenderRequest.parse(
      sampleRequest({
        language: 'en',
        fields: { title: { en: '<img src="http://127.0.0.1/x"><style>*{}</style>' } },
      }),
    );
    const html = TEMPLATES.cloud.build(buildView(request, 'story'));
    expect(html).toContain('&lt;img src=&quot;');
    expect(html).not.toContain('<img');
    expect(html.match(/<style>/g)).toHaveLength(1);
  });

  it('declares which language leads with the page direction', () => {
    const ur = RenderRequest.parse(sampleRequest({ language: 'ur_en' }));
    expect(TEMPLATES.night.build(buildView(ur, 'story'))).toMatch(
      /^<!doctype html><html lang="ur" dir="rtl">/,
    );
    const en = RenderRequest.parse(sampleRequest({ language: 'en_ur' }));
    expect(TEMPLATES.night.build(buildView(en, 'story'))).toMatch(
      /^<!doctype html><html lang="en" dir="ltr">/,
    );
  });
});

describe('the halaqa flyer fields', () => {
  const flyer = {
    address: { en: 'House 12, Street 4, Sample Town', ur: 'مکان 12، گلی 4، نمونہ ٹاؤن' },
    phone: '0300 0000000',
    whatsappUrl: 'https://chat.whatsapp.com/SAMPLE',
    locationUrl: 'https://maps.example.org/place/sample',
  };
  const request = (language: 'en' | 'ur' | 'en_ur') => {
    const base = sampleRequest({ templateId: 'quranic_circles' as 'cloud', language });
    return RenderRequest.parse({ ...base, fields: { ...base.fields, flyer } });
  };

  it('prints the address and phone and draws the two captioned codes instead of the register code', () => {
    const html = TEMPLATES.quranic_circles.build(buildView(request('en'), 'story'));
    expect(html).toContain('House 12, Street 4, Sample Town');
    expect(html).toContain('0300 0000000');
    expect(html).toContain('WhatsApp group');
    expect(html).toContain('Google location');
    expect(html.match(/<div class="card code">/g)).toHaveLength(2);
    expect(html).not.toContain('Scan to register');
  });

  it('captions the codes in Urdu on an Urdu poster', () => {
    const html = TEMPLATES.quranic_circles.build(buildView(request('ur'), 'story'));
    expect(html).toContain('واٹس ایپ گروپ');
    expect(html).toContain('گلی');
  });

  it('keeps the register code and omits the flyer lines when the request has none', () => {
    const plain = RenderRequest.parse(sampleRequest({ templateId: 'quranic_circles' as 'cloud' }));
    const html = TEMPLATES.quranic_circles.build(buildView(plain, 'story'));
    expect(html).not.toContain('card code');
    expect(html).toContain('Scan to register');
  });

  it('leaves the link preview without codes or flyer lines', () => {
    const html = TEMPLATES.quranic_circles.build(buildView(request('en'), 'link_preview'));
    expect(html).not.toContain('card code');
    expect(html).not.toContain('0300 0000000');
  });

  it('refuses a link that is not https', () => {
    const base = sampleRequest({ templateId: 'quranic_circles' as 'cloud' });
    const bad = RenderRequest.safeParse({
      ...base,
      fields: { ...base.fields, flyer: { whatsappUrl: 'javascript:alert(1)' } },
    });
    expect(bad.success).toBe(false);
    const http = RenderRequest.safeParse({
      ...base,
      fields: { ...base.fields, flyer: { locationUrl: 'http://maps.example.org/x' } },
    });
    expect(http.success).toBe(false);
  });
});
