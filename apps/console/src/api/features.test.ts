import { describe, expect, it } from 'vitest';
import type { Principal } from '@qc/contracts';
import { cityCoordinator, islamabad, nationalAdmin, rawalpindi, venueA } from '../test/people';
import { configCityFor } from './features';

describe('configCityFor: which city the feature flags are read for', () => {
  it('uses the platform default for a national admin or nobody', () => {
    expect(configCityFor(null)).toBeUndefined();
    expect(configCityFor({ userId: 'u', assignments: [] })).toBeUndefined();
    expect(configCityFor(nationalAdmin)).toBeUndefined();
    const both: Principal = {
      userId: 'u',
      assignments: [...nationalAdmin.assignments, ...cityCoordinator.assignments],
    };
    expect(configCityFor(both)).toBeUndefined();
  });

  it("uses a city coordinator's city", () => {
    expect(configCityFor(cityCoordinator)).toBe(rawalpindi!.id);
  });

  it("uses a venue coordinator's city when /me names it", () => {
    const venue: Principal = {
      userId: 'u',
      assignments: [{ role: 'venue_coordinator', cityId: venueA!.cityId, venueId: venueA!.id }],
    };
    expect(configCityFor(venue)).toBe(venueA!.cityId);
    const noCity: Principal = {
      userId: 'u',
      assignments: [{ role: 'venue_coordinator', cityId: null, venueId: venueA!.id }],
    };
    expect(configCityFor(noCity)).toBeUndefined();
  });

  it('uses the platform default for roles in more than one city', () => {
    const two: Principal = {
      userId: 'u',
      assignments: [
        { role: 'city_coordinator', cityId: rawalpindi!.id, venueId: null },
        { role: 'city_coordinator', cityId: islamabad!.id, venueId: null },
      ],
    };
    expect(configCityFor(two)).toBeUndefined();
  });
});
