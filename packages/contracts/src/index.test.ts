import { describe, expect, it } from 'vitest';
import { HealthResponse, Locale, Role, Section } from './index';

describe('starter contract', () => {
  it('accepts the two supported locales only', () => {
    expect(Locale.parse('en')).toBe('en');
    expect(Locale.parse('ur')).toBe('ur');
    expect(Locale.safeParse('fr').success).toBe(false);
  });

  it('defines the three roles from the V2 plan', () => {
    expect(Role.options).toEqual(['national_admin', 'city_coordinator', 'venue_coordinator']);
  });

  it('defines the three session sections', () => {
    expect(Section.options).toEqual(['women', 'men', 'family']);
  });

  it('validates the health response', () => {
    expect(HealthResponse.safeParse({ ok: true, service: 'api' }).success).toBe(true);
    expect(HealthResponse.safeParse({ ok: false, service: 'api' }).success).toBe(false);
  });
});
