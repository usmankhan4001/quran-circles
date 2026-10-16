import type { SqlExecutor } from '@qc/db';
import { SEASON_TAG } from './constants';
import { MigrationToolError } from './errors';
import type { Plan } from './plan';
import type { TargetState } from './target';

export interface Inserted {
  areas: number;
  venues: number;
  registrations: number;
  subscribers: number;
}

/** Rows per INSERT. Keeps parameter counts far below the protocol limit of 65535. */
const CHUNK = 250;

function chunks<T>(items: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Builds `($1,$2,...),($n,...)` for rows of `cells` values each, with optional casts. */
function valuesList(rowCount: number, casts: readonly string[]): string {
  const width = casts.length;
  const rows: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    rows.push(`(${casts.map((cast, c) => `$${r * width + c + 1}${cast}`).join(', ')})`);
  }
  return rows.join(', ');
}

/**
 * Writes the plan. Must be called inside an open transaction: the caller commits or rolls back.
 * Every statement is an INSERT ... ON CONFLICT DO NOTHING, so a repeat run adds nothing, and the
 * number of rows actually inserted is checked against the plan: a difference means the database
 * changed under the run, and the whole transaction is abandoned.
 */
export async function applyPlan(
  db: SqlExecutor,
  plan: Plan,
  target: TargetState,
): Promise<Inserted> {
  const cityId = (slug: string): string => {
    const id = target.cities.get(slug)?.id;
    if (!id) throw new MigrationToolError('unknown_city', 'A planned row refers to an unknown city');
    return id;
  };

  // Areas named in approved mapping rows (only when --create-areas was given).
  let areasInserted = 0;
  for (const area of plan.areas) {
    const result = await db.query<{ id: string }>(
      `INSERT INTO areas (city_id, slug, name_en, name_ur) VALUES ($1, $2, $3, $4)
       ON CONFLICT (city_id, slug) DO NOTHING RETURNING id`,
      [cityId(area.citySlug), area.slug, area.nameEn, area.nameUr],
    );
    areasInserted += result.rows.length;
  }
  if (areasInserted !== plan.areas.length) {
    throw new MigrationToolError('plan_mismatch', 'Inserted area count differs from the plan');
  }

  // Venues need area ids, which now all exist.
  const areaIds = new Map<string, string>();
  if (plan.venues.length > 0) {
    const areaRows = await db.query<{ city_slug: string; area_slug: string; id: string }>(
      `SELECT c.slug AS city_slug, a.slug AS area_slug, a.id
         FROM areas a JOIN cities c ON c.id = a.city_id`,
    );
    for (const r of areaRows.rows) areaIds.set(`${r.city_slug}/${r.area_slug}`, r.id);
  }
  let venuesInserted = 0;
  for (const batch of chunks(plan.venues)) {
    const params: unknown[] = [];
    for (const v of batch) {
      const areaId = areaIds.get(`${v.citySlug}/${v.areaSlug}`);
      if (!areaId) throw new MigrationToolError('unknown_area', 'A planned venue has no area');
      params.push(
        cityId(v.citySlug),
        areaId,
        v.slug,
        v.nameEn,
        v.nameUr,
        v.addressEn,
        v.addressUr,
        v.lat,
        v.lng,
        v.contactPhone,
      );
    }
    const result = await db.query(
      `INSERT INTO venues (city_id, area_id, slug, name_en, name_ur, address_en, address_ur, lat, lng, contact_phone)
       VALUES ${valuesList(batch.length, ['', '', '', '', '', '', '', '::double precision', '::double precision', ''])}
       ON CONFLICT (slug) DO NOTHING RETURNING id`,
      params,
    );
    venuesInserted += result.rows.length;
  }
  if (venuesInserted !== plan.venues.length) {
    throw new MigrationToolError('plan_mismatch', 'Inserted venue count differs from the plan');
  }

  let registrationsInserted = 0;
  for (const batch of chunks(plan.registrations)) {
    const params: unknown[] = [];
    for (const r of batch) {
      params.push(
        SEASON_TAG,
        r.sourceId,
        r.name,
        r.phone,
        r.cityName,
        r.venueName,
        null,
        r.registeredAt,
        JSON.stringify(r.raw),
      );
    }
    const result = await db.query(
      `INSERT INTO legacy_registrations
         (season_tag, source_id, name, phone_raw, city_name, venue_name, party_size, registered_at, raw)
       VALUES ${valuesList(batch.length, ['', '', '', '', '', '', '::integer', '::timestamptz', '::jsonb'])}
       ON CONFLICT (season_tag, source_id) DO NOTHING RETURNING id`,
      params,
    );
    registrationsInserted += result.rows.length;
  }
  if (registrationsInserted !== plan.registrations.length) {
    throw new MigrationToolError(
      'plan_mismatch',
      'Inserted registration count differs from the plan',
    );
  }

  // Subscribers: the table has no unique key on the phone, so the plan (made inside this same
  // transaction, under the advisory lock) is what keeps a repeat run from adding them twice.
  let subscribersInserted = 0;
  for (const batch of chunks(plan.subscribers)) {
    const params: unknown[] = [];
    for (const s of batch) params.push(SEASON_TAG, s.phone, s.name, true);
    const result = await db.query(
      `INSERT INTO legacy_whatsapp_subscribers (season_tag, phone_raw, name, needs_reconsent)
       VALUES ${valuesList(batch.length, ['', '', '', '::boolean'])} RETURNING id`,
      params,
    );
    subscribersInserted += result.rows.length;
  }

  return {
    areas: areasInserted,
    venues: venuesInserted,
    registrations: registrationsInserted,
    subscribers: subscribersInserted,
  };
}
