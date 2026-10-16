import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Venue, ScopeFilter, VenueCreate } from '@qc/contracts';
import type { VenueUpdate } from '../shared/types';
import { schema, type Db } from '../../db';
import { writeAudit, venueScope } from '../shared/audit';
import { fail, invalid } from '../shared/errors';
import { likePattern, selectVenueRecords, toVenue, venueLat, venueLng } from '../shared/mappers';
import { decodeOffsetCursor, offsetPage, type Page } from '../shared/pagination';

const { venues, areas } = schema;

/** Great-circle distance in kilometres between the venue (or its area) and a point. */
const distanceKm = (lat: number, lng: number) =>
  sql<number>`(6371 * acos(least(1, greatest(-1,
    cos(radians(${lat})) * cos(radians(${venueLat})) * cos(radians(${venueLng}) - radians(${lng}))
    + sin(radians(${lat})) * sin(radians(${venueLat}))))))`;

export interface PublicVenueQuery {
  cursor?: string | undefined;
  limit: number;
  cityId?: string | undefined;
  areaId?: string | undefined;
  q?: string | undefined;
  womenSection?: boolean | undefined;
  wheelchairAccess?: boolean | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
}

export async function listPublicVenues(db: Db, query: PublicVenueQuery): Promise<Page<Venue>> {
  const conditions: (SQL | undefined)[] = [eq(venues.status, 'active')];
  if (query.cityId) conditions.push(eq(venues.cityId, query.cityId));
  if (query.areaId) conditions.push(eq(venues.areaId, query.areaId));
  if (query.womenSection !== undefined) {
    conditions.push(eq(venues.hasWomenSection, query.womenSection));
  }
  if (query.wheelchairAccess !== undefined) {
    conditions.push(eq(venues.hasElderWheelchairAccess, query.wheelchairAccess));
  }
  if (query.q) {
    const pattern = likePattern(query.q);
    conditions.push(
      or(
        ilike(venues.nameEn, pattern),
        ilike(venues.nameUr, pattern),
        ilike(venues.addressEn, pattern),
        ilike(venues.addressUr, pattern),
      ),
    );
  }
  const offset = decodeOffsetCursor(query.cursor);
  const order =
    query.lat !== undefined && query.lng !== undefined
      ? [asc(distanceKm(query.lat, query.lng)), asc(venues.id)]
      : [asc(venues.nameEn), asc(venues.id)];
  const rows = await selectVenueRecords(db)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(rows, query.limit, offset);
  return { items: page.items.map(toVenue), nextCursor: page.nextCursor };
}

export async function findVenue(db: Db, venueId: string) {
  const [row] = await selectVenueRecords(db).where(eq(venues.id, venueId));
  return row ?? null;
}

export async function getPublicVenue(db: Db, venueId: string): Promise<Venue> {
  const row = await findVenue(db, venueId);
  if (!row || row.status !== 'active') return fail('not_found');
  return toVenue(row);
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

/** Venues a person may list: everything for a national admin, else their city or venue. */
export function venueScopeCondition(filter: ScopeFilter): SQL | undefined {
  if (filter.national) return undefined;
  const parts: SQL[] = [];
  if (filter.cityIds.length) parts.push(inArray(venues.cityId, filter.cityIds));
  if (filter.venueIds.length) parts.push(inArray(venues.id, filter.venueIds));
  return parts.length ? or(...parts) : sql`false`;
}

export async function listAdminVenues(
  db: Db,
  filter: ScopeFilter,
  query: {
    cursor?: string | undefined;
    limit: number;
    cityId?: string | undefined;
    includeArchived?: boolean | undefined;
  },
): Promise<Page<Venue>> {
  const conditions: (SQL | undefined)[] = [venueScopeCondition(filter)];
  if (query.cityId) conditions.push(eq(venues.cityId, query.cityId));
  if (!query.includeArchived) conditions.push(eq(venues.status, 'active'));
  const offset = decodeOffsetCursor(query.cursor);
  const rows = await selectVenueRecords(db)
    .where(and(...conditions))
    .orderBy(asc(venues.nameEn), desc(venues.id))
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(rows, query.limit, offset);
  return { items: page.items.map(toVenue), nextCursor: page.nextCursor };
}

const slugify = (text: string): string => {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'venue';
};

async function assertAreaInCity(db: Db, areaId: string, cityId: string): Promise<void> {
  const [area] = await db.select({ cityId: areas.cityId }).from(areas).where(eq(areas.id, areaId));
  if (!area || area.cityId !== cityId) invalid('areaId');
}

export async function cityExists(db: Db, cityId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.cities.id })
    .from(schema.cities)
    .where(eq(schema.cities.id, cityId));
  return !!row;
}

export async function createVenue(db: Db, actorId: string, input: VenueCreate): Promise<Venue> {
  await assertAreaInCity(db, input.areaId, input.cityId);
  const f = input.facilities;
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(venues)
      .values({
        cityId: input.cityId,
        areaId: input.areaId,
        slug: `${slugify(input.name.en)}-${randomBytes(3).toString('hex')}`,
        nameEn: input.name.en,
        nameUr: input.name.ur ?? input.name.en,
        addressEn: input.address.en,
        addressUr: input.address.ur ?? input.address.en,
        lat: input.lat,
        lng: input.lng,
        contactPhone: input.contactPhone,
        hasWomenSection: f.womenSection ?? false,
        hasParking: f.parking ?? false,
        hasWuduArea: f.wuduArea ?? false,
        hasElderWheelchairAccess: f.elderWheelchairAccess ?? false,
        isChildFriendly: f.childFriendly ?? false,
        entranceNotesEn: f.entranceNotes?.en ?? null,
        entranceNotesUr: f.entranceNotes?.ur ?? null,
      })
      .returning({ id: venues.id });
    if (!row) throw new Error('venue insert returned no row');
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'venue.create',
      entityType: 'venue',
      entityId: row.id,
      scope: venueScope({ id: row.id, cityId: input.cityId }),
    });
    return row.id;
  });
  return toVenue((await findVenue(db, id))!);
}

export async function updateVenue(
  db: Db,
  actorId: string,
  venueId: string,
  cityId: string,
  patch: VenueUpdate,
): Promise<Venue> {
  if (patch.areaId) await assertAreaInCity(db, patch.areaId, cityId);
  const set: Partial<typeof venues.$inferInsert> = {};
  const fields: string[] = [];
  const take = <K extends keyof typeof set>(key: K, value: (typeof set)[K], name: string) => {
    set[key] = value;
    fields.push(name);
  };
  if (patch.areaId) take('areaId', patch.areaId, 'areaId');
  if (patch.name) {
    take('nameEn', patch.name.en, 'name');
    if (patch.name.ur !== undefined) set.nameUr = patch.name.ur ?? patch.name.en;
  }
  if (patch.address) {
    take('addressEn', patch.address.en, 'address');
    if (patch.address.ur !== undefined) set.addressUr = patch.address.ur ?? patch.address.en;
  }
  if (patch.lat !== undefined) take('lat', patch.lat, 'lat');
  if (patch.lng !== undefined) take('lng', patch.lng, 'lng');
  if (patch.contactPhone !== undefined) take('contactPhone', patch.contactPhone, 'contactPhone');
  const f = patch.facilities;
  if (f) {
    if (f.womenSection !== undefined) take('hasWomenSection', f.womenSection, 'facilities');
    if (f.parking !== undefined) take('hasParking', f.parking, 'facilities');
    if (f.wuduArea !== undefined) take('hasWuduArea', f.wuduArea, 'facilities');
    if (f.elderWheelchairAccess !== undefined) {
      take('hasElderWheelchairAccess', f.elderWheelchairAccess, 'facilities');
    }
    if (f.childFriendly !== undefined) take('isChildFriendly', f.childFriendly, 'facilities');
    if (f.entranceNotes !== undefined) {
      take('entranceNotesEn', f.entranceNotes?.en ?? null, 'facilities');
      set.entranceNotesUr = f.entranceNotes?.ur ?? null;
    }
  }
  await db.transaction(async (tx) => {
    if (Object.keys(set).length > 0) {
      await tx
        .update(venues)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(venues.id, venueId));
    }
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'venue.update',
      entityType: 'venue',
      entityId: venueId,
      scope: venueScope({ id: venueId, cityId }),
      meta: { fields: [...new Set(fields)] },
    });
  });
  return toVenue((await findVenue(db, venueId))!);
}

export async function archiveVenue(
  db: Db,
  actorId: string,
  venueId: string,
  cityId: string,
): Promise<Venue> {
  await db.transaction(async (tx) => {
    await tx
      .update(venues)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(venues.id, venueId));
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'venue.archive',
      entityType: 'venue',
      entityId: venueId,
      scope: venueScope({ id: venueId, cityId }),
    });
  });
  return toVenue((await findVenue(db, venueId))!);
}
