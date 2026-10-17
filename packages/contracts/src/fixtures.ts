import type { Area, City, Province, Venue } from './schemas/places';
import type { AdminOccurrence, AdminSession, Occurrence, Session } from './schemas/sessions';
import type { AdminCircle, VenueCreate } from './schemas/admin';
import type { ContentPage } from './schemas/config';
import type { Me, StaffRegistration } from './schemas/people';
import type { Update } from './schemas/updates';
import type {
  CommunityToday,
  DailyAyahEntry,
  MemorisationEntry,
  ReadingDay,
} from './schemas/reading';
import type { Poster, PosterSourceSnapshot, PosterTemplate } from './schemas/posters';
import { DEMO_POSTER_TEMPLATES, posterSnapshotFromSession } from './posters';

/**
 * Synthetic development data in the shape of the contract. No real people, venues or numbers.
 * The mock server serves it and the database seed (`@qc/db`) inserts it, so both agree.
 * Venue names carry the word "Sample" on purpose.
 */

const KIND = {
  province: '01',
  city: '02',
  area: '03',
  venue: '04',
  circle: '05',
  session: '06',
  occurrence: '07',
  season: '08',
  program: '09',
  user: '0a',
  update: '0b',
  registration: '0c',
  role: '0d',
  challenge: '0e',
  dailyAyah: '0f',
  poster: '10',
  posterTemplate: '11',
} as const;

/** A stable, valid UUID for fixture number `n` of a kind. */
export const fixtureId = (kind: keyof typeof KIND, n: number): string =>
  `00000000-0000-4000-8000-${KIND[kind]}${String(n).padStart(10, '0')}`;

/** Fixtures behave as if "now" is this instant, so mock data and tests are repeatable. */
export const FIXTURE_NOW = '2027-02-15T08:00:00Z';
const FIRST_DAY = '2027-02-15';

const loc = (en: string, ur: string) => ({ en, ur });

export const provinces: Province[] = [
  { id: fixtureId('province', 1), code: 'PB', name: loc('Punjab', 'پنجاب') },
  {
    id: fixtureId('province', 2),
    code: 'ICT',
    name: loc('Islamabad Capital Territory', 'وفاقی دارالحکومت اسلام آباد'),
  },
  { id: fixtureId('province', 3), code: 'KP', name: loc('Khyber Pakhtunkhwa', 'خیبر پختونخوا') },
];

const cityRows: [string, string, number, string, string][] = [
  // slug, english, province, urdu
  ['rawalpindi', 'Rawalpindi', 1, 'راولپنڈی', ''],
  ['islamabad', 'Islamabad', 2, 'اسلام آباد', ''],
  ['multan', 'Multan', 1, 'ملتان', ''],
  ['faisalabad', 'Faisalabad', 1, 'فیصل آباد', ''],
  ['wah-cantt', 'Wah Cantt', 1, 'واہ کینٹ', ''],
  ['murree', 'Murree', 1, 'مری', ''],
  ['kot-addu', 'Kot Addu', 1, 'کوٹ ادو', ''],
  ['abbottabad', 'Abbottabad', 3, 'ایبٹ آباد', ''],
  ['lahore', 'Lahore', 1, 'لاہور', ''],
];

export const cities: City[] = cityRows.map(([slug, en, prov, ur], i) => ({
  id: fixtureId('city', i + 1),
  provinceId: fixtureId('province', prov),
  slug,
  name: loc(en, ur),
  timezone: 'Asia/Karachi',
}));

const cityId = (slug: string): string => cities.find((c) => c.slug === slug)!.id;

const areaRows: [string, string, string, string, number, number][] = [
  // city slug, area slug, english, urdu, lat, lng
  ['rawalpindi', 'saddar', 'Saddar', 'صدر', 33.5958, 73.0479],
  ['rawalpindi', 'satellite-town', 'Satellite Town', 'سیٹلائٹ ٹاؤن', 33.6358, 73.0719],
  ['rawalpindi', 'bahria-town', 'Bahria Town', 'بحریہ ٹاؤن', 33.5288, 73.1219],
  ['islamabad', 'f-7', 'F-7', 'ایف سیون', 33.7215, 73.0565],
  ['islamabad', 'g-9', 'G-9', 'جی نائن', 33.6921, 73.0356],
  ['islamabad', 'i-8', 'I-8', 'آئی ایٹ', 33.6672, 73.0753],
  ['lahore', 'johar-town', 'Johar Town', 'جوہر ٹاؤن', 31.4697, 74.2728],
  ['lahore', 'gulberg', 'Gulberg', 'گلبرگ', 31.5204, 74.3487],
  ['lahore', 'model-town', 'Model Town', 'ماڈل ٹاؤن', 31.4833, 74.3167],
  ['multan', 'cantt', 'Multan Cantt', 'ملتان چھاؤنی', 30.1978, 71.4697],
  ['multan', 'gulgasht', 'Gulgasht', 'گلگشت', 30.2109, 71.4965],
  ['faisalabad', 'city-centre', 'City Centre', 'سٹی سینٹر', 31.4504, 73.135],
  ['wah-cantt', 'city-centre', 'City Centre', 'سٹی سینٹر', 33.7715, 72.7511],
  ['murree', 'city-centre', 'City Centre', 'سٹی سینٹر', 33.9062, 73.3903],
  ['kot-addu', 'city-centre', 'City Centre', 'سٹی سینٹر', 30.4697, 70.9631],
  ['abbottabad', 'city-centre', 'City Centre', 'سٹی سینٹر', 34.1688, 73.2215],
];

export const areas: Area[] = areaRows.map(([city, slug, en, ur, lat, lng], i) => ({
  id: fixtureId('area', i + 1),
  cityId: cityId(city),
  slug,
  name: loc(en, ur),
  lat,
  lng,
}));

const areaId = (city: string, slug: string): string =>
  areas.find((a) => a.cityId === cityId(city) && a.slug === slug)!.id;

const noFacilities = {
  womenSection: false,
  parking: false,
  wuduArea: false,
  elderWheelchairAccess: false,
  childFriendly: false,
  entranceNotes: null,
};

const venueRows: {
  city: string;
  area: string;
  slug: string;
  en: string;
  ur: string;
  address: [string, string];
  lat: number;
  lng: number;
  phone: string | null;
  facilities: Partial<Venue['facilities']>;
}[] = [
  {
    city: 'rawalpindi',
    area: 'saddar',
    slug: 'sample-masjid-al-noor',
    en: 'Sample Masjid Al-Noor',
    ur: 'نمونہ مسجد النور',
    address: ['Street 4, Saddar (sample address)', 'گلی 4، صدر (نمونہ پتہ)'],
    lat: 33.5961,
    lng: 73.0483,
    phone: '+923000000001',
    facilities: { womenSection: true, parking: true, wuduArea: true, elderWheelchairAccess: true },
  },
  {
    city: 'rawalpindi',
    area: 'satellite-town',
    slug: 'sample-markaz-iqra',
    en: 'Sample Markaz Iqra',
    ur: 'نمونہ مرکز اقرا',
    address: ['Block B, Satellite Town (sample address)', 'بلاک بی، سیٹلائٹ ٹاؤن (نمونہ پتہ)'],
    lat: 33.6361,
    lng: 73.0722,
    phone: '+923000000002',
    facilities: { womenSection: true, wuduArea: true, childFriendly: true },
  },
  {
    city: 'islamabad',
    area: 'f-7',
    slug: 'sample-masjid-hira',
    en: 'Sample Masjid Hira',
    ur: 'نمونہ مسجد حرا',
    address: ['Jinnah Super, F-7 (sample address)', 'جناح سپر، ایف سیون (نمونہ پتہ)'],
    lat: 33.7218,
    lng: 73.0568,
    phone: '+923000000003',
    facilities: { womenSection: true, parking: true, wuduArea: true },
  },
  {
    city: 'islamabad',
    area: 'g-9',
    slug: 'sample-darul-quran',
    en: 'Sample Darul Quran',
    ur: 'نمونہ دار القرآن',
    address: ['Markaz, G-9 (sample address)', 'مرکز، جی نائن (نمونہ پتہ)'],
    lat: 33.6924,
    lng: 73.0359,
    phone: null,
    facilities: { parking: true, elderWheelchairAccess: true },
  },
  {
    city: 'lahore',
    area: 'johar-town',
    slug: 'sample-masjid-bilal',
    en: 'Sample Masjid Bilal',
    ur: 'نمونہ مسجد بلال',
    address: ['Block C, Johar Town (sample address)', 'بلاک سی، جوہر ٹاؤن (نمونہ پتہ)'],
    lat: 31.47,
    lng: 74.2731,
    phone: '+923000000005',
    facilities: { womenSection: true, parking: true, wuduArea: true, childFriendly: true },
  },
  {
    city: 'lahore',
    area: 'gulberg',
    slug: 'sample-masjid-ayesha',
    en: 'Sample Masjid Ayesha',
    ur: 'نمونہ مسجد عائشہ',
    address: ['Main Boulevard, Gulberg (sample address)', 'مین بلیوارڈ، گلبرگ (نمونہ پتہ)'],
    lat: 31.5207,
    lng: 74.349,
    phone: '+923000000006',
    facilities: { womenSection: true, wuduArea: true, elderWheelchairAccess: true },
  },
  {
    city: 'multan',
    area: 'cantt',
    slug: 'sample-masjid-usman',
    en: 'Sample Masjid Usman',
    ur: 'نمونہ مسجد عثمان',
    address: ['Cantt Road, Multan (sample address)', 'کینٹ روڈ، ملتان (نمونہ پتہ)'],
    lat: 30.1981,
    lng: 71.47,
    phone: '+923000000007',
    facilities: { parking: true, wuduArea: true },
  },
  {
    city: 'abbottabad',
    area: 'city-centre',
    slug: 'sample-masjid-sidique',
    en: 'Sample Masjid Siddique',
    ur: 'نمونہ مسجد صدیق',
    address: ['Mall Road, Abbottabad (sample address)', 'مال روڈ، ایبٹ آباد (نمونہ پتہ)'],
    lat: 34.1691,
    lng: 73.2218,
    phone: null,
    facilities: { womenSection: true },
  },
];

export const venues: Venue[] = venueRows.map((v, i) => ({
  id: fixtureId('venue', i + 1),
  cityId: cityId(v.city),
  areaId: areaId(v.city, v.area),
  slug: v.slug,
  name: loc(v.en, v.ur),
  address: loc(v.address[0], v.address[1]),
  lat: v.lat,
  lng: v.lng,
  contactPhone: v.phone,
  facilities: {
    ...noFacilities,
    ...v.facilities,
    entranceNotes:
      i === 0 ? loc('Women enter from the side gate.', 'خواتین کے لیے ساتھ والا دروازہ ہے۔') : null,
  },
  status: 'active',
}));

export const programs = [
  { id: fixtureId('program', 1), key: 'dora' as const, name: loc('Dora', 'دورہ') },
  { id: fixtureId('program', 2), key: 'circles' as const, name: loc('Circles', 'سرکلز') },
];

export const seasons = [
  {
    id: fixtureId('season', 1),
    programId: fixtureId('program', 1),
    name: 'Ramadan 2027 (sample)',
    startsOn: '2027-02-08',
    endsOn: '2027-03-09',
    hijriYear: 1448,
    isActive: true,
  },
];

export const circles: AdminCircle[] = [
  {
    id: fixtureId('circle', 1),
    venueId: fixtureId('venue', 1),
    cityId: cityId('rawalpindi'),
    name: loc('Tuesday Tajweed Circle (sample)', 'منگل تجوید سرکل (نمونہ)'),
    teacherName: 'Sample Teacher',
    description: loc(
      'A relaxed weekly class on reading with tajweed.',
      'تجوید کے ساتھ پڑھنے کی ہلکی پھلکی ہفتہ وار کلاس۔',
    ),
    language: 'ur',
    section: 'family',
    onlineLink: null,
    status: 'published',
    createdAt: '2027-01-10T06:00:00Z',
    approvedAt: '2027-01-11T06:00:00Z',
  },
  {
    id: fixtureId('circle', 2),
    venueId: fixtureId('venue', 5),
    cityId: cityId('lahore'),
    name: loc('Sisters Quran Circle (sample)', 'بہنوں کا قرآن سرکل (نمونہ)'),
    teacherName: null,
    description: null,
    language: 'ur',
    section: 'women',
    onlineLink: null,
    status: 'pending_approval',
    createdAt: '2027-02-01T06:00:00Z',
    approvedAt: null,
  },
];

// Sessions -----------------------------------------------------------------------------------

interface SessionRow {
  n: number;
  venue: number;
  circle: number | null;
  program: 'dora' | 'circles';
  kind: 'recurring' | 'one_off';
  title: [string, string];
  section: 'women' | 'men' | 'family';
  language: 'en' | 'ur';
  time: string;
  minutes: number;
  days: number[];
  startsOn: string;
  endsOn: string | null;
  capacity: number | null;
  seatsTaken: number | null;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const sessionRows: SessionRow[] = [
  {
    n: 1,
    venue: 1,
    circle: null,
    program: 'dora',
    kind: 'recurring',
    title: ['Taraweeh with Dora (sample)', 'تراویح مع دورہ (نمونہ)'],
    section: 'family',
    language: 'ur',
    time: '21:00',
    minutes: 150,
    days: ALL_DAYS,
    startsOn: '2027-02-08',
    endsOn: '2027-03-09',
    capacity: null,
    seatsTaken: null,
  },
  {
    n: 2,
    venue: 2,
    circle: null,
    program: 'dora',
    kind: 'recurring',
    title: ['Women Dora (sample)', 'خواتین دورہ (نمونہ)'],
    section: 'women',
    language: 'ur',
    time: '16:30',
    minutes: 90,
    days: ALL_DAYS,
    startsOn: '2027-02-08',
    endsOn: '2027-03-09',
    capacity: 40,
    seatsTaken: 40,
  },
  {
    n: 3,
    venue: 3,
    circle: null,
    program: 'dora',
    kind: 'recurring',
    title: ['Dora in English (sample)', 'انگریزی میں دورہ (نمونہ)'],
    section: 'family',
    language: 'en',
    time: '20:30',
    minutes: 120,
    days: ALL_DAYS,
    startsOn: '2027-02-08',
    endsOn: '2027-03-09',
    capacity: null,
    seatsTaken: null,
  },
  {
    n: 4,
    venue: 1,
    circle: 1,
    program: 'circles',
    kind: 'recurring',
    title: ['Tuesday Tajweed Circle (sample)', 'منگل تجوید سرکل (نمونہ)'],
    section: 'family',
    language: 'ur',
    time: '19:30',
    minutes: 75,
    days: [2],
    startsOn: '2027-01-12',
    endsOn: null,
    capacity: null,
    seatsTaken: null,
  },
  {
    n: 5,
    venue: 5,
    circle: null,
    program: 'dora',
    kind: 'recurring',
    title: ['Johar Town Dora (sample)', 'جوہر ٹاؤن دورہ (نمونہ)'],
    section: 'men',
    language: 'ur',
    time: '21:15',
    minutes: 150,
    days: ALL_DAYS,
    startsOn: '2027-02-08',
    endsOn: '2027-03-09',
    capacity: null,
    seatsTaken: null,
  },
  {
    n: 6,
    venue: 7,
    circle: null,
    program: 'circles',
    kind: 'one_off',
    title: [
      'Special lecture: Lessons from Surah Al-Kahf (sample)',
      'خصوصی خطاب: سورۃ الکہف کے اسباق (نمونہ)',
    ],
    section: 'family',
    language: 'ur',
    time: '18:00',
    minutes: 60,
    days: [],
    startsOn: '2027-02-19',
    endsOn: '2027-02-19',
    capacity: 200,
    seatsTaken: 64,
  },
];

const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Pakistan time is UTC+5 with no daylight saving. */
const toUtc = (isoDate: string, time: string, plusMinutes = 0): string => {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m - 5 * 60 + plusMinutes);
  return d.toISOString().replace('.000Z', 'Z');
};

const dayOfWeek = (isoDate: string): number => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

const FIXTURE_WINDOW_DAYS = 14;

/** Occurrences for every fixture session across the fixture window. */
export const occurrences: AdminOccurrence[] = sessionRows.flatMap((s) => {
  const out: AdminOccurrence[] = [];
  for (let i = 0; i < FIXTURE_WINDOW_DAYS; i++) {
    const date = addDays(FIRST_DAY, i);
    const inRange = date >= s.startsOn && (s.endsOn === null || date <= s.endsOn);
    const onDay = s.kind === 'one_off' ? date === s.startsOn : s.days.includes(dayOfWeek(date));
    if (!inRange || !onDay) continue;
    const n = out.length + 1 + s.n * 100;
    const past = date < FIRST_DAY;
    out.push({
      id: fixtureId('occurrence', n),
      sessionId: fixtureId('session', s.n),
      startsAt: toUtc(date, s.time),
      endsAt: toUtc(date, s.time, s.minutes),
      status: 'scheduled',
      portion: s.program === 'dora' ? { kind: 'para', para: (i % 30) + 1 } : null,
      portionLabel: null,
      recapNote: past && i === 0 ? 'Sample recap note.' : null,
      recapLocale: past && i === 0 ? 'en' : null,
      headcount: null,
    });
  }
  return out;
});

export const toPublicOccurrence = ({
  headcount: _headcount,
  ...rest
}: AdminOccurrence): Occurrence => rest;

const nextOccurrence = (sessionId: string): Occurrence | null => {
  const next = occurrences
    .filter(
      (o) => o.sessionId === sessionId && o.startsAt >= FIXTURE_NOW && o.status === 'scheduled',
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return next ? toPublicOccurrence(next) : null;
};

export const sessions: Session[] = sessionRows.map((s) => {
  const venue = venues[s.venue - 1]!;
  const circle = s.circle ? circles[s.circle - 1]! : null;
  return {
    id: fixtureId('session', s.n),
    program: s.program,
    seasonId: s.program === 'dora' ? seasons[0]!.id : null,
    venueId: venue.id,
    cityId: venue.cityId,
    areaId: venue.areaId,
    venue: {
      id: venue.id,
      cityId: venue.cityId,
      areaId: venue.areaId,
      name: venue.name,
      lat: venue.lat,
      lng: venue.lng,
    },
    circle: circle
      ? {
          id: circle.id,
          name: circle.name,
          teacherName: circle.teacherName,
          onlineLink: circle.onlineLink,
        }
      : null,
    kind: s.kind,
    title: loc(s.title[0], s.title[1]),
    description: null,
    section: s.section,
    language: s.language,
    localStartTime: s.time,
    durationMinutes: s.minutes,
    daysOfWeek: s.days,
    startsOn: s.startsOn,
    endsOn: s.endsOn,
    timezone: 'Asia/Karachi',
    registration: {
      enabled: true,
      capacity: s.capacity,
      seatsTaken: s.seatsTaken,
      full: s.capacity !== null && s.seatsTaken !== null && s.seatsTaken >= s.capacity,
    },
    status: 'published',
    nextOccurrence: nextOccurrence(fixtureId('session', s.n)),
  };
});

/** Sessions as staff see them: the public record plus the status of the circle behind it. */
export const adminSessions: AdminSession[] = sessions.map((s) => ({
  ...s,
  circleStatus: s.circle ? (circles.find((c) => c.id === s.circle!.id)?.status ?? null) : null,
}));

/** When the sample registrants below signed up. */
export const FIXTURE_REGISTERED_AT = '2027-02-14T10:00:00Z';

/** One sample registrant for each fixture session, for the scoped export in the mock. */
export const sampleRegistrants = sessions.map((s) => ({
  sessionId: s.id,
  venueId: s.venueId,
  cityId: s.cityId,
  name: 'Sample Person',
  phone: '+923000000099',
  partySize: 2,
  section: s.section,
  status: 'confirmed' as const,
  registeredAt: FIXTURE_REGISTERED_AT,
}));

/**
 * Rows that pass the import checks, for tests and the console's template. Ids come from the
 * fixtures above, so a dry run against the fixture data reports them `created`.
 */
export const importExamples = {
  venues: [
    {
      cityId: cityId('multan'),
      areaId: areaId('multan', 'gulgasht'),
      name: loc('Sample Masjid Al-Falah', 'نمونہ مسجد الفلاح'),
      address: loc('Street 9, Gulgasht (sample address)', 'گلی 9، گلگشت (نمونہ پتہ)'),
      lat: 30.2112,
      lng: 71.4968,
      contactPhone: null,
      facilities: {},
    },
  ] satisfies VenueCreate[],
  coordinators: [
    {
      role: 'venue_coordinator' as const,
      venueId: fixtureId('venue', 7),
      phone: '+923000000101',
      displayName: 'Sample Coordinator',
    },
  ],
  sessions: [
    {
      kind: 'recurring' as const,
      venueId: fixtureId('venue', 7),
      circleId: null,
      program: 'circles' as const,
      seasonId: null,
      title: loc('Thursday Tafsir (sample)', 'جمعرات تفسیر (نمونہ)'),
      description: null,
      section: 'family' as const,
      language: 'ur' as const,
      localStartTime: '20:00',
      durationMinutes: 60,
      registrationEnabled: true,
      capacity: null,
      status: 'published' as const,
      daysOfWeek: [4],
      startsOn: '2027-03-01',
      endsOn: null,
    },
  ],
};

export const contentPages: ContentPage[] = [
  {
    slug: 'about',
    title: loc('About Quran Circles', 'قرآن سرکلز کے بارے میں'),
    body: loc(
      'Quran Circles helps you find a Quran session near you, register in a tap and never miss it.',
      'قرآن سرکلز آپ کو قریبی قرآن نشست ڈھونڈنے، ایک ٹیپ میں رجسٹر ہونے اور کوئی نشست نہ چھوڑنے میں مدد دیتا ہے۔',
    ),
    publishedAt: '2027-01-01T00:00:00Z',
  },
  {
    slug: 'faq',
    title: loc('Questions and answers', 'سوالات و جوابات'),
    body: loc('Sample FAQ content.', 'نمونہ سوالات کا مواد۔'),
    publishedAt: '2027-01-01T00:00:00Z',
  },
];

export const fixtureMe: Me = {
  id: fixtureId('user', 1),
  phone: '+923000000099',
  displayName: 'Sample Person',
  locale: 'ur',
  createdAt: '2027-02-01T05:00:00Z',
  profile: {
    areaId: areas[0]!.id,
    ageBand: null,
    profession: null,
    education: null,
    priorReading: null,
    preferredLanguage: null,
    dailyGoal: null,
    memorisationReviseAfterDays: null,
  },
  roles: [],
};

/** A staff kind the mock can sign in as. */
export type StaffKind = 'venue' | 'city' | 'national';

/**
 * Staff accounts for the mock server, one for each role. Sign in to the mock with the `phone`
 * (any `auth.requestCode` body) and code `123456`: the mock returns `token` and `me`. The numbers
 * are synthetic, in the fixture range, and belong to no one.
 */
export interface StaffAccount {
  kind: StaffKind;
  /** The bearer token the mock issues and accepts for this account. */
  token: string;
  refreshToken: string;
  /** The fake number that signs in as this account. */
  phone: string;
  /** What `auth.requestCode` returns for `phone`, and `auth.verifyCode` maps back. */
  challengeId: string;
  me: Me;
}

const VENUE_AL_NOOR = venues[0]!;
const CITY_RAWALPINDI = cities.find((c) => c.id === VENUE_AL_NOOR.cityId)!;

const staffMe = (n: number, displayName: string, phone: string, roles: Me['roles']): Me => ({
  id: fixtureId('user', n),
  phone,
  displayName,
  locale: 'en',
  createdAt: '2027-01-05T05:00:00Z',
  profile: { ...fixtureMe.profile },
  roles,
});

const assignedAt = '2027-01-05T05:00:00Z';

export const staffAccounts: Record<StaffKind, StaffAccount> = {
  venue: {
    kind: 'venue',
    token: 'mock-venue',
    refreshToken: 'mock-refresh-venue-0000',
    phone: '+923000000201',
    challengeId: fixtureId('challenge', 1),
    me: staffMe(2, 'Sample Venue Coordinator', '+923000000201', [
      {
        id: fixtureId('role', 1),
        role: 'venue_coordinator',
        scopeType: 'venue',
        cityId: VENUE_AL_NOOR.cityId,
        venueId: VENUE_AL_NOOR.id,
        scopeName: VENUE_AL_NOOR.name,
        createdAt: assignedAt,
      },
    ]),
  },
  city: {
    kind: 'city',
    token: 'mock-city',
    refreshToken: 'mock-refresh-city-0000',
    phone: '+923000000202',
    challengeId: fixtureId('challenge', 2),
    me: staffMe(3, 'Sample City Coordinator', '+923000000202', [
      {
        id: fixtureId('role', 2),
        role: 'city_coordinator',
        scopeType: 'city',
        cityId: CITY_RAWALPINDI.id,
        venueId: null,
        scopeName: CITY_RAWALPINDI.name,
        createdAt: assignedAt,
      },
    ]),
  },
  national: {
    kind: 'national',
    token: 'mock-staff',
    refreshToken: 'mock-refresh-staff-0000',
    phone: '+923000000203',
    challengeId: fixtureId('challenge', 3),
    me: staffMe(4, 'Sample National Admin', '+923000000203', [
      {
        id: fixtureId('role', 3),
        role: 'national_admin',
        scopeType: 'national',
        cityId: null,
        venueId: null,
        scopeName: null,
        createdAt: assignedAt,
      },
    ]),
  },
};

const GUEST_NAMES = [
  'Sample Guest One',
  'Sample Guest Two',
  null,
  'نمونہ مہمان',
  'Sample Guest Five',
  'Sample Guest Six',
];

/**
 * The registrants a coordinator sees for a fixture session: six invented people with numbers in
 * the fixture range. One has no name yet and one has no number. A full session puts the last
 * two on the waitlist. Empty for an unknown session.
 */
export const staffRegistrants = (sessionId: string): StaffRegistration[] => {
  const index = sessions.findIndex((s) => s.id === sessionId);
  const session = sessions[index];
  if (!session) return [];
  return GUEST_NAMES.map((name, i) => ({
    id: fixtureId('registration', (index + 1) * 100 + i + 1),
    name,
    phone: i === 4 ? null : `+9230000003${String(index + 1)}${i + 1}`,
    areaId: session.areaId,
    section:
      session.section === 'family'
        ? (['family', 'women', 'men'] as const)[i % 3]!
        : session.section,
    partySize: (i % 3) + 1,
    status: session.registration.full && i >= 4 ? 'waitlisted' : 'confirmed',
    occurrenceId: null,
    allowsWhatsapp: i % 2 === 0,
    createdAt: FIXTURE_REGISTERED_AT,
  }));
};

export const fixtureUpdates: Update[] = [
  {
    id: fixtureId('update', 1),
    kind: 'announcement',
    scope: { type: 'national', cityId: null, venueId: null },
    title: loc('Welcome to Quran Circles (sample)', 'قرآن سرکلز میں خوش آمدید (نمونہ)'),
    body: loc(
      'Find a session near you and register in a tap.',
      'اپنے قریب نشست ڈھونڈیں اور ایک ٹیپ میں رجسٹر ہوں۔',
    ),
    sessionId: null,
    publishedAt: '2027-02-10T04:00:00Z',
    isRead: false,
  },
  {
    id: fixtureId('update', 2),
    kind: 'time_change',
    scope: { type: 'venue', cityId: venues[0]!.cityId, venueId: venues[0]!.id },
    title: loc('Tuesday circle moves to 8 pm (sample)', 'منگل کا سرکل رات 8 بجے ہو گا (نمونہ)'),
    body: loc(
      'From this week the Tuesday Tajweed Circle starts at 8 pm.',
      'اس ہفتے سے منگل تجوید سرکل رات 8 بجے شروع ہو گا۔',
    ),
    sessionId: fixtureId('session', 4),
    publishedAt: '2027-02-12T09:00:00Z',
    isRead: true,
  },
];

// Days read, ayah of the day, memorisation (rc.4) ---------------------------------------------

/**
 * Ayah of the day picks around `FIXTURE_NOW`: numbers only. National picks on the first two days;
 * a venue pick for Sample Masjid Al-Noor (Rawalpindi) and one for a Lahore venue on the first day;
 * a circle pick for the Tuesday Tajweed Circle (at Al-Noor) on the second day. No person set them.
 */
export const dailyAyahs: DailyAyahEntry[] = [
  {
    id: fixtureId('dailyAyah', 1),
    date: FIRST_DAY,
    scopeType: 'national',
    cityId: null,
    venueId: null,
    circleId: null,
    surah: 2,
    ayah: 255,
    updatedAt: '2027-02-10T04:00:00Z',
  },
  {
    id: fixtureId('dailyAyah', 2),
    date: '2027-02-16',
    scopeType: 'national',
    cityId: null,
    venueId: null,
    circleId: null,
    surah: 94,
    ayah: 5,
    updatedAt: '2027-02-10T04:00:00Z',
  },
  {
    id: fixtureId('dailyAyah', 3),
    date: FIRST_DAY,
    scopeType: 'venue',
    cityId: venues[0]!.cityId,
    venueId: venues[0]!.id,
    circleId: null,
    surah: 13,
    ayah: 28,
    updatedAt: '2027-02-12T04:00:00Z',
  },
  {
    id: fixtureId('dailyAyah', 4),
    date: '2027-02-16',
    scopeType: 'circle',
    cityId: circles[0]!.cityId,
    venueId: circles[0]!.venueId,
    circleId: circles[0]!.id,
    surah: 73,
    ayah: 4,
    updatedAt: '2027-02-12T04:00:00Z',
  },
  {
    id: fixtureId('dailyAyah', 5),
    date: FIRST_DAY,
    scopeType: 'venue',
    cityId: venues[4]!.cityId,
    venueId: venues[4]!.id,
    circleId: null,
    surah: 39,
    ayah: 53,
    updatedAt: '2027-02-12T04:00:00Z',
  },
];

/** The attendee's days read in the fixture week (mock only; the seed stores no person data). */
export const fixtureReadingDays: ReadingDay[] = [
  { date: '2027-02-11', sources: ['reader'], pages: 2, ayahs: 31 },
  { date: '2027-02-12', sources: ['manual'], pages: 0, ayahs: 0 },
  { date: '2027-02-13', sources: ['goal', 'attendance'], pages: 1, ayahs: 0 },
  { date: '2027-02-15', sources: ['reader', 'portion'], pages: 3, ayahs: 42 },
];

/** The attendee's memorisation tracker (mock only). */
export const fixtureMemorisation: MemorisationEntry[] = [
  {
    surah: 1,
    status: 'memorised',
    lastRevisedAt: '2027-02-10T16:00:00Z',
    updatedAt: '2027-02-10T16:00:00Z',
  },
  {
    surah: 67,
    status: 'revising',
    lastRevisedAt: '2027-01-20T16:00:00Z',
    updatedAt: '2027-01-20T16:00:00Z',
  },
  {
    surah: 112,
    status: 'memorised',
    lastRevisedAt: '2027-01-02T16:00:00Z',
    updatedAt: '2027-01-02T16:00:00Z',
  },
  { surah: 36, status: 'learning', lastRevisedAt: null, updatedAt: '2027-02-14T16:00:00Z' },
];

/** The national total the mock serves for the fixture day. */
export const fixtureCommunityToday: CommunityToday = {
  date: FIRST_DAY,
  readersToday: 1240,
  pagesTogether: 3815,
};

// Posters (rc.5) --------------------------------------------------------------------------------

/** The renderer's demo templates as `poster_templates` rows. The seed inserts these too. */
export const posterTemplates: PosterTemplate[] = DEMO_POSTER_TEMPLATES.map((t, i) => ({
  id: fixtureId('posterTemplate', i + 1),
  key: t.key,
  name: { ...t.name },
  version: t.version,
  formats: [...t.formats],
  provisional: t.provisional,
}));

/** Fixture sessions carry no `updatedAt`; this stands in as their version on poster snapshots. */
export const FIXTURE_SESSION_VERSION = '2027-02-01T00:00:00.000Z';

/** The snapshot a poster made now from a fixture session would carry; null for an unknown id. */
export const fixturePosterSnapshot = (sessionId: string): PosterSourceSnapshot | null => {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const area = areas.find((a) => a.id === session.venue.areaId)?.name ?? null;
  return posterSnapshotFromSession(session, FIXTURE_SESSION_VERSION, area);
};

/** A poster as stored: everything but `outOfDate`, which is worked out against the session now. */
export type FixturePoster = Omit<Poster, 'outOfDate'>;

const posterFile = (n: number) => `/v1/admin/posters/${fixtureId('poster', n)}/file`;
const TARAWEEH_TITLE = { en: 'Taraweeh with Dora', ur: 'تراویح مع دورہ' };

/**
 * Posters of the Al-Noor Taraweeh session (session 1, Rawalpindi) and one of the Lahore session
 * (session 5): a ready story, a ready A4 made when the session started at 20:30 (so it is out of
 * date on time) with its regeneration queued, a failed one whose title did not fit, and a ready
 * link preview. Synthetic text only.
 */
export const posters: FixturePoster[] = (() => {
  const s1 = fixturePosterSnapshot(fixtureId('session', 1))!;
  const s5 = fixturePosterSnapshot(fixtureId('session', 5))!;
  const fields = {
    title: TARAWEEH_TITLE,
    accent: 'tanzeem' as const,
    qrTarget: 'register' as const,
  };
  const alt = {
    en: 'Poster: Taraweeh with Dora at Sample Masjid Al-Noor, every day at 9:00 pm.',
    ur: 'پوسٹر: تراویح مع دورہ، نمونہ مسجد النور، روزانہ رات 9 بجے۔',
  };
  return [
    {
      id: fixtureId('poster', 1),
      sessionId: s1.sessionId,
      templateKey: 'cloud',
      format: 'story',
      language: 'en_ur',
      locale: 'en',
      fields,
      status: 'ready',
      failureCode: null,
      altText: alt,
      fileUrl: posterFile(1),
      sourceSnapshot: s1,
      replacesPosterId: null,
      createdAt: '2027-02-14T09:00:00Z',
    },
    {
      id: fixtureId('poster', 2),
      sessionId: s1.sessionId,
      templateKey: 'cloud',
      format: 'print_a4',
      language: 'en_ur',
      locale: 'en',
      fields,
      status: 'ready',
      failureCode: null,
      altText: { ...alt, en: alt.en.replace('9:00', '8:30'), ur: alt.ur.replace('9', '8:30') },
      fileUrl: posterFile(2),
      sourceSnapshot: {
        ...s1,
        sessionVersion: '2027-01-20T00:00:00.000Z',
        localStartTime: '20:30',
      },
      replacesPosterId: null,
      createdAt: '2027-01-21T09:00:00Z',
    },
    {
      id: fixtureId('poster', 3),
      sessionId: s1.sessionId,
      templateKey: 'night',
      format: 'story',
      language: 'ur',
      locale: 'ur',
      fields: { title: { ur: TARAWEEH_TITLE.ur }, accent: 'night', qrTarget: 'session' },
      status: 'failed',
      failureCode: 'text_too_long',
      altText: null,
      fileUrl: null,
      sourceSnapshot: s1,
      replacesPosterId: null,
      createdAt: '2027-02-14T09:05:00Z',
    },
    {
      id: fixtureId('poster', 4),
      sessionId: s5.sessionId,
      templateKey: 'night',
      format: 'link_preview',
      language: 'en',
      locale: 'en',
      fields: { title: { en: 'Dora in Lahore' }, accent: 'deep', qrTarget: 'register' },
      status: 'ready',
      failureCode: null,
      altText: { en: 'Poster: Dora in Lahore at Sample Masjid Bilal.' },
      fileUrl: posterFile(4),
      sourceSnapshot: s5,
      replacesPosterId: null,
      createdAt: '2027-02-13T12:00:00Z',
    },
    {
      id: fixtureId('poster', 5),
      sessionId: s1.sessionId,
      templateKey: 'cloud',
      format: 'print_a4',
      language: 'en_ur',
      locale: 'en',
      fields,
      status: 'queued',
      failureCode: null,
      altText: null,
      fileUrl: null,
      sourceSnapshot: s1,
      replacesPosterId: fixtureId('poster', 2),
      createdAt: '2027-02-15T07:55:00Z',
    },
  ];
})();

export const fixtures = {
  provinces,
  cities,
  areas,
  venues,
  programs,
  seasons,
  circles,
  sessions,
  occurrences,
  contentPages,
  updates: fixtureUpdates,
  me: fixtureMe,
  dailyAyahs,
  posterTemplates,
  posters,
};
