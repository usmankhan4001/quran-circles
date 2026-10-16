import { z } from 'zod';

/**
 * Starter contract. The contracts lane (Wave 1) replaces and extends this file with the
 * full API contract. See docs/agents/briefs/contracts.md.
 */

export const Locale = z.enum(['en', 'ur']);
export type Locale = z.infer<typeof Locale>;

export const Role = z.enum(['national_admin', 'city_coordinator', 'venue_coordinator']);
export type Role = z.infer<typeof Role>;

export const Section = z.enum(['women', 'men', 'family']);
export type Section = z.infer<typeof Section>;

export const Program = z.enum(['dora', 'circles']);
export type Program = z.infer<typeof Program>;

export const HealthResponse = z.object({
  ok: z.literal(true),
  service: z.string().min(1),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
