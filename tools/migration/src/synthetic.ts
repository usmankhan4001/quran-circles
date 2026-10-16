import { formatCsv } from './csv';
import { proposeMapping } from './places';
import { V1VenueRow } from './v1';

/**
 * Synthetic V1 data in the shape of V1's tables, for tests and for trying the tool. Nobody in
 * it is real: names are "Test Person N", venues are "Sample ...", and phone numbers are
 * `+92300` followed by seven digits, the same convention as the other packages' fixtures.
 * `fixtures/*.json|csv` are generated from this file; a test keeps them in step.
 */

/** National part (10 digits) of the synthetic number N. */
export const fakeNational = (n: number): string => `300${String(n).padStart(7, '0')}`;

/** The same number in the different ways people type it. */
export const phoneForms = (n: number) => {
  const nat = fakeNational(n);
  return {
    e164: `+92${nat}`,
    national: `0${nat}`,
    spaced: `0${nat.slice(0, 3)} ${nat.slice(3)}`,
    dashed: `0${nat.slice(0, 3)}-${nat.slice(3)}`,
    v1Digits: `92${nat}`,
    plus: `+92 ${nat.slice(0, 3)} ${nat.slice(3)}`,
    trunkZero: `+920${nat}`,
    bare: nat,
    urduDigits: `0${nat}`.replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d))),
  };
};

const venueId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export interface SyntheticVenue {
  id: string;
  created_at: string;
  name: string;
  venue: string;
  address: string;
  lat: number;
  lng: number;
  contact: string | null;
  organizer: string;
  timing: string;
  category: string;
  google_maps_link: string;
}

const venueRow = (
  n: number,
  label: string,
  venue: string,
  address: string,
  lat: number,
  lng: number,
  contact: string | null,
  createdDay = n,
): SyntheticVenue => ({
  id: venueId(n),
  created_at: `2026-02-${String(createdDay).padStart(2, '0')}T10:00:00.000Z`,
  name: label,
  venue,
  address,
  lat,
  lng,
  contact,
  organizer: 'Sample Team',
  timing: '08:00 PM',
  category: 'Religious',
  google_maps_link: `https://maps.example.test/sample-${n}`,
});

/**
 * V1 `programs` rows. Ids 1 to 7 are clean venues across four cities; the rest each trigger
 * one rule: 8 duplicate, 9 swapped coordinates, 10 left unapproved, 11 city not in V2, 12 bad
 * contact, 13 same name in another city, 14 missing address.
 */
export function syntheticVenues(): SyntheticVenue[] {
  return [
    venueRow(1, 'Sample Saddar', 'Sample Masjid Al-Noor', 'Street 4, Saddar, Rawalpindi (sample address)', 33.5961, 73.0483, phoneForms(1).spaced),
    venueRow(2, 'Sample Satellite Town', 'Sample Markaz Iqra', 'Block B, Satellite Town, Rawalpindi (sample address)', 33.6361, 73.0722, phoneForms(2).plus),
    venueRow(3, 'Sample F-7', 'Sample Masjid Hira', 'Jinnah Super, F-7, Islamabad (sample address)', 33.7218, 73.0568, phoneForms(3).dashed),
    venueRow(4, 'Sample G-9', 'Sample Darul Quran', 'Markaz, G-9 (sample address)', 33.6924, 73.0359, null),
    venueRow(5, 'Sample Johar Town', 'Sample Masjid Bilal', 'Block C, Johar Town, Lahore (sample address)', 31.47, 74.2731, phoneForms(5).national),
    venueRow(6, 'Sample Gulberg', 'Sample Masjid Ayesha', 'Main Boulevard, Gulberg, Lahore (sample address)', 31.5207, 74.349, phoneForms(6).e164),
    venueRow(7, 'Sample Multan Cantt', 'Sample Masjid Usman', 'Street 2, Cantt, Multan (sample address)', 30.1981, 71.4701, phoneForms(7).v1Digits),
    // 8: the same venue entered twice (later copy is the duplicate).
    venueRow(8, 'Sample Saddar', 'Sample Masjid Al-Noor', 'Street 4, Saddar, Rawalpindi (sample address)', 33.5961, 73.0483, phoneForms(1).spaced, 20),
    // 9: latitude and longitude swapped.
    venueRow(9, 'Sample Swapped', 'Sample Masjid Swapped', 'Main Road, Faisalabad (sample address)', 73.135, 31.4504, null),
    // 10: valid, but the reviewer has not approved it.
    venueRow(10, 'Sample City Centre', 'Sample Masjid Pending', 'Clock Tower, Faisalabad (sample address)', 31.4181, 73.0791, null),
    // 11: the reviewer mapped it to a city V2 does not have.
    venueRow(11, 'Sample Elsewhere', 'Sample Masjid Elsewhere', 'Main Road, Karachi (sample address)', 24.8607, 67.0011, null),
    // 12: contact number is not a number.
    venueRow(12, 'Sample Wah Town', 'Sample Masjid Wah', 'GT Road, Wah Cantt (sample address)', 33.7715, 72.7511, 'call the office'),
    // 13: same venue name as 5, different city (registrations at this name are ambiguous).
    venueRow(13, 'Sample Gulgasht', 'Sample Masjid Bilal', 'Block D, Gulgasht, Multan (sample address)', 30.2109, 71.4965, null),
    // 14: no address at all.
    { ...venueRow(14, 'Sample No Address', 'Sample Masjid Blank', '', 31.5, 74.3, null), address: '' },
  ];
}

export interface SyntheticRegistration {
  id: number;
  timestamp: string;
  location: string;
  read: string;
  want: string;
  name: string;
  mobile: string;
  age: string;
  profession: string;
  education: string;
  area: string;
}

const registration = (
  id: number,
  location: string,
  person: number,
  mobile: string,
  timestamp = `2026-02-${String(18 + (id % 9)).padStart(2, '0')}T14:00:00.000Z`,
  name = `Test Person ${person}`,
): SyntheticRegistration => ({
  id,
  timestamp,
  location,
  read: 'sometimes',
  want: 'learn',
  name,
  mobile,
  age: '30s',
  profession: 'Sample profession',
  education: 'Sample education',
  area: 'Sample area',
});

/** V1 `registeration` rows. The form stored phones as digits with 0 replaced by 92. */
export function syntheticRegistrations(): SyntheticRegistration[] {
  const noor = 'Sample Masjid Al-Noor';
  return [
    registration(1, noor, 1, phoneForms(101).v1Digits),
    registration(2, noor, 2, phoneForms(102).v1Digits),
    registration(3, 'Sample Markaz Iqra', 3, phoneForms(103).v1Digits),
    registration(4, 'Sample Masjid Hira', 4, phoneForms(104).national),
    registration(5, 'Sample Darul Quran', 5, phoneForms(105).v1Digits),
    registration(6, 'Sample Masjid Ayesha', 6, phoneForms(106).v1Digits),
    registration(7, 'Sample Masjid Usman', 7, phoneForms(107).urduDigits),
    // 8: person 1 again at the same venue, typed differently, later: a duplicate.
    registration(8, noor, 1, phoneForms(101).spaced, '2026-02-27T20:00:00.000Z'),
    // 9: person 1 at a different venue: a separate registration.
    registration(9, 'Sample Markaz Iqra', 1, phoneForms(101).v1Digits),
    // 10, 11: phone numbers that are not numbers.
    registration(10, noor, 8, '12345'),
    registration(11, noor, 9, 'not a number'),
    // 12: the venue name exists in two cities.
    registration(12, 'Sample Masjid Bilal', 10, phoneForms(110).v1Digits),
    // 13: a venue that is not in V1's list.
    registration(13, 'Sample Hall Nowhere', 11, phoneForms(111).v1Digits),
    // 14: no name.
    registration(14, noor, 12, phoneForms(112).v1Digits, undefined, ''),
    // 15: a venue whose mapping is not approved.
    registration(15, 'Sample Masjid Pending', 13, phoneForms(113).v1Digits),
    // 16: timestamp is not a date.
    registration(16, noor, 14, phoneForms(114).v1Digits, 'last tuesday'),
    // 17: an overseas number typed with a plus.
    registration(17, noor, 15, '+971500000115'),
  ];
}

export interface SyntheticSubscriber {
  phone: string;
  venue: string;
  name: string;
}

/** V1 `whatsapp_subscribers` rows. `name` is the program label, as V1's form filled it. */
export function syntheticSubscribers(): SyntheticSubscriber[] {
  return [
    { phone: phoneForms(201).v1Digits, venue: 'Sample Masjid Al-Noor', name: 'Sample Saddar' },
    { phone: phoneForms(202).v1Digits, venue: 'Sample Masjid Hira', name: 'Sample F-7' },
    { phone: phoneForms(203).v1Digits, venue: 'Sample Masjid Ayesha', name: 'Sample Gulberg' },
    // Same number as 201 typed another way: a duplicate.
    { phone: phoneForms(201).national, venue: 'Sample Masjid Al-Noor', name: 'Sample Saddar' },
    { phone: '0300', venue: 'Sample Masjid Al-Noor', name: 'Sample Saddar' },
    // A venue the migration cannot place is still a valid subscriber.
    { phone: phoneForms(204).v1Digits, venue: 'Sample Hall Nowhere', name: 'Sample Nowhere' },
  ];
}

/**
 * The reviewed mapping for the synthetic venues: the tool's own proposal with every row
 * approved except venue 10 (left for review) and venue 11 (sent to a city V2 lacks).
 */
export function syntheticMappingCsv(): string {
  const venues = syntheticVenues().flatMap((v) => {
    const parsed = V1VenueRow.safeParse(v);
    return parsed.success ? [parsed.data] : [];
  });
  const rows = proposeMapping(venues);
  const header = rows[0]!;
  const col = (name: string) => header.indexOf(name);
  for (const row of rows.slice(1)) {
    const id = row[col('v1_id')]!;
    if (id === venueId(10)) continue;
    if (id === venueId(11)) {
      row[col('city_slug')] = 'karachi';
      row[col('area_slug')] = 'sample-elsewhere';
      row[col('area_name_en')] = 'Sample Elsewhere';
      row[col('province_code')] = 'SD';
    }
    row[col('approved')] = 'yes';
  }
  return formatCsv(rows);
}
