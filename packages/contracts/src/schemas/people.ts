import { z } from 'zod';
import {
  EmailAddress,
  InstantUtc,
  Localized,
  PageQuery,
  PersonName,
  PhoneE164,
  Uuid,
  pageOf,
} from '../common';
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
import { DailyGoal, MemorisationReviseAfterDays } from './reading';
import { lazy } from '../lazy';

export const Profile = lazy(() =>
  z.object({
    areaId: Uuid.nullable(),
    ageBand: AgeBand.nullable(),
    profession: z.string().max(80).nullable(),
    education: z.string().max(80).nullable(),
    priorReading: PriorReading.nullable(),
    preferredLanguage: Locale.nullable(),
    /**
     * Optional daily goal (rc.4), null when not set. The server always sends it; optional in the
     * type only so profiles written for rc.3 still parse and typecheck.
     */
    dailyGoal: DailyGoal.nullable().optional(),
    /**
     * Days after which a memorised surah shows in "revise this week" (rc.4). Null means the default,
     * `MEMORISATION_REVISE_AFTER_DAYS_DEFAULT` (14). Optional in the type only, as `dailyGoal`.
     */
    memorisationReviseAfterDays: MemorisationReviseAfterDays.nullable().optional(),
  }),
);
export type Profile = z.infer<typeof Profile>;

export const ProfileUpdate = lazy(() =>
  z.object({
    displayName: PersonName.optional(),
    /**
     * The WhatsApp number (any country, E.164). It cannot be cleared, and a code does not verify
     * it. `validation_failed` with `{ path: "phone", code: "phone_in_use" }` when another account
     * holds it.
     */
    phone: PhoneE164.optional(),
    locale: Locale.optional(),
    areaId: Uuid.nullable().optional(),
    ageBand: AgeBand.nullable().optional(),
    profession: z.string().trim().max(80).nullable().optional(),
    education: z.string().trim().max(80).nullable().optional(),
    priorReading: PriorReading.nullable().optional(),
    preferredLanguage: Locale.nullable().optional(),
    /** Set a daily goal, or null to remove it. */
    dailyGoal: DailyGoal.nullable().optional(),
    /** 1 to 365 days, or null for the default (14). */
    memorisationReviseAfterDays: MemorisationReviseAfterDays.nullable().optional(),
  }),
);
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;

export const RoleAssignmentView = lazy(() =>
  z.object({
    id: Uuid,
    role: Role,
    scopeType: ScopeType,
    cityId: Uuid.nullable(),
    venueId: Uuid.nullable(),
    /** Display names of the city or venue, so the admin app can show "Venue coordinator, Masjid X". */
    scopeName: Localized.nullable(),
    createdAt: InstantUtc,
  }),
);
export type RoleAssignmentView = z.infer<typeof RoleAssignmentView>;

/** The signed-in person. The phone number is shown to them and to nobody else. */
export const Me = lazy(() =>
  z
    .object({
      id: Uuid,
      /** Signs the person in. NULL for accounts made before email sign-in, until one is added. */
      email: EmailAddress.nullable(),
      /** The WhatsApp number: required at sign-up, not verified by a code. */
      phone: PhoneE164,
      displayName: z.string().nullable(),
      locale: Locale,
      createdAt: InstantUtc,
      profile: Profile,
      roles: z.array(RoleAssignmentView),
    })
    .meta({ id: 'Me' }),
);
export type Me = z.infer<typeof Me>;

export const DeleteAccountBody = lazy(() => z.object({ confirm: z.literal(true) }));

// Registrations

export const RegistrationCreate = lazy(() =>
  z.object({
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
  }),
);
export type RegistrationCreate = z.infer<typeof RegistrationCreate>;

export const Registration = lazy(() =>
  z
    .object({
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
    })
    .meta({ id: 'Registration' }),
);
export type Registration = z.infer<typeof Registration>;

export const MyRegistrationsQuery = lazy(() =>
  PageQuery.extend({
    includeCancelled: z.stringbool().optional(),
    upcomingOnly: z.stringbool().optional(),
  }),
);
export const MyRegistrationsResponse = lazy(() => pageOf(Registration));

/** What a coordinator sees about a registrant. They are the only readers of the number. */
export const StaffRegistration = lazy(() =>
  z.object({
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
  }),
);
export type StaffRegistration = z.infer<typeof StaffRegistration>;

export const SessionRegistrationsQuery = lazy(() =>
  PageQuery.extend({
    occurrenceId: Uuid.optional(),
    status: RegistrationStatus.optional(),
  }),
);
export const SessionRegistrationsResponse = lazy(() =>
  pageOf(StaffRegistration).extend({
    totals: z.object({
      registrations: z.number().int(),
      people: z.number().int(),
      waitlisted: z.number().int(),
    }),
  }),
);

// Consents, follows, devices

export const Consent = lazy(() =>
  z.object({
    id: Uuid,
    channel: ConsentChannel,
    purpose: ConsentPurpose,
    venueId: Uuid.nullable(),
    grantedAt: InstantUtc,
    revokedAt: InstantUtc.nullable(),
  }),
);
export type Consent = z.infer<typeof Consent>;

/**
 * Notification preferences that are on until the person turns them off (rc.4). For these, no
 * consent row means granted, and a revoked row means off. Every other consent is off until granted.
 */
export const DEFAULT_ON_CONSENTS: readonly {
  channel: ConsentChannel;
  purpose: ConsentPurpose;
}[] = [{ channel: 'push', purpose: 'ayah_daily' }];

/** Purposes that only exist on one channel. `ayah_daily` is a push notification only. */
export const CONSENT_PURPOSE_CHANNELS: Partial<Record<ConsentPurpose, readonly ConsentChannel[]>> =
  { ayah_daily: ['push'] };

/** Whether a consent is granted when the person has no row for it. */
export const consentDefault = (channel: ConsentChannel, purpose: ConsentPurpose): boolean =>
  DEFAULT_ON_CONSENTS.some((c) => c.channel === channel && c.purpose === purpose);

/**
 * Whether a person has a consent, from their rows for that channel, purpose and venue: the live
 * (not revoked) row decides; with no rows at all, `consentDefault` does.
 */
export const consentGranted = (
  channel: ConsentChannel,
  purpose: ConsentPurpose,
  rows: readonly { revokedAt: string | Date | null }[],
): boolean =>
  rows.length === 0 ? consentDefault(channel, purpose) : rows.some((r) => r.revokedAt === null);

export const ConsentSet = lazy(() =>
  z
    .object({
      channel: ConsentChannel,
      purpose: ConsentPurpose,
      venueId: Uuid.nullable().optional(),
      granted: z.boolean(),
    })
    .refine(
      (v) => {
        const only = CONSENT_PURPOSE_CHANNELS[v.purpose];
        return !only || (only.includes(v.channel) && v.venueId == null);
      },
      { path: ['channel'] },
    ),
);
export const ConsentsResponse = lazy(() => z.object({ items: z.array(Consent) }));

export const Follow = lazy(() =>
  z.object({
    id: Uuid,
    venueId: Uuid.nullable(),
    circleId: Uuid.nullable(),
    name: Localized,
    alertsEnabled: z.boolean(),
    createdAt: InstantUtc,
  }),
);
export type Follow = z.infer<typeof Follow>;

export const FollowCreate = lazy(() =>
  z.discriminatedUnion('target', [
    z.object({
      target: z.literal('venue'),
      venueId: Uuid,
      alertsEnabled: z.boolean().default(true),
    }),
    z.object({
      target: z.literal('circle'),
      circleId: Uuid,
      alertsEnabled: z.boolean().default(true),
    }),
  ]),
);
export const FollowUpdate = lazy(() => z.object({ alertsEnabled: z.boolean() }));
export const FollowsResponse = lazy(() => z.object({ items: z.array(Follow) }));

export const Device = lazy(() =>
  z.object({
    id: Uuid,
    platform: DevicePlatform,
    provider: PushProvider,
    locale: Locale,
    createdAt: InstantUtc,
    lastSeenAt: InstantUtc,
  }),
);
export type Device = z.infer<typeof Device>;

/**
 * Web push services the worker may send to (SEC-01). A web push token is the browser's
 * `PushSubscription` as JSON, and the worker POSTs to its `endpoint`, so an endpoint anywhere
 * else would let a person make the worker call internal or arbitrary hosts. Exact hosts first,
 * then suffixes, which need at least one label in front (`<x>.notify.windows.com`).
 */
export const WEB_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
] as const;
export const WEB_PUSH_HOST_SUFFIXES = [
  '.push.services.mozilla.com',
  '.notify.windows.com',
  '.push.apple.com',
] as const;

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Whether `endpoint` is an `https:` URL on a known push service: default port, no user name or
 * password, a host name (never an IP literal) that is on `WEB_PUSH_HOSTS` or ends with one of
 * `WEB_PUSH_HOST_SUFFIXES`. The API checks it at registration and the worker again before sending.
 */
export function isAllowedWebPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false;
  if (url.port !== '' && url.port !== '443') return false;
  const host = url.hostname;
  // No IP literals: IPv6 keeps its brackets, and IPv4 (the URL parser normalises forms such as
  // `0x7f.1`) ends in an all-numeric label.
  if (host.startsWith('[')) return false;
  const labels = host.split('.');
  if (!labels.every((label) => HOST_LABEL.test(label))) return false;
  if (/^[0-9]+$/.test(labels.at(-1) ?? '')) return false;
  if ((WEB_PUSH_HOSTS as readonly string[]).includes(host)) return true;
  return WEB_PUSH_HOST_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && host.length > suffix.length,
  );
}

/** A web push device token: the browser's `PushSubscription.toJSON()`, serialised as JSON. */
export const WebPushSubscriptionToken = lazy(() =>
  z.object({
    endpoint: z.string().refine(isAllowedWebPushEndpoint, 'not an allowed web push endpoint'),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(256),
    }),
  }),
);
export type WebPushSubscriptionToken = z.infer<typeof WebPushSubscriptionToken>;

/** The subscription inside a web push token, or `null` when it is not JSON or not allowed. */
export function parseWebPushToken(token: string): WebPushSubscriptionToken | null {
  let json: unknown;
  try {
    json = JSON.parse(token);
  } catch {
    return null;
  }
  const parsed = WebPushSubscriptionToken.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * Registering the same token again just refreshes it. The token is never returned. A `webpush`
 * token must be a subscription whose endpoint passes `isAllowedWebPushEndpoint` (issue on
 * `token`, code `custom`, so the API answers `validation_failed`).
 */
export const DeviceRegister = lazy(() =>
  z
    .object({
      platform: DevicePlatform,
      provider: PushProvider,
      token: z.string().min(8).max(4096),
      locale: Locale,
    })
    .superRefine((value, ctx) => {
      if (value.provider === 'webpush' && parseWebPushToken(value.token) === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['token'],
          message: 'web push token must be a subscription on an allowed push service',
        });
      }
    }),
);

// Bookmarks and reading position

export const Bookmark = lazy(() =>
  z.object({
    id: Uuid,
    kind: BookmarkKind,
    surah: z.number().int().min(1).max(114).nullable(),
    ayah: z.number().int().min(1).max(286).nullable(),
    para: z.number().int().min(1).max(30).nullable(),
    note: z.string().max(500).nullable(),
    createdAt: InstantUtc,
  }),
);
export type Bookmark = z.infer<typeof Bookmark>;

export const BookmarkCreate = lazy(() =>
  z.object({
    kind: BookmarkKind,
    surah: z.number().int().min(1).max(114).optional(),
    ayah: z.number().int().min(1).max(286).optional(),
    para: z.number().int().min(1).max(30).optional(),
    note: z.string().trim().max(500).optional(),
  }),
);
export const BookmarksResponse = lazy(() => z.object({ items: z.array(Bookmark) }));
/** One-time import of V1 browser bookmarks at first login. */
export const BookmarkImport = lazy(() => z.object({ items: z.array(BookmarkCreate).max(500) }));
export const BookmarkImportResponse = lazy(() =>
  z.object({
    imported: z.number().int().min(0),
    skipped: z.number().int().min(0),
  }),
);

export const ReadingPosition = lazy(() =>
  z.object({
    surah: z.number().int().min(1).max(114),
    ayah: z.number().int().min(1).max(286),
    updatedAt: InstantUtc,
  }),
);
export const ReadingPositionPut = lazy(() =>
  z.object({
    surah: z.number().int().min(1).max(114),
    ayah: z.number().int().min(1).max(286),
  }),
);

// Circle requests ("request a circle near me")

export const CircleRequestCreate = lazy(() =>
  z.object({
    areaId: Uuid,
    days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    section: Section.optional(),
    language: Locale.optional(),
  }),
);
export const CircleRequest = lazy(() =>
  z.object({
    id: Uuid,
    areaId: Uuid,
    days: z.array(z.number().int().min(0).max(6)),
    section: Section.nullable(),
    language: Locale.nullable(),
    status: CircleRequestStatus,
    expiresAt: InstantUtc,
    createdAt: InstantUtc,
  }),
);
export type CircleRequest = z.infer<typeof CircleRequest>;
export const CircleRequestsResponse = lazy(() => z.object({ items: z.array(CircleRequest) }));
