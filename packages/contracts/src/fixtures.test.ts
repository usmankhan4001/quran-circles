import { describe, expect, it } from 'vitest';
import * as fx from './fixtures';
import { Area, City, Province, Venue } from './schemas/places';
import { AdminOccurrence, AdminSession, Session } from './schemas/sessions';
import { AdminCircle, checkImportRows } from './schemas/admin';
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

  it('give staff the session records the admin reads return', () => {
    fx.adminSessions.forEach((x) => AdminSession.parse(x));
    expect(fx.adminSessions).toHaveLength(fx.sessions.length);
    const circleSession = fx.adminSessions.find((s) => s.circle !== null)!;
    expect(circleSession.circleStatus).toBe('published');
    expect(fx.adminSessions.find((s) => s.circle === null)!.circleStatus).toBeNull();
  });

  it('offer import rows that pass the shape checks and point at fixture ids', () => {
    for (const kind of ['venues', 'coordinators', 'sessions'] as const) {
      const checks = checkImportRows(kind, fx.importExamples[kind]);
      expect(checks.length, kind).toBeGreaterThan(0);
      for (const c of checks) expect(c.ok, `${kind} row ${c.index}`).toBe(true);
    }
    const venue = fx.importExamples.venues[0]!;
    expect(fx.areas.find((a) => a.id === venue.areaId)?.cityId).toBe(venue.cityId);
    expect(fx.venues.some((v) => v.name.en === venue.name.en)).toBe(false);
  });

  it('have sample registrants only for fixture sessions, with synthetic numbers', () => {
    expect(fx.sampleRegistrants).toHaveLength(fx.sessions.length);
    for (const r of fx.sampleRegistrants) {
      expect(fx.sessions.some((s) => s.id === r.sessionId && s.venueId === r.venueId)).toBe(true);
      expect(PhoneE164.safeParse(r.phone).success).toBe(true);
      expect(r.phone.startsWith('+92300000')).toBe(true);
    }
  });
});
