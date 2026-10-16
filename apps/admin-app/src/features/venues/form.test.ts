import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import { emptyVenueForm, venueFormOf, validateVenue, type VenueForm } from './form';

const venue = fx.venues[0]!;
const filled = (patch: Partial<VenueForm> = {}): VenueForm => ({
  ...emptyVenueForm(fx.cities[0]!.id),
  areaId: fx.areas[0]!.id,
  name: { en: 'Sample Masjid', ur: '' },
  address: { en: 'Street 4, Saddar', ur: '' },
  lat: '33.5961',
  lng: '73.0483',
  ...patch,
});

describe('validateVenue (create)', () => {
  it('builds a create request with the facilities checklist', () => {
    const form = filled({
      contactPhone: '0300 1234567',
      facilities: { ...emptyVenueForm(null).facilities, womenSection: true, parking: true },
      entranceNotes: { en: 'Side gate', ur: '' },
    });
    const { errors, create } = validateVenue(form);
    expect(errors).toEqual({});
    expect(create).toMatchObject({
      cityId: fx.cities[0]!.id,
      areaId: fx.areas[0]!.id,
      name: { en: 'Sample Masjid' },
      lat: 33.5961,
      lng: 73.0483,
      contactPhone: '+923001234567',
      facilities: {
        womenSection: true,
        parking: true,
        wuduArea: false,
        entranceNotes: { en: 'Side gate' },
      },
    });
  });

  it('copies Urdu-only text into the required English text', () => {
    const { create } = validateVenue(
      filled({ name: { en: '', ur: 'نمونہ مسجد' }, address: { en: '', ur: 'گلی 4' } }),
    );
    expect(create?.name).toEqual({ en: 'نمونہ مسجد', ur: 'نمونہ مسجد' });
  });

  it('reports every missing piece at once', () => {
    const { errors, create } = validateVenue(emptyVenueForm(null));
    expect(create).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(['address', 'area', 'city', 'lat', 'lng', 'name']);
  });

  it('rejects coordinates outside the earth and text that is not a number', () => {
    expect(validateVenue(filled({ lat: '91' })).errors.lat).toBe('admin.venueEditor.error.lat');
    expect(validateVenue(filled({ lng: '-181' })).errors.lng).toBe('admin.venueEditor.error.lng');
    expect(validateVenue(filled({ lat: 'north' })).errors.lat).toBe('admin.venueEditor.error.lat');
  });

  it('accepts no phone number but rejects one that is not a number', () => {
    expect(validateVenue(filled({ contactPhone: '' })).create?.contactPhone).toBeNull();
    expect(validateVenue(filled({ contactPhone: '12' })).errors.phone).toBe(
      'admin.venueEditor.error.phone',
    );
  });
});

describe('validateVenue (edit)', () => {
  it('sends only what changed', () => {
    const form = venueFormOf(venue);
    form.facilities = { ...form.facilities, childFriendly: true };
    const { update, errors } = validateVenue(form, venue);
    expect(errors).toEqual({});
    expect(update).toEqual({ facilities: { childFriendly: true } });
  });

  it('sends a changed name, address and pin together with the facilities that changed', () => {
    const form = venueFormOf(venue);
    form.name = { ...form.name, en: 'Renamed Masjid' };
    form.lat = '33.6';
    form.facilities = { ...form.facilities, parking: false };
    const { update } = validateVenue(form, venue);
    expect(update).toMatchObject({
      name: { en: 'Renamed Masjid' },
      lat: 33.6,
      facilities: { parking: false },
    });
    expect(update).not.toHaveProperty('address');
    expect(update).not.toHaveProperty('lng');
  });

  it('clears the contact number with null', () => {
    const form = venueFormOf(venue);
    form.contactPhone = '';
    expect(validateVenue(form, venue).update).toEqual({ contactPhone: null });
  });

  it('says so when nothing changed', () => {
    const result = validateVenue(venueFormOf(venue), venue);
    expect(result.update).toBeUndefined();
    expect(result.errors.nothing).toBe('admin.venueEditor.error.nothing');
  });

  it('round-trips a venue through the form without inventing changes', () => {
    for (const v of fx.venues) {
      expect(validateVenue(venueFormOf(v), v).errors.nothing).toBe(
        'admin.venueEditor.error.nothing',
      );
    }
  });
});
