import { fixtureId } from '@qc/contracts/fixtures';

/**
 * Ids from the synthetic `@qc/db` seed, which copies the contract fixtures. Fixture dates are in
 * February 2027, so seeded occurrences are in the future; flows that need "soon" create their own
 * session through the admin API.
 */
export const SEED = {
  rawalpindi: fixtureId('city', 1),
  islamabad: fixtureId('city', 2),
  lahore: fixtureId('city', 9),
  /** Rawalpindi, Saddar. */
  venueNoor: fixtureId('venue', 1),
  /** Rawalpindi, Satellite Town. */
  venueIqra: fixtureId('venue', 2),
  /** Islamabad, F-7. */
  venueHira: fixtureId('venue', 3),
  areaSaddar: fixtureId('area', 1),
  areaSatellite: fixtureId('area', 2),
  areaF7: fixtureId('area', 4),
  /** Al-Noor, family, daily at 21:00. */
  sessionTaraweehNoor: fixtureId('session', 1),
  /** Iqra, women, capacity 40. */
  sessionWomenIqra: fixtureId('session', 2),
  /** Hira, family, English. */
  sessionEnglishHira: fixtureId('session', 3),
  /** Al-Noor, Tuesday circle. */
  sessionTajweedNoor: fixtureId('session', 4),
} as const;
