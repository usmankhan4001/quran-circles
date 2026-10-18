import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  HttpsUrl,
  LocalizedAddressInput,
  LocalizedInput,
  LocalizedLongInput,
  PHONE_NOT_PAKISTAN_MOBILE,
  PakistaniMobilePhone,
  PersonName,
  PhoneE164,
  SAFE_TEXT_MESSAGE,
  SafeText,
  isSafeText,
  stripUnsafeText,
} from './common';
import { issuesFromZod } from './errors';
import {
  AttendanceEntry,
  CircleCreate,
  CircleUpdate,
  SessionCreate,
  VenueCreate,
} from './schemas/admin';
import { RequestCodeBody } from './schemas/auth';
import { PosterFields, PosterSourceSnapshot } from './schemas/posters';
import { CircleInfo, Portion } from './schemas/sessions';

/**
 * SEC-08 (control, bidi and invisible format characters in names and place text), SEC-09 (only
 * https links) and SEC-04 (sign-in codes to Pakistani mobile numbers only).
 */

const UUID = '00000000-0000-4000-8000-000000000001';

/** Real Urdu and Arabic text with its usual punctuation, digits, diacritics and ZWNJ. */
const URDU_AND_ARABIC = [
  'جامع مسجد نور، ماڈل ٹاؤن',
  'حلقۂ قرآن: سورۃ البقرہ (آیات ۱–۲۰)',
  'کیا آپ آئیں گے؟ ان شاء اللہ۔',
  'درسِ قرآن؛ «تفسیر» اور ترجمہ',
  'محمد ﷺ کی سیرت',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ ٠١٢٣',
  'عبدالرحمٰن',
  // ZWNJ (U+200C) keeps two letters apart; Urdu needs it.
  'ناظرہ\u200cقرآن',
  'Jamia Masjid جامع مسجد, G-9/2',
  'Sector F-7/3, Islamabad',
  "Zoë O'Brien-Smith",
];

/** Each one is refused in line text and in long text. */
const ALWAYS_REFUSED: Array<[string, string]> = [
  ['NUL', '\u0000'],
  ['bell', '\u0007'],
  ['escape', '\u001b'],
  ['DEL', '\u007f'],
  ['C1 next line', '\u0085'],
  ['C1 CSI', '\u009b'],
  ['Arabic letter mark', '\u061c'],
  ['zero-width space', '\u200b'],
  ['zero-width joiner', '\u200d'],
  ['left-to-right mark', '\u200e'],
  ['right-to-left mark', '\u200f'],
  ['line separator', '\u2028'],
  ['paragraph separator', '\u2029'],
  ['LRE', '\u202a'],
  ['RLE', '\u202b'],
  ['PDF', '\u202c'],
  ['LRO', '\u202d'],
  ['RLO', '\u202e'],
  ['word joiner', '\u2060'],
  ['invisible separator', '\u2063'],
  ['LRI', '\u2066'],
  ['RLI', '\u2067'],
  ['FSI', '\u2068'],
  ['PDI', '\u2069'],
  ['deprecated format control', '\u206e'],
  ['byte order mark', '\ufeff'],
  ['interlinear annotation', '\ufff9'],
];

const LINE_BREAKS: Array<[string, string]> = [
  ['tab', '\t'],
  ['line feed', '\n'],
  ['carriage return', '\r'],
];

const issuePaths = (schema: z.ZodType, input: unknown): string[] => {
  const r = schema.safeParse(input);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join('.')))];
};

describe('SafeText (SEC-08)', () => {
  const line = SafeText(1, 200);
  const long = SafeText(1, 200, { multiline: true });

  it('accepts real Urdu and Arabic text with normal punctuation, and ZWNJ', () => {
    for (const text of URDU_AND_ARABIC) {
      expect(line.safeParse(text).success, text).toBe(true);
      expect(long.safeParse(text).success, text).toBe(true);
      expect(isSafeText(text)).toBe(true);
    }
  });

  it.each(ALWAYS_REFUSED)('refuses %s inside the text, in line and long text', (_name, char) => {
    for (const schema of [line, long]) {
      const r = schema.safeParse(`مسجد${char}نور`);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0]).toMatchObject({ code: 'custom', message: SAFE_TEXT_MESSAGE });
      }
    }
  });

  it.each(LINE_BREAKS)('refuses %s in line text and keeps it in long text', (_name, char) => {
    expect(line.safeParse(`first${char}second`).success).toBe(false);
    expect(long.safeParse(`first${char}second`).success).toBe(true);
  });

  it('still trims and checks the length', () => {
    expect(line.parse('  مسجد  ')).toBe('مسجد');
    expect(line.safeParse('   ').success).toBe(false);
    expect(SafeText(1, 3).safeParse('abcd').success).toBe(false);
  });

  it('strips exactly the refused characters as a second guard', () => {
    expect(stripUnsafeText('Free \u202eeerf\u2066x\u2069')).toBe('Free eerfx');
    expect(stripUnsafeText('a\nb')).toBe('ab');
    expect(stripUnsafeText('a\nb', { multiline: true })).toBe('a\nb');
    expect(stripUnsafeText('ناظرہ\u200cقرآن\u200d')).toBe('ناظرہ\u200cقرآن');
    for (const text of URDU_AND_ARABIC) expect(stripUnsafeText(text)).toBe(text);
  });
});

describe('names and place text use SafeText (SEC-08)', () => {
  const RLO = '\u202e';

  it('person names', () => {
    expect(PersonName.safeParse('عبدالرحمٰن').success).toBe(true);
    expect(PersonName.safeParse(`Ali${RLO}nahK`).success).toBe(false);
    expect(PersonName.safeParse('Ali\nKhan').success).toBe(false);
  });

  it('localized names and titles are one line; long text and addresses keep line breaks', () => {
    expect(issuePaths(LocalizedInput, { en: 'Dars', ur: 'درسِ قرآن' })).toEqual([]);
    expect(issuePaths(LocalizedInput, { en: `Dars${RLO}`, ur: 'درس\u2067' })).toEqual(['en', 'ur']);
    expect(issuePaths(LocalizedInput, { en: 'Two\nlines' })).toEqual(['en']);
    const twoLines = { en: 'House 1, Street 2\nG-9/2', ur: 'مکان ۱، گلی ۲\nجی نائن ٹو' };
    expect(issuePaths(LocalizedAddressInput, twoLines)).toEqual([]);
    expect(issuePaths(LocalizedLongInput, twoLines)).toEqual([]);
    expect(issuePaths(LocalizedAddressInput, { en: `x${RLO}` })).toEqual(['en']);
    expect(issuePaths(LocalizedLongInput, { en: 'x', ur: `\u200bx` })).toEqual(['ur']);
  });

  it('venues: name on one line, address on several, neither with bidi controls', () => {
    const venue = {
      cityId: UUID,
      areaId: UUID,
      name: { en: 'Masjid Noor', ur: 'مسجد نور' },
      address: { en: 'Street 2\nG-9/2', ur: 'گلی ۲\nجی نائن ٹو' },
      lat: 33.68,
      lng: 73.04,
    };
    expect(issuePaths(VenueCreate, venue)).toEqual([]);
    expect(issuePaths(VenueCreate, { ...venue, name: { en: `Masjid${RLO}` } })).toEqual([
      'name.en',
    ]);
    expect(issuePaths(VenueCreate, { ...venue, address: { en: 'x\u2066' } })).toEqual([
      'address.en',
    ]);
  });

  it('circles: name, teacher name and description', () => {
    const circle = {
      venueId: UUID,
      name: { en: 'Nazra', ur: 'ناظرہ\u200cقرآن' },
      teacherName: 'قاری محمد',
      description: { en: 'Line one\nLine two' },
      language: 'ur',
    };
    expect(issuePaths(CircleCreate, circle)).toEqual([]);
    expect(issuePaths(CircleCreate, { ...circle, teacherName: `Qari${RLO}` })).toEqual([
      'teacherName',
    ]);
    expect(issuePaths(CircleUpdate, { teacherName: 'Qari\u0000' })).toEqual(['teacherName']);
    expect(issuePaths(CircleUpdate, { name: { en: 'x\u200f' } })).toEqual(['name.en']);
  });

  it('session titles and lesson titles', () => {
    const session = {
      venueId: UUID,
      program: 'circles',
      title: { en: 'Tafseer', ur: 'تفسیر؟' },
      section: 'family',
      language: 'ur',
      localStartTime: '19:30',
      durationMinutes: 60,
      kind: 'recurring',
      daysOfWeek: [1],
      startsOn: '2027-01-04',
    };
    expect(issuePaths(SessionCreate, session)).toEqual([]);
    expect(issuePaths(SessionCreate, { ...session, title: { en: `T${RLO}` } })).toEqual([
      'title.en',
    ]);
    expect(Portion.safeParse({ kind: 'lesson', title: 'سبق ۳' }).success).toBe(true);
    expect(Portion.safeParse({ kind: 'lesson', title: `x${RLO}` }).success).toBe(false);
  });

  it('attendance drop-in names', () => {
    expect(AttendanceEntry.safeParse({ name: 'احمد' }).success).toBe(true);
    expect(AttendanceEntry.safeParse({ name: `A${RLO}` }).success).toBe(false);
  });

  it('poster fields and the venue and area names in the poster snapshot', () => {
    expect(PosterFields.safeParse({ title: { ur: 'درسِ قرآن' } }).success).toBe(true);
    expect(PosterFields.safeParse({ title: { ur: 'درس\u200dقرآن' } }).success).toBe(false);
    expect(PosterFields.safeParse({ title: { en: 'One\nTwo' } }).success).toBe(false);
    const snapshot = {
      sessionId: UUID,
      sessionVersion: '1',
      localStartTime: '19:30',
      durationMinutes: 60,
      daysOfWeek: [1],
      startsOn: '2027-01-04',
      endsOn: null,
      timezone: 'Asia/Karachi',
      venue: {
        id: UUID,
        name: { en: 'Masjid Noor', ur: 'مسجد نور' },
        area: { en: 'G-9', ur: 'جی نائن' },
      },
    };
    expect(issuePaths(PosterSourceSnapshot, snapshot)).toEqual([]);
    const bad = {
      ...snapshot,
      venue: {
        ...snapshot.venue,
        name: { en: `N${RLO}`, ur: null },
        area: { en: 'G\u2066', ur: null },
      },
    };
    expect(issuePaths(PosterSourceSnapshot, bad)).toEqual(['venue.name.en', 'venue.area.en']);
  });
});

describe('HttpsUrl and online links (SEC-09)', () => {
  it('accepts https links to a domain', () => {
    for (const url of [
      'https://meet.example.org/abc-defg-hij',
      'https://example.org',
      'HTTPS://EXAMPLE.ORG/Room?pwd=x#top',
      'https://sub.example.co.uk:8443/x',
    ]) {
      expect(HttpsUrl.safeParse(url).success, url).toBe(true);
    }
  });

  it('refuses every other scheme, IPs, localhost, credentials and odd forms', () => {
    for (const url of [
      'http://example.org',
      'javascript:alert(1)',
      'JavaScript:alert(1)//https://example.org',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'ftp://example.org',
      'vbscript:msgbox',
      'intent://example.org#Intent;end',
      'whatsapp://send?text=x',
      'https:example.org',
      'https://127.0.0.1/x',
      'https://localhost/x',
      'https://user:secret@example.org/',
      'https://zoom.example@evil.example/',
      `https://example.org/${'a'.repeat(2048)}`,
      'not a link',
      '',
    ]) {
      expect(HttpsUrl.safeParse(url).success, url).toBe(false);
    }
  });

  it('is used by every onlineLink field', () => {
    const base = { venueId: UUID, name: { en: 'Online' }, language: 'en' };
    expect(issuePaths(CircleCreate, { ...base, onlineLink: 'https://meet.example.org/x' })).toEqual(
      [],
    );
    expect(issuePaths(CircleCreate, { ...base, onlineLink: 'javascript:alert(1)' })).toEqual([
      'onlineLink',
    ]);
    expect(issuePaths(CircleCreate, { ...base, onlineLink: null })).toEqual([]);
    expect(issuePaths(CircleUpdate, { onlineLink: 'http://example.org' })).toEqual(['onlineLink']);
    expect(issuePaths(CircleUpdate, { onlineLink: 'data:text/html,x' })).toEqual(['onlineLink']);
    const info = { id: UUID, name: { en: 'x', ur: null }, teacherName: null };
    expect(issuePaths(CircleInfo, { ...info, onlineLink: 'file:///etc/passwd' })).toEqual([
      'onlineLink',
    ]);
    expect(issuePaths(CircleInfo, { ...info, onlineLink: 'https://example.org' })).toEqual([]);
  });
});

describe('sign-in phone numbers (SEC-04)', () => {
  const issues = (phone: string) => {
    const r = RequestCodeBody.safeParse({ phone });
    return r.success ? [] : issuesFromZod(r.error);
  };

  it('accepts Pakistani mobile numbers', () => {
    for (const phone of ['+923001234567', '+923331234567', '+923459876543', '+923999999999']) {
      expect(issues(phone), phone).toEqual([]);
    }
  });

  it('refuses other countries and Pakistani landlines with a clear issue code', () => {
    for (const phone of [
      '+447700900123', // United Kingdom
      '+971501234567', // United Arab Emirates
      '+14155550123', // United States
      '+92512345678', // Islamabad landline, 9 digits
      '+925112345678', // landline range, 10 digits
      '+92300123456', // one digit short
    ]) {
      expect(issues(phone), phone).toEqual([{ path: 'phone', code: PHONE_NOT_PAKISTAN_MOBILE }]);
    }
  });

  it('reports a malformed number as a format issue only', () => {
    for (const phone of ['03001234567', '+92 300 1234567', '+9230012345678901', 'abc', '']) {
      expect(issues(phone), phone).toEqual([{ path: 'phone', code: 'invalid_format' }]);
    }
  });

  it('leaves the other phone fields as E.164 for any country', () => {
    expect(PhoneE164.safeParse('+447700900123').success).toBe(true);
    expect(PakistaniMobilePhone.safeParse('+447700900123').success).toBe(false);
    const venue = {
      cityId: UUID,
      areaId: UUID,
      name: { en: 'Masjid' },
      address: { en: 'Street' },
      lat: 33.6,
      lng: 73.0,
      contactPhone: '+92512345678',
    };
    expect(issuePaths(VenueCreate, venue)).toEqual([]);
  });
});

describe('issuesFromZod', () => {
  it('keeps Zod codes, and uses a refinement’s own code when it names one', () => {
    const r = SafeText(1, 5).safeParse('toolong\u202e');
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(issuesFromZod(r.error).map((i) => i.code)).toEqual(['too_big', 'custom']);
    }
  });
});
