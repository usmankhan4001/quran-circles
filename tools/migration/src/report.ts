import { z } from 'zod';
import { REPORT_SCHEMA_VERSION, SEASON_TAG, UNASSIGNED } from './constants';

/**
 * The report is COUNTS ONLY. Its schema is strict and every leaf is a whole number, a boolean
 * or one of a few fixed words, and the only free keys are V2 city slugs and `unassigned`.
 * Nothing from V1 (no names, numbers, venue names, addresses or ids) can be added to it.
 */

/** Exactly one of these applies to every venue row read. */
export const VENUE_OUTCOMES = [
  'invalidRow',
  'duplicate',
  'unapproved',
  'unknownCity',
  'provinceMismatch',
  'unknownArea',
  'invalidCoordinates',
  'slugConflict',
  'alreadyPresent',
  'toInsert',
] as const;
export type VenueOutcome = (typeof VENUE_OUTCOMES)[number];

export const REGISTRATION_OUTCOMES = [
  'invalidRow',
  'invalidPhone',
  'duplicate',
  'unmappedVenue',
  'ambiguousVenue',
  'alreadyPresent',
  'toInsert',
] as const;
export type RegistrationOutcome = (typeof REGISTRATION_OUTCOMES)[number];

export const SUBSCRIBER_OUTCOMES = [
  'invalidRow',
  'invalidPhone',
  'duplicate',
  'alreadyPresent',
  'toInsert',
] as const;
export type SubscriberOutcome = (typeof SUBSCRIBER_OUTCOMES)[number];

/** Extra facts that do not exclude a row. A row can have several. */
export const VENUE_WARNINGS = ['needsUrduText', 'contactPhoneInvalid'] as const;
export const REGISTRATION_WARNINGS = ['unparseableTimestamp', 'nonPakistanNumber'] as const;
export const SUBSCRIBER_WARNINGS = ['nonPakistanNumber', 'venueUnmapped'] as const;

export type Dataset = 'venues' | 'registrations' | 'subscribers';

const DATASET_KEYS = {
  venues: [...VENUE_OUTCOMES, ...VENUE_WARNINGS],
  registrations: [...REGISTRATION_OUTCOMES, ...REGISTRATION_WARNINGS],
  subscribers: [...SUBSCRIBER_OUTCOMES, ...SUBSCRIBER_WARNINGS],
} as const;

/** `read` is the rows in the file; `valid` is rows that are, or already are, in V2. */
export type Counts = Record<string, number>;

const count = z.number().int().min(0);

// The keys come from the lists above, so the shape is dynamic; the type is stated explicitly.
const countsSchema = (dataset: Dataset): z.ZodType<Counts> =>
  z.strictObject({
    read: count,
    valid: count,
    ...Object.fromEntries(DATASET_KEYS[dataset].map((key) => [key, count])),
  }) as unknown as z.ZodType<Counts>;

const cityCountsSchema = z.strictObject({
  venues: countsSchema('venues'),
  registrations: countsSchema('registrations'),
  subscribers: countsSchema('subscribers'),
});

const insertedSchema = z.strictObject({
  areas: count,
  venues: count,
  registrations: count,
  subscribers: count,
});

export const ReportSchema = z.strictObject({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  generatedAt: z.iso.datetime(),
  mode: z.enum(['dry-run', 'apply']),
  target: z.enum(['database', 'offline']),
  seasonTag: z.literal(SEASON_TAG),
  provided: z.strictObject({
    venues: z.boolean(),
    registrations: z.boolean(),
    subscribers: z.boolean(),
  }),
  mapping: z.strictObject({
    rows: count,
    approved: count,
    notApproved: count,
    invalidRows: count,
    duplicateIds: count,
  }),
  areas: z.strictObject({ toCreate: count, createEnabled: z.boolean() }),
  totals: cityCountsSchema,
  cities: z.record(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), cityCountsSchema),
  applied: z
    .strictObject({
      inserted: insertedSchema,
      insertedByCity: z.record(
        z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        z.strictObject({ venues: count, registrations: count }),
      ),
    })
    .optional(),
  notCarried: z.tuple([z.literal('push_subscriptions'), z.literal('accounts')]),
});
export type Report = z.infer<typeof ReportSchema>;
export interface CityCounts {
  venues: Counts;
  registrations: Counts;
  subscribers: Counts;
}

export function emptyCounts(dataset: Dataset): Counts {
  return Object.fromEntries([
    ['read', 0],
    ['valid', 0],
    ...DATASET_KEYS[dataset].map((key) => [key, 0] as const),
  ]);
}

export function emptyCityCounts(): CityCounts {
  return {
    venues: emptyCounts('venues'),
    registrations: emptyCounts('registrations'),
    subscribers: emptyCounts('subscribers'),
  };
}

/** Accumulates counts per city and in total. */
export class Tally {
  readonly totals = emptyCityCounts();
  private readonly byCity = new Map<string, CityCounts>();

  private bucket(city: string): CityCounts {
    let found = this.byCity.get(city);
    if (!found) {
      found = emptyCityCounts();
      this.byCity.set(city, found);
    }
    return found;
  }

  /** Records one row read whose single outcome is `outcome`. */
  outcome(dataset: Dataset, city: string, outcome: string): void {
    for (const target of [this.totals[dataset], this.bucket(city)[dataset]]) {
      target.read = (target.read ?? 0) + 1;
      target[outcome] = (target[outcome] ?? 0) + 1;
      if (outcome === 'alreadyPresent' || outcome === 'toInsert') {
        target.valid = (target.valid ?? 0) + 1;
      }
    }
  }

  /** Records a non-excluding fact about a row. */
  warning(dataset: Dataset, city: string, warning: string): void {
    for (const target of [this.totals[dataset], this.bucket(city)[dataset]]) {
      target[warning] = (target[warning] ?? 0) + 1;
    }
  }

  cities(): Record<string, CityCounts> {
    const out: Record<string, CityCounts> = {};
    for (const key of [...this.byCity.keys()].sort()) out[key] = this.byCity.get(key)!;
    if (!out[UNASSIGNED]) out[UNASSIGNED] = emptyCityCounts();
    return out;
  }
}

/** Counts of rows by outcome for one dataset in one city bucket, for the console summary. */
export function summaryLines(report: Report): string[] {
  const lines: string[] = [];
  const cell = (counts: Counts, width: number) =>
    `${String(counts.toInsert ?? 0).padStart(width)} new/${String(counts.alreadyPresent ?? 0).padStart(width)} present`;
  const row = (label: string, c: CityCounts) =>
    `${label.padEnd(14)} venues ${cell(c.venues, 4)} | registrations ${cell(c.registrations, 5)} | subscribers ${cell(c.subscribers, 5)}`;
  for (const [slug, counts] of Object.entries(report.cities)) lines.push(row(slug, counts));
  lines.push(row('TOTAL', report.totals));
  return lines;
}
