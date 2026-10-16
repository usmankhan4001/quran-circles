import { createHash } from 'node:crypto';
import { UNASSIGNED } from './constants';
import { normalisePhone } from './phone';
import { coordinateProblem, distanceKm, proposeCity, slugify, type ParsedMapping } from './places';
import type { MappingRow } from './places';
import { Tally, type Report } from './report';
import { venueIdentity, type TargetCity, type TargetState } from './target';
import {
  V1RegistrationRow,
  V1SubscriberRow,
  V1VenueRow,
  normaliseForMatch,
  toInstant,
  toText,
  type V1Registration,
  type V1Venue,
} from './v1';
import type { Dataset } from './report';

export interface FlaggedRow {
  dataset: Dataset;
  /** 1-based position of the row in the input file. */
  row: number;
  /** V1's own id (a venue uuid or a registration serial). Null for subscribers: V1 has none. */
  sourceId: string | null;
  reason: string;
  /** A fixed word such as `swapped`. Never data from the row. */
  detail?: string;
}

export interface PlannedArea {
  citySlug: string;
  slug: string;
  nameEn: string;
  nameUr: string;
}

export interface PlannedVenue {
  slug: string;
  citySlug: string;
  areaSlug: string;
  nameEn: string;
  nameUr: string;
  addressEn: string;
  addressUr: string;
  lat: number;
  lng: number;
  contactPhone: string | null;
}

export interface PlannedRegistration {
  sourceId: string;
  name: string;
  /** E.164. Stored in `phone_raw`; the V1 form already reduced the typed value to digits. */
  phone: string;
  citySlug: string;
  cityName: string;
  venueName: string;
  registeredAt: string | null;
  raw: Record<string, unknown>;
}

export interface PlannedSubscriber {
  /** E.164 */
  phone: string;
  name: string | null;
}

export interface PlanInput {
  /** Raw rows from the export files; `null` when that dataset was not provided. */
  venues: readonly unknown[] | null;
  registrations: readonly unknown[] | null;
  subscribers: readonly unknown[] | null;
  /** The reviewed mapping, or null when there is none yet (every venue is then unapproved). */
  mapping: ParsedMapping | null;
  target: TargetState;
  /** Create the areas named in approved mapping rows when they do not exist. Cities never are. */
  createAreas: boolean;
}

export interface Plan {
  areas: PlannedArea[];
  venues: PlannedVenue[];
  registrations: PlannedRegistration[];
  subscribers: PlannedSubscriber[];
  flagged: FlaggedRow[];
  counts: Pick<Report, 'provided' | 'mapping' | 'areas' | 'totals' | 'cities'>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface ParsedVenue {
  row: number;
  v: V1Venue;
  nameEn: string;
  addressEn: string;
  normName: string;
  normAddress: string;
  createdAt: number | null;
}

const NEAR_KM = 0.1;

function sameVenue(a: ParsedVenue, b: ParsedVenue): boolean {
  if (a.v.id === b.v.id) return true;
  if (a.normName !== b.normName) return false;
  if (a.normAddress === b.normAddress) return true;
  if (a.v.lat !== null && a.v.lng !== null && b.v.lat !== null && b.v.lng !== null) {
    return distanceKm(a.v.lat, a.v.lng, b.v.lat, b.v.lng) <= NEAR_KM;
  }
  return false;
}

/** Slugs from names, made unique within the export in a way that does not depend on the mapping. */
function assignSlugs(venues: readonly ParsedVenue[]): Map<string, string> {
  const base = (p: ParsedVenue) => slugify(p.nameEn) || 'venue';
  const groups = new Map<string, ParsedVenue[]>();
  for (const p of venues) {
    const list = groups.get(base(p)) ?? [];
    list.push(p);
    groups.set(base(p), list);
  }
  const slugs = new Map<string, string>();
  const shortId = (p: ParsedVenue) => createHash('sha256').update(p.v.id).digest('hex').slice(0, 8);
  for (const [stem, members] of groups) {
    if (members.length === 1) {
      slugs.set(members[0]!.v.id, stem);
      continue;
    }
    const withLabel = new Map<string, ParsedVenue[]>();
    for (const p of members) {
      const slug = [stem, slugify(p.v.name ?? '')].filter(Boolean).join('-');
      const list = withLabel.get(slug) ?? [];
      list.push(p);
      withLabel.set(slug, list);
    }
    for (const [slug, same] of withLabel) {
      for (const p of same) {
        slugs.set(p.v.id, same.length === 1 ? slug : `${slug}-${shortId(p)}`);
      }
    }
  }
  return slugs;
}

interface VenueDecision {
  outcome: string;
  detail?: string;
  venue?: PlannedVenue;
  area?: PlannedArea;
}

export function buildPlan(input: PlanInput): Plan {
  const { target } = input;
  const tally = new Tally();
  const flagged: FlaggedRow[] = [];
  const plannedVenues: PlannedVenue[] = [];
  const plannedRegistrations: PlannedRegistration[] = [];
  const plannedSubscribers: PlannedSubscriber[] = [];
  const mappingRows = input.mapping?.rows ?? new Map<string, MappingRow>();

  const flag = (
    dataset: Dataset,
    row: number,
    sourceId: string | null,
    reason: string,
    detail?: string,
  ) => flagged.push({ dataset, row, sourceId, reason, ...(detail ? { detail } : {}) });

  // ------------------------------------------------------------------ venues
  /** City slug -> true for venues a registration can be attributed to (approved, known city). */
  const cityByVenueName = new Map<string, Set<string>>();
  const areaPlans = new Map<string, PlannedArea>();

  if (input.venues) {
    const parsed: ParsedVenue[] = [];
    input.venues.forEach((raw, index) => {
      const row = index + 1;
      const result = V1VenueRow.safeParse(raw);
      const rawId = isRecord(raw) ? toText(raw.id) : null;
      if (!result.success) {
        tally.outcome('venues', UNASSIGNED, 'invalidRow');
        flag('venues', row, rawId, 'invalidRow');
        return;
      }
      const v = result.data;
      const nameEn = v.venue ?? v.name;
      if (nameEn === null || v.address === null) {
        tally.outcome('venues', UNASSIGNED, 'invalidRow');
        flag('venues', row, v.id, 'invalidRow');
        return;
      }
      const created = toInstant(v.created_at);
      parsed.push({
        row,
        v,
        nameEn,
        addressEn: v.address,
        normName: normaliseForMatch(nameEn),
        normAddress: normaliseForMatch(v.address),
        createdAt: created ? created.getTime() : null,
      });
    });

    // Deduplicate: the earliest created copy is kept.
    const ordered = [...parsed].sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        if (a.createdAt === null) return 1;
        if (b.createdAt === null) return -1;
        return a.createdAt - b.createdAt;
      }
      return a.row - b.row;
    });
    const kept: ParsedVenue[] = [];
    const duplicates: { dup: ParsedVenue; of: ParsedVenue }[] = [];
    for (const p of ordered) {
      const original = kept.find((k) => sameVenue(k, p));
      if (original) duplicates.push({ dup: p, of: original });
      else kept.push(p);
    }
    kept.sort((a, b) => a.row - b.row);
    const slugs = assignSlugs(kept);

    const knownCity = (slug: string | null): TargetCity | null =>
      slug === null ? null : (target.cities.get(slug) ?? null);

    /** Lets registrations and subscribers find this venue's city by the venue's name. */
    const registerCity = (p: ParsedVenue, city: string): void => {
      const set = cityByVenueName.get(p.normName) ?? new Set<string>();
      set.add(city);
      cityByVenueName.set(p.normName, set);
    };

    const decide = (p: ParsedVenue): { decision: VenueDecision; bucket: string } => {
      const m = mappingRows.get(p.v.id);
      const mappedCity = knownCity(m?.citySlug ?? null);
      if (!m || !m.approved) {
        const proposed = knownCity(
          proposeCity({
            address: p.v.address,
            venue: p.v.venue,
            name: p.v.name,
            lat: p.v.lat,
            lng: p.v.lng,
          }).citySlug,
        );
        return {
          decision: { outcome: 'unapproved' },
          bucket: (mappedCity ?? proposed)?.slug ?? UNASSIGNED,
        };
      }
      if (!mappedCity) return { decision: { outcome: 'unknownCity' }, bucket: UNASSIGNED };
      const city = mappedCity.slug;
      if (m.provinceCode !== null && m.provinceCode !== mappedCity.provinceCode) {
        return { decision: { outcome: 'provinceMismatch' }, bucket: UNASSIGNED };
      }
      registerCity(p, city);

      if (target.venueIdentities.has(venueIdentity(city, p.nameEn, p.addressEn))) {
        return { decision: { outcome: 'alreadyPresent' }, bucket: city };
      }
      const areaExists = m.areaSlug !== null && target.areas.has(`${city}/${m.areaSlug}`);
      const areaCreatable = !areaExists && input.createAreas && !!m.areaSlug && !!m.areaNameEn;
      if (!areaExists && !areaCreatable) {
        return { decision: { outcome: 'unknownArea' }, bucket: city };
      }

      const useOverride = m.lat !== null && m.lng !== null;
      const lat = useOverride ? m.lat : p.v.lat;
      const lng = useOverride ? m.lng : p.v.lng;
      const problem = coordinateProblem(lat, lng);
      if (problem !== null || lat === null || lng === null) {
        return {
          decision: { outcome: 'invalidCoordinates', detail: problem ?? 'missing' },
          bucket: city,
        };
      }

      const slug = slugs.get(p.v.id)!;
      if (target.venueSlugs.has(slug)) {
        return { decision: { outcome: 'slugConflict' }, bucket: city };
      }

      const contact =
        p.v.contact === null ? null : normalisePhone(p.v.contact, { allowLandline: true });
      const venue: PlannedVenue = {
        slug,
        citySlug: city,
        areaSlug: m.areaSlug!,
        nameEn: p.nameEn,
        // V1 has no Urdu. The English text is carried so the column is filled; it is counted
        // in `needsUrduText` and an admin writes the Urdu later.
        nameUr: p.nameEn,
        addressEn: p.addressEn,
        addressUr: p.addressEn,
        lat,
        lng,
        contactPhone: contact?.ok ? contact.e164 : null,
      };
      const area: PlannedArea | undefined = areaExists
        ? undefined
        : {
            citySlug: city,
            slug: m.areaSlug!,
            nameEn: m.areaNameEn!,
            nameUr: m.areaNameUr ?? m.areaNameEn!,
          };
      return { decision: { outcome: 'toInsert', venue, ...(area ? { area } : {}) }, bucket: city };
    };

    const bucketByVenueId = new Map<string, string>();
    for (const p of kept) {
      const { decision, bucket } = decide(p);
      bucketByVenueId.set(p.v.id, bucket);
      tally.outcome('venues', bucket, decision.outcome);
      if (decision.outcome === 'toInsert' && decision.venue) {
        plannedVenues.push(decision.venue);
        if (decision.area) {
          areaPlans.set(`${decision.area.citySlug}/${decision.area.slug}`, decision.area);
        }
        tally.warning('venues', bucket, 'needsUrduText');
        if (p.v.contact !== null && decision.venue.contactPhone === null) {
          tally.warning('venues', bucket, 'contactPhoneInvalid');
        }
      }
      if (decision.outcome !== 'toInsert' && decision.outcome !== 'alreadyPresent') {
        flag('venues', p.row, p.v.id, decision.outcome, decision.detail);
      }
    }
    for (const { dup, of } of duplicates) {
      const bucket = bucketByVenueId.get(of.v.id) ?? UNASSIGNED;
      tally.outcome('venues', bucket, 'duplicate');
      flag('venues', dup.row, dup.v.id, 'duplicate');
    }
  }

  // --------------------------------------------------------- registrations
  const resolveVenue = (
    location: string | null,
  ): { kind: 'city'; city: TargetCity } | { kind: 'none' } | { kind: 'ambiguous' } => {
    if (location === null) return { kind: 'none' };
    const cities = cityByVenueName.get(normaliseForMatch(location));
    if (!cities || cities.size === 0) return { kind: 'none' };
    if (cities.size > 1) return { kind: 'ambiguous' };
    const city = target.cities.get([...cities][0]!);
    return city ? { kind: 'city', city } : { kind: 'none' };
  };

  if (input.registrations) {
    interface Candidate {
      row: number;
      data: V1Registration;
      phone: string;
      international: boolean;
      at: number | null;
    }
    const candidates: Candidate[] = [];
    input.registrations.forEach((raw, index) => {
      const row = index + 1;
      const rawId = isRecord(raw) ? toText(raw.id) : null;
      const result = V1RegistrationRow.safeParse(raw);
      if (!result.success || result.data.name === null || result.data.mobile === null) {
        tally.outcome('registrations', UNASSIGNED, 'invalidRow');
        flag('registrations', row, rawId, 'invalidRow');
        return;
      }
      const data = result.data;
      const resolved = resolveVenue(data.location);
      const bucket = resolved.kind === 'city' ? resolved.city.slug : UNASSIGNED;
      const phone = normalisePhone(data.mobile);
      if (!phone.ok) {
        tally.outcome('registrations', bucket, 'invalidPhone');
        flag('registrations', row, data.id, 'invalidPhone');
        return;
      }
      const at = toInstant(data.timestamp);
      candidates.push({
        row,
        data,
        phone: phone.e164,
        international: phone.kind === 'international',
        at: at ? at.getTime() : null,
      });
    });

    candidates.sort((a, b) => {
      if (a.at !== b.at) {
        if (a.at === null) return 1;
        if (b.at === null) return -1;
        return a.at - b.at;
      }
      return a.row - b.row;
    });
    const seen = new Set<string>();
    const unique: Candidate[] = [];
    for (const c of candidates) {
      const resolved = resolveVenue(c.data.location);
      const bucket = resolved.kind === 'city' ? resolved.city.slug : UNASSIGNED;
      const key = `${c.phone}|${normaliseForMatch(c.data.location ?? '')}`;
      if (seen.has(key)) {
        tally.outcome('registrations', bucket, 'duplicate');
        flag('registrations', c.row, c.data.id, 'duplicate');
        continue;
      }
      seen.add(key);
      unique.push(c);
    }
    unique.sort((a, b) => a.row - b.row);
    for (const c of unique) {
      const resolved = resolveVenue(c.data.location);
      if (resolved.kind !== 'city') {
        const outcome = resolved.kind === 'ambiguous' ? 'ambiguousVenue' : 'unmappedVenue';
        tally.outcome('registrations', UNASSIGNED, outcome);
        flag('registrations', c.row, c.data.id, outcome);
        continue;
      }
      const city = resolved.city;
      if (c.international) tally.warning('registrations', city.slug, 'nonPakistanNumber');
      if (c.data.timestamp !== null && c.at === null) {
        tally.warning('registrations', city.slug, 'unparseableTimestamp');
      }
      if (target.registrationSourceIds.has(c.data.id)) {
        tally.outcome('registrations', city.slug, 'alreadyPresent');
        continue;
      }
      tally.outcome('registrations', city.slug, 'toInsert');
      const d = c.data;
      plannedRegistrations.push({
        sourceId: d.id,
        name: d.name!,
        phone: c.phone,
        citySlug: city.slug,
        cityName: city.nameEn,
        venueName: d.location!,
        registeredAt: c.at === null ? null : new Date(c.at).toISOString(),
        raw: {
          source: 'v1-registeration',
          v1: Object.fromEntries(
            Object.entries({
              timestamp: d.timestamp,
              location: d.location,
              read: d.read,
              want: d.want,
              age: d.age,
              profession: d.profession,
              education: d.education,
              area: d.area,
            }).filter(([, value]) => value !== null),
          ),
        },
      });
    }
  }

  // ----------------------------------------------------------- subscribers
  if (input.subscribers) {
    interface SubCandidate {
      row: number;
      phone: string;
      international: boolean;
      venue: string | null;
      name: string | null;
    }
    const seen = new Set<string>();
    const candidates: SubCandidate[] = [];
    input.subscribers.forEach((raw, index) => {
      const row = index + 1;
      const result = V1SubscriberRow.safeParse(raw);
      if (!result.success || result.data.phone === null) {
        tally.outcome('subscribers', UNASSIGNED, 'invalidRow');
        flag('subscribers', row, null, 'invalidRow');
        return;
      }
      const resolved = resolveVenue(result.data.venue);
      const bucket = resolved.kind === 'city' ? resolved.city.slug : UNASSIGNED;
      const phone = normalisePhone(result.data.phone);
      if (!phone.ok) {
        tally.outcome('subscribers', bucket, 'invalidPhone');
        flag('subscribers', row, null, 'invalidPhone');
        return;
      }
      if (seen.has(phone.e164)) {
        tally.outcome('subscribers', bucket, 'duplicate');
        flag('subscribers', row, null, 'duplicate');
        return;
      }
      seen.add(phone.e164);
      candidates.push({
        row,
        phone: phone.e164,
        international: phone.kind === 'international',
        venue: result.data.venue,
        name: result.data.name,
      });
    });
    for (const c of candidates) {
      const resolved = resolveVenue(c.venue);
      const bucket = resolved.kind === 'city' ? resolved.city.slug : UNASSIGNED;
      if (resolved.kind !== 'city') tally.warning('subscribers', bucket, 'venueUnmapped');
      if (c.international) tally.warning('subscribers', bucket, 'nonPakistanNumber');
      if (target.subscriberPhones.has(c.phone)) {
        tally.outcome('subscribers', bucket, 'alreadyPresent');
      } else {
        tally.outcome('subscribers', bucket, 'toInsert');
        plannedSubscribers.push({ phone: c.phone, name: c.name });
      }
    }
  }

  const mapping = input.mapping;
  const approved = mapping ? [...mapping.rows.values()].filter((r) => r.approved).length : 0;
  const areas = [...areaPlans.values()].sort((a, b) =>
    `${a.citySlug}/${a.slug}`.localeCompare(`${b.citySlug}/${b.slug}`),
  );
  const counts: Plan['counts'] = {
    provided: {
      venues: input.venues !== null,
      registrations: input.registrations !== null,
      subscribers: input.subscribers !== null,
    },
    mapping: {
      rows: mapping?.rows.size ?? 0,
      approved,
      notApproved: (mapping?.rows.size ?? 0) - approved,
      invalidRows: mapping?.invalidRows ?? 0,
      duplicateIds: mapping?.duplicateIds ?? 0,
    },
    areas: { toCreate: areas.length, createEnabled: input.createAreas },
    totals: tally.totals,
    cities: tally.cities(),
  };
  flagged.sort((a, b) => a.dataset.localeCompare(b.dataset) || a.row - b.row);
  return {
    areas,
    venues: plannedVenues,
    registrations: plannedRegistrations,
    subscribers: plannedSubscribers,
    flagged,
    counts,
  };
}
