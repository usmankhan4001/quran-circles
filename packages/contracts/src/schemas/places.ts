import { z } from 'zod';
import { Latitude, Localized, Longitude, PhoneE164, Uuid } from '../common';
import { VenueStatus } from '../enums';
import { lazy } from '../lazy';

export const Province = lazy(() => z.object({ id: Uuid, code: z.string(), name: Localized }));
export type Province = z.infer<typeof Province>;

export const City = lazy(() =>
  z.object({
    id: Uuid,
    provinceId: Uuid,
    slug: z.string(),
    name: Localized,
    timezone: z.string().meta({ examples: ['Asia/Karachi'] }),
  }),
);
export type City = z.infer<typeof City>;

export const Area = lazy(() =>
  z.object({
    id: Uuid,
    cityId: Uuid,
    slug: z.string(),
    name: Localized,
    lat: Latitude.nullable(),
    lng: Longitude.nullable(),
  }),
);
export type Area = z.infer<typeof Area>;

/** The fixed facilities checklist a venue coordinator fills in. */
export const VenueFacilities = lazy(() =>
  z.object({
    womenSection: z.boolean(),
    parking: z.boolean(),
    wuduArea: z.boolean(),
    elderWheelchairAccess: z.boolean(),
    childFriendly: z.boolean(),
    entranceNotes: Localized.nullable(),
  }),
);
export type VenueFacilities = z.infer<typeof VenueFacilities>;

/** Venues are public. The contact number is the venue's own public number, not a person's. */
export const Venue = lazy(() =>
  z
    .object({
      id: Uuid,
      cityId: Uuid,
      areaId: Uuid,
      slug: z.string(),
      name: Localized,
      address: Localized,
      lat: Latitude,
      lng: Longitude,
      contactPhone: PhoneE164.nullable(),
      facilities: VenueFacilities,
      status: VenueStatus,
    })
    .meta({ id: 'Venue' }),
);
export type Venue = z.infer<typeof Venue>;

export const VenueSummary = lazy(() =>
  z
    .object({
      id: Uuid,
      cityId: Uuid,
      areaId: Uuid,
      name: Localized,
      lat: Latitude,
      lng: Longitude,
    })
    .meta({ id: 'VenueSummary' }),
);
export type VenueSummary = z.infer<typeof VenueSummary>;

export const ProvincesResponse = lazy(() => z.object({ items: z.array(Province) }));
export const CitiesResponse = lazy(() => z.object({ items: z.array(City) }));
export const AreasResponse = lazy(() => z.object({ items: z.array(Area) }));

export const CitiesQuery = lazy(() => z.object({ provinceId: Uuid.optional() }));
export const AreasQuery = lazy(() => z.object({ cityId: Uuid }));
