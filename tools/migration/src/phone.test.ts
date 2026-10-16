import { describe, expect, it } from 'vitest';
import { normalisePhone, toE164 } from './phone';
import { fakeNational, phoneForms } from './synthetic';

const NAT = fakeNational(1234); // 3000001234
const E164 = `+92${NAT}`;

describe('normalisePhone: Pakistani mobile forms', () => {
  const accepted: [string, string][] = [
    ['national with trunk zero', `0${NAT}`],
    ['national without trunk zero', NAT],
    ['V1 digits (92 prefix)', `92${NAT}`],
    ['plus 92', `+92${NAT}`],
    ['plus 92 with spaces', `+92 ${NAT.slice(0, 3)} ${NAT.slice(3)}`],
    ['national with a space', `0${NAT.slice(0, 3)} ${NAT.slice(3)}`],
    ['national with a dash', `0${NAT.slice(0, 3)}-${NAT.slice(3)}`],
    ['international prefix 00', `0092${NAT}`],
    ['00 with spaces', `00 92 ${NAT}`],
    ['stray trunk zero after +92', `+920${NAT}`],
    ['stray trunk zero after 92', `920${NAT}`],
    ['brackets and dots', `(+92) ${NAT.slice(0, 3)}.${NAT.slice(3)}`],
    ['surrounding whitespace', `  0${NAT}\n`],
    ['no-break space', `0${NAT.slice(0, 3)} ${NAT.slice(3)}`],
    ['directional marks around it', `‎+92${NAT}‏`],
  ];
  it.each(accepted)('%s', (_label, raw) => {
    expect(normalisePhone(raw)).toEqual({ ok: true, e164: E164, kind: 'mobile' });
  });

  it('accepts a number typed into a JSON export as a number (leading zero lost)', () => {
    expect(toE164(Number(NAT))).toBe(E164);
    expect(toE164(Number(`92${NAT}`))).toBe(E164);
  });

  it('reads Urdu (Extended Arabic-Indic) and Arabic-Indic digits', () => {
    expect(toE164(phoneForms(1234).urduDigits)).toBe(E164);
    const arabicIndic = `0${NAT}`.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
    expect(toE164(arabicIndic)).toBe(E164);
  });

  it.each(['300', '301', '302', '303', '304', '305'].map((p) => [p]))(
    'mobile range %s is accepted',
    (prefix) => {
      expect(toE164(`0${prefix}1234567`)).toBe(`+92${prefix}1234567`);
    },
  );
});

describe('normalisePhone: rejected input', () => {
  const rejected: [string, unknown, string][] = [
    ['empty string', '', 'empty'],
    ['only spaces', '   ', 'empty'],
    ['null', null, 'empty'],
    ['undefined', undefined, 'empty'],
    ['an object', {}, 'empty'],
    ['a bare plus', '+', 'empty'],
    ['words', 'not a number', 'bad_characters'],
    ['letters inside', `0300abc4567`, 'bad_characters'],
    ['two numbers joined with a slash', `0${NAT}/0${fakeNational(5)}`, 'bad_characters'],
    ['a second plus', `+92+${NAT}`, 'bad_characters'],
    ['too short', '12345', 'too_short'],
    ['nine digits after 0', '030012345', 'too_short'],
    ['one digit short', `0${NAT.slice(0, 9)}`, 'too_short'],
    ['one digit too many', `0${NAT}9`, 'too_long'],
    ['92 with too many digits', `92${NAT}99`, 'too_long'],
    ['not a mobile range (0 prefix, 36x)', '03601234567', 'not_pakistan_number'],
    ['not a mobile range (39x)', '03901234567', 'not_pakistan_number'],
    ['landline when only mobile is allowed', '0512345678', 'not_pakistan_number'],
    ['no plus, foreign number is not guessed', '971500000115', 'too_long'],
    ['plus 0092 is not valid', `+0092${NAT}`, 'bad_country_code'],
    ['plus then zero', '+0300123456789', 'bad_country_code'],
    ['international too short', '+4412345', 'too_short'],
    ['international too long', '+1234567890123456', 'too_long'],
  ];
  it.each(rejected)('%s', (_label, raw, reason) => {
    expect(normalisePhone(raw)).toEqual({ ok: false, reason });
  });

  it('never throws, whatever it is given', () => {
    for (const value of [NaN, Infinity, [], [1], Symbol.iterator, () => 1, 10n, true]) {
      expect(() => normalisePhone(value)).not.toThrow();
      expect(normalisePhone(value).ok).toBe(false);
    }
  });
});

describe('normalisePhone: international numbers', () => {
  it('accepts an explicit plus with another country code', () => {
    expect(normalisePhone('+971500000115')).toEqual({
      ok: true,
      e164: '+971500000115',
      kind: 'international',
    });
  });
  it('accepts the 00 prefix with another country code', () => {
    expect(toE164('00971500000115')).toBe('+971500000115');
  });
  it('keeps spaces out of the result', () => {
    expect(toE164('+44 20 7946 0000')).toBe('+442079460000');
  });
});

describe('normalisePhone: landlines (venue contacts only)', () => {
  it('rejects them by default and accepts them when allowed', () => {
    expect(normalisePhone('051-2345678').ok).toBe(false);
    expect(normalisePhone('051-2345678', { allowLandline: true })).toEqual({
      ok: true,
      e164: '+92512345678',
      kind: 'landline',
    });
  });
  it.each([
    ['042-35123456', '+924235123456'],
    ['+92 21 3456 7890', '+922134567890'],
    ['0992-383456', '+92992383456'],
    ['92 61 4512345', '+92614512345'],
  ])('accepts %s', (raw, e164) => {
    expect(toE164(raw, { allowLandline: true })).toBe(e164);
  });
  it('still treats a 3-prefixed number as mobile, never a landline', () => {
    expect(normalisePhone('03901234567', { allowLandline: true }).ok).toBe(false);
  });
  it('rejects a landline that is too short', () => {
    expect(normalisePhone('0512345', { allowLandline: true }).ok).toBe(false);
  });
});

describe('normalisePhone: result is always valid E.164 for the database', () => {
  it('matches the shape the venues table and the contract require', () => {
    const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;
    for (const raw of Object.values(phoneForms(4321))) {
      const result = normalisePhone(raw);
      expect(result.ok && E164_PATTERN.test(result.e164)).toBe(true);
    }
  });
  it('gives the same answer for every way of typing one number', () => {
    const forms = Object.values(phoneForms(77));
    expect(new Set(forms.map((f) => toE164(f)))).toEqual(new Set([`+92${fakeNational(77)}`]));
  });
});
