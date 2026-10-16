import { describe, expect, it } from 'vitest';
import * as fx from './fixtures';
import { Area, City, Province, Venue } from './schemas/places';
import { AdminOccurrence, Session } from './schemas/sessions';
import { AdminCircle } from './schemas/admin';
import { ContentPage } from './schemas/config';
import { Me } from './schemas/people';
import { Update } from './schemas/updates';
import { PhoneE164 } from './common';

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe('fixtures', () => {
  it('match the contract schemas', () => {
    fx.provinces.forEach((x) => Province.parse(x));
    fx.cities.forEach((x) => City.parse(x));
    fx.areas.forEach((x) => Area.parse(x));
    fx.venues.forEach((x) => Venue.parse(x));
    fx.circles.forEach((x) => AdminCircle.parse(x));
    fx.sessions.forEach((x) => Session.parse(x));
    fx.occurrences.forEach((x) => AdminOccurrence.parse(x));
    fx.contentPages.forEach((x) => ContentPage.parse(x));
    fx.fixtureUpdates.forEach((x) => Update.parse(x));
    Me.parse(fx.fixtureMe);
  });

  it('have unique ids and valid foreign keys', () => {
    for (const list of [
      fx.provinces,
      fx.cities,
      fx.areas,
      fx.venues,
      fx.sessions,
      fx.occurrences,
      fx.circles,
    ]) {
      expect(unique(list.map((x) => x.id))).toBe(true);
    }
    const cityIds = new Set(fx.cities.map((c) => c.id));
    const areaIds = new Set(fx.areas.map((a) => a.id));
    const venueIds = new Set(fx.venues.map((v) => v.id));
    const sessionIds = new Set(fx.sessions.map((s) => s.id));
    expect(fx.areas.every((a) => cityIds.has(a.cityId))).toBe(true);
    expect(fx.venues.every((v) => cityIds.has(v.cityId) && areaIds.has(v.areaId))).toBe(true);
    expect(
      fx.venues.every((v) => fx.areas.find((a) => a.id === v.areaId)?.cityId === v.cityId),
    ).toBe(true);
    expect(fx.sessions.every((s) => venueIds.has(s.venueId))).toBe(true);
    expect(fx.occurrences.every((o) => sessionIds.has(o.sessionId))).toBe(true);
  });

  it('cover the nine V1 cities', () => {
    expect(fx.cities.map((c) => c.slug).sort()).toEqual(
      [
        'abbottabad',
        'faisalabad',
        'kot-addu',
        'lahore',
        'multan',
        'murree',
        'rawalpindi',
        'islamabad',
        'wah-cantt',
      ].sort(),
    );
  });

  it('contain no real-looking people or numbers', () => {
    for (const v of fx.venues) {
      expect(v.name.en.startsWith('Sample')).toBe(true);
      if (v.contactPhone) {
        expect(PhoneE164.safeParse(v.contactPhone).success).toBe(true);
        expect(v.contactPhone.startsWith('+92300000')).toBe(true);
      }
    }
    expect(fx.fixtureMe.phone.startsWith('+92300000')).toBe(true);
  });

  it('show Pakistan time as UTC+5', () => {
    const first = fx.occurrences.find((o) => o.sessionId === fx.fixtureId('session', 4))!;
    // The Tuesday circle starts 19:30 in Pakistan, which is 14:30 UTC.
    expect(first.startsAt.slice(11, 16)).toBe('14:30');
  });

  it('include a full session with a waitlist and one with a seat count', () => {
    expect(fx.sessions.some((s) => s.registration.full)).toBe(true);
    expect(fx.sessions.some((s) => s.registration.capacity !== null && !s.registration.full)).toBe(
      true,
    );
    expect(fx.sessions.some((s) => s.registration.capacity === null)).toBe(true);
  });

  it('give every published session a next occurrence', () => {
    expect(fx.sessions.every((s) => s.nextOccurrence !== null)).toBe(true);
  });
});
