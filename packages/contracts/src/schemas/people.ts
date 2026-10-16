import { z } from 'zod';
import { InstantUtc, Localized, PageQuery, PersonName, PhoneE164, Uuid, pageOf } from '../common';
import {
  AgeBand,
  BookmarkKind,
  CircleRequestStatus,
  ConsentChannel,
  ConsentPurpose,
  DevicePlatform,
  Locale,
  PriorReading,
  PushProvider,
  RegistrationStatus,
  Role,
  ScopeType,
  Section,
} from '../enums';
import { Session } from './sessions';

export const Profile = z.object({
  areaId: Uuid.nullable(),
  ageBand: AgeBand.nullable(),
  profession: z.string().max(80).nullable(),
  education: z.string().max(80).nullable(),
  priorReading: PriorReading.nullable(),
  preferredLanguage: Locale.nullable(),
});
export type Profile = z.infer<typeof Profile>;

export const ProfileUpdate = z.object({
  displayName: PersonName.optional(),
  locale: Locale.optional(),
  areaId: Uuid.nullable().optional(),
  ageBand: AgeBand.nullable().optional(),
  profession: z.string().trim().max(80).nullable().optional(),
  education: z.string().trim().max(80).nullable().optional(),
  priorReading: PriorReading.nullable().optional(),
  preferredLanguage: Locale.nullable().optional(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;

export const RoleAssignmentView = z.object({
  id: Uuid,
  role: Role,
  scopeType: ScopeType,
  cityId: Uuid.nullable(),
  venueId: Uuid.nullable(),
  /** Display names of the city or venue, so the admin app can show "Venue coordinator, Masjid X". */
  scopeName: Localized.nullable(),
  createdAt: InstantUtc,
});
export type RoleAssignmentView = z.infer<typeof RoleAssignmentView>;

/** The signed-in person. The phone number is shown to them and to nobody else. */
export const Me = z.object({
  id: Uuid,
  phone: PhoneE164,
  displayName: z.string().nullable(),
  locale: Locale,
  createdAt: InstantUtc,
  profile: Profile,
  roles: z.array(RoleAssignmentView),
});
export type Me = z.infer<typeof Me>;

export const DeleteAccountBody = z.object({ confirm: z.literal(true) });

// Registrations

export const RegistrationCreate = z.object({
  sessionId: Uuid,
  /** Leave out to register for every occurrence of a recurring session. */
  occurrenceId: Uuid.optional(),
  areaId: Uuid,
  section: Section,
  partySize: z.number().int().min(1).max(20),
  /** Required the first time, when the account has no name yet. */
  name: PersonName.optional(),
  /** The registration consent checkbox for WhatsApp messages. Recorded as a consent row. */
  allowWhatsapp: z.boolean(),
});
export type RegistrationCreate = z.infer<typeof RegistrationCreate>;

export const Registration = z.object({
  id: Uuid,
  sessionId: Uuid,
  occurrenceId: Uuid.nullable(),
  areaId: Uuid,
  section: Section,
  partySize: z.number().int().min(1),
  status: RegistrationStatus,
  /** 1 is next in line. Null unless waitlisted. */
  waitlistPosition: z.number().int().positive().nullable(),
  createdAt: InstantUtc,
  cancelledAt: InstantUtc.nullable(),
  session: Session,
});
export type Registration = z.infer<typeof Registration>;

export const MyRegistrationsQuery = PageQuery.extend({
  includeCancelled: z.stringbool().optional(),
  upcomingOnly: z.stringbool().optional(),
});
export const MyRegistrationsResponse = pageOf(Registration);

/** What a coordinator sees about a registrant. They are the only readers of the number. */
export const StaffRegistration = z.object({
  id: Uuid,
  name: z.string().nullable(),
  phone: PhoneE164.nullable(),
  areaId: Uuid,
  section: Section,
  partySize: z.number().int().min(1),
  status: RegistrationStatus,
  occurrenceId: Uuid.nullable(),
  allowsWhatsapp: z.boolean(),
  createdAt: InstantUtc,
});
export type StaffRegistration = z.infer<typeof StaffRegistration>;

export const SessionRegistrationsQuery = PageQuery.extend({
  occurrenceId: Uuid.optional(),
  status: RegistrationStatus.optional(),
});
export const SessionRegistrationsResponse = pageOf(StaffRegistration).extend({
  totals: z.object({ registrations: z.number().int(), people: z.number().int(), waitlisted: z.number().int() }),
});

// Consents, follows, devices

export const Consent = z.object({
  id: Uuid,
  channel: ConsentChannel,
  purpose: ConsentPurpose,
  venueId: Uuid.nullable(),
  grantedAt: InstantUtc,
  revokedAt: InstantUtc.nullable(),
});
export type Consent = z.infer<typeof Consent>;

export const ConsentSet = z.object({
  channel: ConsentChannel,
  purpose: ConsentPurpose,
  venueId: Uuid.nullable().optional(),
  granted: z.boolean(),
});
export const ConsentsResponse = z.object({ items: z.array(Consent) });

export const Follow = z.object({
  id: Uuid,
  venueId: Uuid.nullable(),
  circleId: Uuid.nullable(),
  name: Localized,
  alertsEnabled: z.boolean(),
  createdAt: InstantUtc,
});
export type Follow = z.infer<typeof Follow>;

export const FollowCreate = z.discriminatedUnion('target', [
  z.object({ target: z.literal('venue'), venueId: Uuid, alertsEnabled: z.boolean().default(true) }),
  z.object({ target: z.literal('circle'), circleId: Uuid, alertsEnabled: z.boolean().default(true) }),
]);
export const FollowUpdate = z.object({ alertsEnabled: z.boolean() });
export const FollowsResponse = z.object({ items: z.array(Follow) });

export const Device = z.object({
  id: Uuid,
  platform: DevicePlatform,
  provider: PushProvider,
  locale: Locale,
  createdAt: InstantUtc,
  lastSeenAt: InstantUtc,
});
export type Device = z.infer<typeof Device>;

/** Registering the same token again just refreshes it. The token is never returned. */
export const DeviceRegister = z.object({
  platform: DevicePlatform,
  provider: PushProvider,
  token: z.string().min(8).max(4096),
  locale: Locale,
});

// Bookmarks and reading position

export const Bookmark = z.object({
  id: Uuid,
  kind: BookmarkKind,
  surah: z.number().int().min(1).max(114).nullable(),
  ayah: z.number().int().min(1).max(286).nullable(),
  para: z.number().int().min(1).max(30).nullable(),
  note: z.string().max(500).nullable(),
  createdAt: InstantUtc,
});
export type Bookmark = z.infer<typeof Bookmark>;

export const BookmarkCreate = z.object({
  kind: BookmarkKind,
  surah: z.number().int().min(1).max(114).optional(),
  ayah: z.number().int().min(1).max(286).optional(),
  para: z.number().int().min(1).max(30).optional(),
  note: z.string().trim().max(500).optional(),
});
export const BookmarksResponse = z.object({ items: z.array(Bookmark) });
/** One-time import of V1 browser bookmarks at first login. */
export const BookmarkImport = z.object({ items: z.array(BookmarkCreate).max(500) });
export const BookmarkImportResponse = z.object({ imported: z.number().int().min(0), skipped: z.number().int().min(0) });

export const ReadingPosition = z.object({
  surah: z.number().int().min(1).max(114),
  ayah: z.number().int().min(1).max(286),
  updatedAt: InstantUtc,
});
export const ReadingPositionPut = z.object({
  surah: z.number().int().min(1).max(114),
  ayah: z.number().int().min(1).max(286),
});

// Circle requests ("request a circle near me")

export const CircleRequestCreate = z.object({
  areaId: Uuid,
  days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  section: Section.optional(),
  language: Locale.optional(),
});
export const CircleRequest = z.object({
  id: Uuid,
  areaId: Uuid,
  days: z.array(z.number().int().min(0).max(6)),
  section: Section.nullable(),
  language: Locale.nullable(),
  status: CircleRequestStatus,
  expiresAt: InstantUtc,
  createdAt: InstantUtc,
});
export type CircleRequest = z.infer<typeof CircleRequest>;
export const CircleRequestsResponse = z.object({ items: z.array(CircleRequest) });
