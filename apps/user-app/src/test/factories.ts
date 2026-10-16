import type { Follow, Occurrence, Registration, Session } from '@qc/contracts';
import { fixtures } from '@qc/contracts/fixtures';

/** Fixture sessions by what they are, so a test says "the full women's session". */
export const SESSIONS = {
  /** Dora, every day, family, Urdu, no limit: Masjid Al-Noor, Rawalpindi. */
  taraweeh: fixtures.sessions[0]!,
  /** Dora, every day, women only, full: Markaz Iqra. */
  womenFull: fixtures.sessions[1]!,
  /** Dora in English, family: Masjid Hira, Islamabad. */
  english: fixtures.sessions[2]!,
  /** Weekly circle on Tuesdays, family, with a teacher. */
  circle: fixtures.sessions[3]!,
  /** Dora, men only. */
  men: fixtures.sessions[4]!,
  /** A one-off special lecture. */
  lecture: fixtures.sessions[5]!,
} as const;

export const CITY_RAWALPINDI = fixtures.cities[0]!;
export const CITY_ISLAMABAD = fixtures.cities[1]!;
export const AREA_SADDAR = fixtures.areas[0]!;

export function occurrencesOf(session: Session): Occurrence[] {
  return fixtures.occurrences
    .filter((o) => o.sessionId === session.id)
    .map(({ headcount: _headcount, ...rest }) => {
      void _headcount;
      return rest;
    });
}

export function registrationFor(
  session: Session,
  change: Partial<Registration> = {},
): Registration {
  return {
    id: '00000000-0000-4000-8000-0b0000000001',
    sessionId: session.id,
    occurrenceId: null,
    areaId: AREA_SADDAR.id,
    section: 'family',
    partySize: 2,
    status: 'confirmed',
    waitlistPosition: null,
    createdAt: '2027-02-14T08:00:00Z',
    cancelledAt: null,
    session,
    ...change,
  };
}

export function followFor(
  venue: { id: string; name: Follow['name'] },
  change: Partial<Follow> = {},
): Follow {
  return {
    id: '00000000-0000-4000-8000-0f0000000001',
    venueId: venue.id,
    circleId: null,
    name: venue.name,
    alertsEnabled: true,
    createdAt: '2027-02-10T08:00:00Z',
    ...change,
  };
}
