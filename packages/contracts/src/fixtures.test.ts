import { describe, expect, it } from 'vitest';
import * as fx from './fixtures';
import { Area, City, Province, Venue } from './schemas/places';
import { AdminOccurrence, AdminSession, Session } from './schemas/sessions';
import { AdminCircle, checkImportRows } from './schemas/admin';
import { ContentPage } from './schemas/config';
import { Me, StaffRegistration } from './schemas/people';
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

  it('give each staff role a mock account with a fake number and real fixture scope', () => {
    const accounts = Object.values(fx.staffAccounts);
    expect(accounts.map((a) => a.kind).sort()).toEqual(['city', 'national', 'venue']);
    for (const key of ['token', 'refreshToken', 'phone', 'challengeId'] as const)
      expect(unique(accounts.map((a) => a[key])), key).toBe(true);
    expect(unique([fx.fixtureMe.id, ...accounts.map((a) => a.me.id)])).toBe(true);
    for (const a of accounts) {
      Me.parse(a.me);
      expect(a.me.phone).toBe(a.phone);
      expect(a.phone.startsWith('+92300000')).toBe(true);
      expect(a.refreshToken.length).toBeGreaterThanOrEqual(10);
    }
    const [venueRole] = fx.staffAccounts.venue.me.roles;
    const venue = fx.venues.find((v) => v.id === venueRole?.venueId);
    expect(venueRole?.role).toBe('venue_coordinator');
    expect(venue?.cityId).toBe(venueRole?.cityId);
    const [cityRole] = fx.staffAccounts.city.me.roles;
    expect(cityRole?.role).toBe('city_coordinator');
    expect(fx.cities.some((c) => c.id === cityRole?.cityId)).toBe(true);
    expect(fx.staffAccounts.national.me.roles.map((r) => r.role)).toEqual(['national_admin']);
    expect(fx.staffAccounts.national.token).toBe('mock-staff');
  });

  it('give every fixture session synthetic staff registrants, and none to an unknown one', () => {
    const all = fx.sessions.flatMap((s) => {
      const rows = fx.staffRegistrants(s.id);
      expect(rows.length, s.id).toBeGreaterThan(0);
      for (const r of rows) {
        StaffRegistration.parse(r);
        if (r.phone) expect(r.phone.startsWith('+92300000')).toBe(true);
        if (s.section !== 'family') expect(r.section).toBe(s.section);
      }
      expect(rows.some((r) => r.status === 'waitlisted')).toBe(s.registration.full);
      return rows;
    });
    expect(unique(all.map((r) => r.id))).toBe(true);
    expect(fx.staffRegistrants(fx.fixtureId('session', 99))).toEqual([]);
  });
});
