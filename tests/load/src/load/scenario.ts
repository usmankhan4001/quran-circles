import { z } from 'zod';
import raw from '../../scenario.json';

const Range = z.tuple([z.number().min(0), z.number().min(0)]).refine(([a, b]) => a <= b);
const Latency = z.object({ p95: z.number().positive(), p99: z.number().positive() });

export const OPS = [
  'config',
  'nearby',
  'nearby_filtered',
  'home_next',
  'session_view',
  'session_occurrences',
  'register',
  'my_registrations',
  'unread_count',
  'ayah',
  'token_refresh',
] as const;
export type Op = (typeof OPS)[number];

/** The shape of `scenario.json`. The k6 script reads the same file. */
export const ScenarioFile = z.object({
  $comment: z.string().optional(),
  seed: z.object({
    citySlug: z.string().min(1),
    center: z.object({ lat: z.number(), lng: z.number() }),
    spreadDeg: z.number().positive().max(1),
    venues: z.number().int().positive().max(2000),
    sessionsPerVenue: z.number().int().positive().max(10),
    users: z.number().int().positive(),
    bulkPushUsers: z.number().int().min(0),
  }),
  journey: z.object({
    thinkMs: Range,
    filteredNearbyProbability: z.number().min(0).max(1),
    viewsPerJourney: Range,
    registerProbability: z.number().min(0).max(1),
  }),
  steps: z
    .array(z.object({ vus: z.number().int().positive(), durationS: z.number().positive() }))
    .min(1),
  rampS: z.number().min(0),
  pushBurst: z.object({ atS: z.number().min(0) }),
  thresholds: z.object({
    failedRate: z.number().min(0).max(1),
    rateLimitedRate: z.number().min(0).max(1),
    ops: z.record(z.enum(OPS), Latency),
    push: z.object({ postMs: z.number().positive(), drainPerSecond: z.number().positive() }),
  }),
});
export type ScenarioFile = z.infer<typeof ScenarioFile>;

export const SCENARIO: ScenarioFile = ScenarioFile.parse(raw);
