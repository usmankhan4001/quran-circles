import { VenueCreate, VenueUpdate, type Venue } from '@qc/contracts';
import type { MessageKey } from '../../i18n/translate';
import {
  bilingualOf,
  emptyBilingual,
  isBilingualEmpty,
  toLocalizedInput,
  toLocalizedOptional,
  type BilingualFields,
} from '../../lib/localized';
import { normalizePhone } from '../../lib/phone';

export const FACILITY_KEYS = [
  'womenSection',
  'parking',
  'wuduArea',
  'elderWheelchairAccess',
  'childFriendly',
] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];

export interface VenueForm {
  cityId: string | null;
  areaId: string | null;
  name: BilingualFields;
  address: BilingualFields;
  lat: string;
  lng: string;
  contactPhone: string;
  facilities: Record<FacilityKey, boolean>;
  entranceNotes: BilingualFields;
}

export type VenueErrors = Partial<
  Record<'city' | 'area' | 'name' | 'address' | 'lat' | 'lng' | 'phone' | 'nothing', MessageKey>
>;

export const emptyVenueForm = (cityId: string | null): VenueForm => ({
  cityId,
  areaId: null,
  name: emptyBilingual(),
  address: emptyBilingual(),
  lat: '',
  lng: '',
  contactPhone: '',
  facilities: {
    womenSection: false,
    parking: false,
    wuduArea: false,
    elderWheelchairAccess: false,
    childFriendly: false,
  },
  entranceNotes: emptyBilingual(),
});

export const venueFormOf = (v: Venue): VenueForm => ({
  cityId: v.cityId,
  areaId: v.areaId,
  name: bilingualOf(v.name),
  address: bilingualOf(v.address),
  lat: String(v.lat),
  lng: String(v.lng),
  contactPhone: v.contactPhone ?? '',
  facilities: {
    womenSection: v.facilities.womenSection,
    parking: v.facilities.parking,
    wuduArea: v.facilities.wuduArea,
    elderWheelchairAccess: v.facilities.elderWheelchairAccess,
    childFriendly: v.facilities.childFriendly,
  },
  entranceNotes: bilingualOf(v.facilities.entranceNotes),
});

const DECIMAL = /^-?\d{1,3}(\.\d+)?$/;

function coordinate(text: string, limit: number): number | null {
  const v = text.trim();
  if (!DECIMAL.test(v)) return null;
  const n = Number(v);
  return Math.abs(n) <= limit ? n : null;
}

export interface ValidatedVenue {
  errors: VenueErrors;
  create?: ReturnType<typeof VenueCreate.parse>;
  update?: ReturnType<typeof VenueUpdate.parse>;
}

const sameLocalized = (
  a: { en: string; ur: string | null } | null,
  b: { en: string; ur: string | null } | null,
): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Checks the venue form. With no `original` it builds a create request; with one it builds an
 * edit request that carries only what changed.
 */
export function validateVenue(form: VenueForm, original?: Venue): ValidatedVenue {
  const errors: VenueErrors = {};
  if (!original && !form.cityId) errors.city = 'admin.venueEditor.error.city';
  if (!form.areaId) errors.area = 'admin.venueEditor.error.area';
  if (isBilingualEmpty(form.name)) errors.name = 'admin.venueEditor.error.name';
  if (isBilingualEmpty(form.address)) errors.address = 'admin.venueEditor.error.address';
  const lat = coordinate(form.lat, 90);
  const lng = coordinate(form.lng, 180);
  if (lat === null) errors.lat = 'admin.venueEditor.error.lat';
  if (lng === null) errors.lng = 'admin.venueEditor.error.lng';
  let phone: string | null = null;
  if (form.contactPhone.trim()) {
    phone = normalizePhone(form.contactPhone);
    if (!phone) errors.phone = 'admin.venueEditor.error.phone';
  }
  if (Object.keys(errors).length > 0) return { errors };

  const name = toLocalizedOptional(form.name);
  const address = toLocalizedOptional(form.address);
  const notes = toLocalizedInput(form.entranceNotes);

  if (!original) {
    const parsed = VenueCreate.safeParse({
      cityId: form.cityId,
      areaId: form.areaId,
      name,
      address,
      lat,
      lng,
      contactPhone: phone,
      facilities: { ...form.facilities, ...(notes ? { entranceNotes: notes } : {}) },
    });
    return parsed.success
      ? { errors, create: parsed.data }
      : { errors: { name: 'errors.validation_failed' } };
  }

  const patch: Record<string, unknown> = {};
  if (form.areaId !== original.areaId) patch.areaId = form.areaId;
  if (!sameLocalized(toLocalizedInput(form.name), toLocalizedInput(bilingualOf(original.name)))) {
    patch.name = name;
  }
  if (
    !sameLocalized(toLocalizedInput(form.address), toLocalizedInput(bilingualOf(original.address)))
  ) {
    patch.address = address;
  }
  if (lat !== original.lat) patch.lat = lat;
  if (lng !== original.lng) patch.lng = lng;
  if (phone !== original.contactPhone) patch.contactPhone = phone;
  const facilities: Record<string, unknown> = {};
  for (const key of FACILITY_KEYS) {
    if (form.facilities[key] !== original.facilities[key]) facilities[key] = form.facilities[key];
  }
  if (!sameLocalized(notes, original.facilities.entranceNotes)) facilities.entranceNotes = notes;
  if (Object.keys(facilities).length > 0) patch.facilities = facilities;
  if (Object.keys(patch).length === 0)
    return { errors: { nothing: 'admin.venueEditor.error.nothing' } };
  const parsed = VenueUpdate.safeParse(patch);
  return parsed.success
    ? { errors, update: parsed.data }
    : { errors: { name: 'errors.validation_failed' } };
}
