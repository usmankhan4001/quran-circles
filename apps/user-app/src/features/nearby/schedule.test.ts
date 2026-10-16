import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../i18n/translate';
import { SESSIONS } from '../../test/factories';
import { describeOccurrence, describeSchedule } from './schedule';
import { markersFromSessions } from './markers';

const en = createTranslator('en');
const ur = createTranslator('ur');

describe('describeSchedule', () => {
  it('says "every day" for a daily session', () => {
    expect(describeSchedule(SESSIONS.taraweeh, en, 'en')).toMatch(/^Every day at 9:00\s?pm$/i);
  });

  it('lists the days of a weekly circle', () => {
    expect(describeSchedule(SESSIONS.circle, en, 'en')).toMatch(/^Tuesday at 7:30\s?pm$/i);
  });

  it('joins several days with the language’s separator, in week order', () => {
    const session = { ...SESSIONS.circle, daysOfWeek: [5, 1, 3] };
    expect(describeSchedule(session, en, 'en')).toMatch(/^Monday, Wednesday, Friday at /);
  });

  it('gives a date for a one-off lecture', () => {
    expect(describeSchedule(SESSIONS.lecture, en, 'en')).toMatch(/6:00\s?pm/i);
    expect(describeSchedule(SESSIONS.lecture, en, 'en')).not.toMatch(/^Every/);
  });

  it('is written in Urdu with the Urdu separator', () => {
    const session = { ...SESSIONS.circle, daysOfWeek: [1, 3] };
    expect(describeSchedule(session, ur, 'ur')).toContain('، ');
  });
});

describe('describeOccurrence', () => {
  it('formats one dated occurrence in the session’s zone', () => {
    expect(describeOccurrence({ startsAt: '2027-02-15T16:30:00Z' }, 'Asia/Karachi', 'en')).toMatch(
      /9:30/,
    );
  });
});

describe('markersFromSessions', () => {
  it('makes one pin per venue and counts the sessions there', () => {
    const sessions = [SESSIONS.taraweeh, SESSIONS.circle, SESSIONS.english];
    const markers = markersFromSessions(sessions, 'en', (count, first) => `${count}|${first}`);
    expect(markers).toHaveLength(2);
    const noor = markers.find((m) => m.id === SESSIONS.taraweeh.venueId)!;
    expect(noor.title).toBe(SESSIONS.taraweeh.venue.name.en);
    expect(noor.subtitle).toBe(`2|${SESSIONS.taraweeh.title.en}`);
    expect(noor.lat).toBe(SESSIONS.taraweeh.venue.lat);
  });

  it('writes pins in Urdu when it can, and in English when there is no Urdu', () => {
    const urdu = markersFromSessions([SESSIONS.taraweeh], 'ur', () => '');
    expect(urdu[0]!.title).toBe(SESSIONS.taraweeh.venue.name.ur ?? SESSIONS.taraweeh.venue.name.en);
  });
});
