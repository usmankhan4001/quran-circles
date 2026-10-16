import type { SqlExecutor } from '@qc/db';
import { SEASON_TAG } from './constants';
import { CITY_HINTS } from './places';
import { normaliseForMatch } from './v1';

export interface TargetCity {
  slug: string;
  nameEn: string;
  provinceCode: string;
  /** Database id; null for the offline target. */
  id: string | null;
}

/** What the V2 database already holds, as far as the migration needs to know. */
export interface TargetState {
  kind: 'database' | 'offline';
  cities: Map<string, TargetCity>;
  /** `${citySlug}/${areaSlug}` */
  areas: Set<string>;
  /** venue slug -> city slug */
  venueSlugs: Map<string, string>;
  /** `${citySlug}|${normalised name}|${normalised address}` */
  venueIdentities: Set<string>;
  registrationSourceIds: Set<string>;
  /** E.164 numbers already in `legacy_whatsapp_subscribers`. */
  subscriberPhones: Set<string>;
}

export const venueIdentity = (citySlug: string, nameEn: string, addressEn: string) =>
  `${citySlug}|${normaliseForMatch(nameEn)}|${normaliseForMatch(addressEn)}`;

/** A target with the nine V1 cities and nothing else, for dry runs with no database. */
export function offlineTarget(): TargetState {
  return {
    kind: 'offline',
    cities: new Map(
      CITY_HINTS.map((h) => [
        h.slug,
        { slug: h.slug, nameEn: h.nameEn, provinceCode: h.provinceCode, id: null },
      ]),
    ),
    areas: new Set(),
    venueSlugs: new Map(),
    venueIdentities: new Set(),
    registrationSourceIds: new Set(),
    subscriberPhones: new Set(),
  };
}

interface CityRow {
  id: string;
  slug: string;
  name_en: string;
  province_code: string;
}

/** Reads the target state. Run it inside the migration's transaction so plan and apply agree. */
export async function loadTargetState(db: SqlExecutor): Promise<TargetState> {
  const cities = await db.query<CityRow>(
    `SELECT c.id, c.slug, c.name_en, p.code AS province_code
       FROM cities c JOIN provinces p ON p.id = c.province_id`,
  );
  const areas = await db.query<{ city_slug: string; area_slug: string }>(
    `SELECT c.slug AS city_slug, a.slug AS area_slug
       FROM areas a JOIN cities c ON c.id = a.city_id`,
  );
  const venues = await db.query<{
    slug: string;
    city_slug: string;
    name_en: string;
    address_en: string;
  }>(
    `SELECT v.slug, c.slug AS city_slug, v.name_en, v.address_en
       FROM venues v JOIN cities c ON c.id = v.city_id`,
  );
  const registrations = await db.query<{ source_id: string }>(
    `SELECT source_id FROM legacy_registrations WHERE season_tag = $1`,
    [SEASON_TAG],
  );
  const subscribers = await db.query<{ phone_raw: string }>(
    `SELECT phone_raw FROM legacy_whatsapp_subscribers WHERE season_tag = $1`,
    [SEASON_TAG],
  );

  return {
    kind: 'database',
    cities: new Map(
      cities.rows.map((r) => [
        r.slug,
        { slug: r.slug, nameEn: r.name_en, provinceCode: r.province_code, id: r.id },
      ]),
    ),
    areas: new Set(areas.rows.map((r) => `${r.city_slug}/${r.area_slug}`)),
    venueSlugs: new Map(venues.rows.map((r) => [r.slug, r.city_slug])),
    venueIdentities: new Set(
      venues.rows.map((r) => venueIdentity(r.city_slug, r.name_en, r.address_en)),
    ),
    registrationSourceIds: new Set(registrations.rows.map((r) => r.source_id)),
    subscriberPhones: new Set(subscribers.rows.map((r) => r.phone_raw)),
  };
}
