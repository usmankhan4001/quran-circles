import { eq, sql } from 'drizzle-orm';
import type { Localized, Venue, VenueSummary } from '@qc/contracts';
import { schema, type Db } from '../../db';

const { venues, areas } = schema;

export const localized = (en: string, ur: string | null): Localized =>
  ({ en, ur: ur && ur.trim() !== '' ? ur : null }) as Localized;

/**
 * Venue columns for the contract. A venue without its own map position (an imported one) falls
 * back to its area's position, then to 0,0, so the response always matches the schema.
 */
export const venueLat = sql<number>`coalesce(${venues.lat}, ${areas.lat}, 0)`.mapWith(Number);
export const venueLng = sql<number>`coalesce(${venues.lng}, ${areas.lng}, 0)`.mapWith(Number);

export const venueColumns = {
  id: venues.id,
  cityId: venues.cityId,
  areaId: venues.areaId,
  slug: venues.slug,
  nameEn: venues.nameEn,
  nameUr: venues.nameUr,
  addressEn: venues.addressEn,
  addressUr: venues.addressUr,
  lat: venueLat,
  lng: venueLng,
  contactPhone: venues.contactPhone,
  hasWomenSection: venues.hasWomenSection,
  hasParking: venues.hasParking,
  hasWuduArea: venues.hasWuduArea,
  hasElderWheelchairAccess: venues.hasElderWheelchairAccess,
  isChildFriendly: venues.isChildFriendly,
  entranceNotesEn: venues.entranceNotesEn,
  entranceNotesUr: venues.entranceNotesUr,
  status: venues.status,
};

export const selectVenueRecords = (db: Db) =>
  db.select(venueColumns).from(venues).innerJoin(areas, eq(areas.id, venues.areaId));

export type VenueRecord = Awaited<ReturnType<typeof selectVenueRecords>>[number];

export function toVenue(r: VenueRecord): Venue {
  return {
    id: r.id,
    cityId: r.cityId,
    areaId: r.areaId,
    slug: r.slug,
    name: localized(r.nameEn, r.nameUr),
    address: localized(r.addressEn, r.addressUr),
    lat: r.lat,
    lng: r.lng,
    contactPhone: r.contactPhone,
    facilities: {
      womenSection: r.hasWomenSection,
      parking: r.hasParking,
      wuduArea: r.hasWuduArea,
      elderWheelchairAccess: r.hasElderWheelchairAccess,
      childFriendly: r.isChildFriendly,
      entranceNotes: r.entranceNotesEn ? localized(r.entranceNotesEn, r.entranceNotesUr) : null,
    },
    status: r.status,
  };
}

export const toVenueSummary = (r: VenueRecord): VenueSummary => ({
  id: r.id,
  cityId: r.cityId,
  areaId: r.areaId,
  name: localized(r.nameEn, r.nameUr),
  lat: r.lat,
  lng: r.lng,
});

/** Escape `%`, `_` and `\` so user text matches literally in a LIKE pattern. */
export const likePattern = (text: string): string => `%${text.replace(/[\\%_]/g, '\\$&')}%`;
