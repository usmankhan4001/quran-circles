import { z } from 'zod';
import {
  HttpsUrl,
  InstantUtc,
  Latitude,
  LocalDate,
  LocalTime,
  Localized,
  LocalizedAddressInput,
  LocalizedInput,
  LocalizedLongInput,
  Longitude,
  PageQuery,
  PersonName,
  PhoneE164,
  SafeText,
  Uuid,
  pageOf,
} from '../common';
import {
  CircleStatus,
  CostCategory,
  InviteStatus,
  Locale,
  MessageChannel,
  Program,
  Role,
  ScopeType,
  Section,
  SeasonMode,
  SessionStatus,
  TemplateStatus,
} from '../enums';
import { issuesFromZod, ValidationIssue } from '../errors';
import { Portion, Occurrence, AdminOccurrence, Session } from './sessions';
import { VenueFacilities } from './places';
import { lazy } from '../lazy';

// Roles and invites

const roleTargetShapes = {
  national_admin: lazy(() => z.object({ role: z.literal('national_admin') })),
  city_coordinator: lazy(() => z.object({ role: z.literal('city_coordinator'), cityId: Uuid })),
  venue_coordinator: lazy(() => z.object({ role: z.literal('venue_coordinator'), venueId: Uuid })),
};

/**
 * Invite a person who may not have an account yet. Coordinators sign in with a phone code.
 *
 * Handover: pass `replacesAssignmentId` (city or venue coordinator) to hand a place over to
 * someone with no account yet. The replaced assignment is revoked at once, when the invite is
 * created; the invite stays pending and the new assignment is created on acceptance. The caller
 * needs the right to assign the role at that place and to revoke the replaced assignment.
 *
 * Resend: there is no separate "resend" call. Sending a new invite for the same number, role
 * and place replaces the pending one (new expiry) and sends the message again.
 */
export const InviteBody = lazy(() =>
  z.discriminatedUnion('role', [
    roleTargetShapes.national_admin.extend({
      phone: PhoneE164,
      displayName: PersonName.optional(),
    }),
    roleTargetShapes.city_coordinator.extend({
      phone: PhoneE164,
      displayName: PersonName.optional(),
      replacesAssignmentId: Uuid.optional(),
    }),
    roleTargetShapes.venue_coordinator.extend({
      phone: PhoneE164,
      displayName: PersonName.optional(),
      replacesAssignmentId: Uuid.optional(),
    }),
  ]),
);
export type InviteBody = z.infer<typeof InviteBody>;

export const Invite = lazy(() =>
  z.object({
    id: Uuid,
    phone: PhoneE164,
    displayName: z.string().nullable(),
    role: Role,
    scopeType: ScopeType,
    cityId: Uuid.nullable(),
    venueId: Uuid.nullable(),
    status: InviteStatus,
    createdAt: InstantUtc,
    expiresAt: InstantUtc,
    /**
     * Handover: the assignment this invite replaced (revoked when the invite was created), or null for a plain invite.
     * Servers from 1.0.0-rc.3 always send it. To resend a handover invite, copy it into the new
     * `InviteBody`; a resend of a still-pending handover invite keeps it even when it is left out.
     * Optional in the type only so that payloads and test data written for rc.2 still parse.
     */
    replacesAssignmentId: Uuid.nullable().optional(),
  }),
);
export type Invite = z.infer<typeof Invite>;

/**
 * Give an existing person a role. For a handover, pass `replacesAssignmentId`: the previous
 * coordinator loses access in the same transaction and the history stays.
 */
export const AssignRoleBody = lazy(() =>
  z.discriminatedUnion('role', [
    roleTargetShapes.national_admin.extend({ userId: Uuid }),
    roleTargetShapes.city_coordinator.extend({
      userId: Uuid,
      replacesAssignmentId: Uuid.optional(),
    }),
    roleTargetShapes.venue_coordinator.extend({
      userId: Uuid,
      replacesAssignmentId: Uuid.optional(),
    }),
  ]),
);
export type AssignRoleBody = z.infer<typeof AssignRoleBody>;

export const StaffRoleAssignment = lazy(() =>
  z.object({
    id: Uuid,
    userId: Uuid,
    userName: z.string().nullable(),
    phone: PhoneE164,
    role: Role,
    scopeType: ScopeType,
    cityId: Uuid.nullable(),
    venueId: Uuid.nullable(),
    scopeName: Localized.nullable(),
    createdAt: InstantUtc,
    revokedAt: InstantUtc.nullable(),
  }),
);
export type StaffRoleAssignment = z.infer<typeof StaffRoleAssignment>;
export const RoleAssignmentsQuery = lazy(() =>
  PageQuery.extend({
    cityId: Uuid.optional(),
    venueId: Uuid.optional(),
    includeRevoked: z.stringbool().optional(),
  }),
);
export const RoleAssignmentsResponse = lazy(() => pageOf(StaffRoleAssignment));
export const InvitesResponse = lazy(() => z.object({ items: z.array(Invite) }));

// Venues

export const VenueCreate = lazy(() =>
  z.object({
    cityId: Uuid,
    areaId: Uuid,
    name: LocalizedInput,
    address: LocalizedAddressInput,
    lat: Latitude,
    lng: Longitude,
    contactPhone: PhoneE164.nullable().default(null),
    facilities: VenueFacilities.partial().default({}),
  }),
);
export type VenueCreate = z.infer<typeof VenueCreate>;

export const VenueUpdate = lazy(() =>
  z.object({
    areaId: Uuid.optional(),
    name: LocalizedInput.optional(),
    address: LocalizedAddressInput.optional(),
    lat: Latitude.optional(),
    lng: Longitude.optional(),
    contactPhone: PhoneE164.nullable().optional(),
    facilities: VenueFacilities.partial().optional(),
  }),
);
export const AdminVenuesQuery = lazy(() =>
  PageQuery.extend({
    cityId: Uuid.optional(),
    includeArchived: z.stringbool().optional(),
  }),
);

// Circles

export const AdminCircle = lazy(() =>
  z.object({
    id: Uuid,
    venueId: Uuid,
    cityId: Uuid,
    name: Localized,
    teacherName: z.string().nullable(),
    description: Localized.nullable(),
    language: Locale,
    section: Section,
    onlineLink: HttpsUrl.nullable(),
    status: CircleStatus,
    createdAt: InstantUtc,
    approvedAt: InstantUtc.nullable(),
  }),
);
export type AdminCircle = z.infer<typeof AdminCircle>;

/** Venue coordinators create circles pending approval; a city coordinator or admin publishes them. */
export const CircleCreate = lazy(() =>
  z.object({
    venueId: Uuid,
    name: LocalizedInput,
    /** The teacher is an optional name, not an account. */
    teacherName: SafeText(2, 80).nullable().default(null),
    description: LocalizedLongInput.nullable().default(null),
    language: Locale,
    section: Section.default('family'),
    onlineLink: HttpsUrl.nullable().default(null),
  }),
);
export const CircleUpdate = lazy(() =>
  z.object({
    name: LocalizedInput.optional(),
    teacherName: SafeText(2, 80).nullable().optional(),
    description: LocalizedLongInput.nullable().optional(),
    language: Locale.optional(),
    section: Section.optional(),
    onlineLink: HttpsUrl.nullable().optional(),
    /**
     * Archive a published circle, or publish an archived one again. Approving a pending circle
     * stays `adminCircles.decide`; this cannot move a circle in or out of pending, rejected or draft.
     */
    status: z.enum(['published', 'archived']).optional(),
  }),
);
/**
 * Approve or reject a pending circle. There is deliberately no free-text note: personal text
 * must not reach the audit log, and there is no column for it. An old client that still sends
 * `note` is not refused; the field is dropped.
 */
export const CircleDecisionBody = lazy(() =>
  z.object({
    decision: z.enum(['approve', 'reject']),
  }),
);
export const AdminCirclesQuery = lazy(() =>
  PageQuery.extend({
    cityId: Uuid.optional(),
    venueId: Uuid.optional(),
    status: CircleStatus.optional(),
  }),
);
export const AdminCirclesResponse = lazy(() => pageOf(AdminCircle));

// Sessions

const sessionBase = {
  venueId: Uuid,
  circleId: lazy(() => Uuid.nullable().default(null)),
  program: Program,
  seasonId: lazy(() => Uuid.nullable().default(null)),
  title: LocalizedInput,
  description: lazy(() => LocalizedLongInput.nullable().default(null)),
  section: Section,
  language: Locale,
  localStartTime: LocalTime,
  durationMinutes: lazy(() => z.number().int().min(5).max(600)),
  registrationEnabled: lazy(() => z.boolean().default(true)),
  /** Null keeps capacity off, which is the default. */
  capacity: lazy(() => z.number().int().positive().nullable().default(null)),
  status: lazy(() => z.enum(['draft', 'published']).default('published')),
};

export const SessionCreate = lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      ...sessionBase,
      kind: z.literal('recurring'),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      startsOn: LocalDate,
      endsOn: LocalDate.nullable().default(null),
    }),
    z.object({ ...sessionBase, kind: z.literal('one_off'), date: LocalDate }),
  ]),
);
export type SessionCreate = z.infer<typeof SessionCreate>;

export const SessionUpdate = lazy(() =>
  z.object({
    title: LocalizedInput.optional(),
    description: LocalizedLongInput.nullable().optional(),
    section: Section.optional(),
    language: Locale.optional(),
    registrationEnabled: z.boolean().optional(),
    capacity: z.number().int().positive().nullable().optional(),
    status: SessionStatus.optional(),
  }),
);

/** A time or day change. It reschedules reminders and, with notify, posts an update to the feed. */
export const ScheduleChangeBody = lazy(() =>
  z.object({
    localStartTime: LocalTime.optional(),
    durationMinutes: z.number().int().min(5).max(600).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    endsOn: LocalDate.nullable().optional(),
    /** First local date the change applies to. Earlier occurrences stay as they were. */
    effectiveFrom: LocalDate,
    notify: z.boolean().default(true),
  }),
);
export const ScheduleChangeResponse = lazy(() =>
  z.object({
    session: Session,
    occurrencesChanged: z.number().int().min(0),
    updatePostedId: Uuid.nullable(),
  }),
);

export const OccurrenceUpdate = lazy(() =>
  z.object({
    portion: Portion.nullable().optional(),
    portionLabel: z.string().trim().max(200).nullable().optional(),
    recapNote: z.string().trim().max(2000).nullable().optional(),
    recapLocale: Locale.nullable().optional(),
    status: z.enum(['scheduled', 'cancelled']).optional(),
    startsAt: InstantUtc.optional(),
    endsAt: InstantUtc.optional(),
    notify: z.boolean().default(false),
  }),
);
export const OccurrenceView = lazy(() => z.object({ occurrence: AdminOccurrence }));

// Attendance

export const AttendanceEntry = lazy(() =>
  z.object({
    registrationId: Uuid.nullable().default(null),
    /** Optional name for drop-ins the coordinator knows. */
    name: SafeText(1, 80).nullable().default(null),
    count: z.number().int().min(1).max(50).default(1),
  }),
);
export const AttendancePut = lazy(() =>
  z.object({
    headcount: z.number().int().min(0).max(5000),
    entries: z.array(AttendanceEntry).max(500).default([]),
  }),
);
export const Attendance = lazy(() =>
  z.object({
    occurrenceId: Uuid,
    headcount: z.number().int().min(0).nullable(),
    entries: z.array(AttendanceEntry),
    markedAt: InstantUtc.nullable(),
  }),
);
export type Attendance = z.infer<typeof Attendance>;

// Audit, templates, settings

export const AuditEntry = lazy(() =>
  z.object({
    id: z.string(),
    actorName: z.string().nullable(),
    /**
     * Last four digits of the actor's phone, so staff can tell apart people with no name on their
     * account. Never the full number. Null when the account is gone; absent from older servers.
     */
    actorPhoneLast4: z.string().length(4).nullable().optional(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable(),
    scopeType: ScopeType,
    cityId: Uuid.nullable(),
    venueId: Uuid.nullable(),
    createdAt: InstantUtc,
  }),
);
export type AuditEntry = z.infer<typeof AuditEntry>;
export const AuditQuery = lazy(() =>
  PageQuery.extend({
    cityId: Uuid.optional(),
    venueId: Uuid.optional(),
    entityType: z.string().max(60).optional(),
    from: InstantUtc.optional(),
    to: InstantUtc.optional(),
  }),
);
export const AuditResponse = lazy(() => pageOf(AuditEntry));

export const MessageTemplateView = lazy(() =>
  z.object({
    key: z.string(),
    channel: MessageChannel,
    locale: Locale,
    body: z.string(),
    variables: z.array(z.string()),
    costCategory: CostCategory,
    status: TemplateStatus,
  }),
);
export const MessageTemplatesResponse = lazy(() =>
  z.object({ items: z.array(MessageTemplateView) }),
);

/** Whole minutes before a session's start that its reminder is sent. */
const ReminderLead = lazy(() => z.number().int().min(5).max(1440));
export const REMINDER_LEAD_DEFAULT_MINUTES = 60;

/** Reminder lead time per program. Stored under the settings key `reminder_lead_minutes`. */
export const ReminderLeadMinutes = lazy(() =>
  z.object({ dora: ReminderLead, circles: ReminderLead }),
);
export type ReminderLeadMinutes = z.infer<typeof ReminderLeadMinutes>;

export const Settings = lazy(() =>
  z.object({
    /** Days to add to the calculated Hijri date. Pakistan starts months by moon sighting. */
    hijriOffsetDays: z.number().int().min(-2).max(2),
    seasonMode: SeasonMode,
    /** Most WhatsApp messages one person gets in a day. Settings key `whatsapp_daily_cap_per_person`. */
    whatsappDailyCapPerPerson: z.number().int().min(0).max(5),
    circleRequestAlertThreshold: z.number().int().min(1).max(1000),
    /**
     * How long before a session its reminder goes out, per program (5 to 1440 minutes, 60 each by
     * default). A response from a server that predates this field reads as the default.
     */
    reminderLeadMinutes: ReminderLeadMinutes.prefault({
      dora: REMINDER_LEAD_DEFAULT_MINUTES,
      circles: REMINDER_LEAD_DEFAULT_MINUTES,
    }),
  }),
);
export type Settings = z.infer<typeof Settings>;
/** Send only what changes. `reminderLeadMinutes` may carry just one program. */
export const SettingsUpdate = lazy(() =>
  Settings.omit({ reminderLeadMinutes: true })
    .extend({ reminderLeadMinutes: ReminderLeadMinutes.partial() })
    .partial(),
);
export type SettingsUpdate = z.infer<typeof SettingsUpdate>;

// Bulk import

/** Rows allowed in one import call. */
export const IMPORT_MAX_ROWS = 2000;

/**
 * Rows the API accepts in one `adminImport.coordinators` call (each row can send a paid WhatsApp
 * invitation; security review SEC-03). The body schema still allows `IMPORT_MAX_ROWS`; a longer
 * coordinator file is refused whole with `{ path: 'rows', code: 'too_big' }`, dry run included.
 * The console can check it before sending.
 */
export const COORDINATOR_IMPORT_MAX_ROWS = 100;

/**
 * The issue code for "this person has sent as many coordinator invitations as allowed in 24
 * hours" (single invites, resends and imports together; SEC-03). `adminRoles.invite` reports it
 * on `phone`, `adminImport.coordinators` on `rows`. The limit is the API's setting, not part of
 * the contract.
 */
export const INVITE_DAILY_LIMIT = 'invite_daily_limit';

export const IMPORT_KINDS = ['venues', 'coordinators', 'sessions'] as const;
export const ImportKind = lazy(() => z.enum(IMPORT_KINDS));
export type ImportKind = z.infer<typeof ImportKind>;

/** The schema each row of an import is checked against: the same one as the single create call. */
export const IMPORT_ROW_SCHEMAS = {
  venues: VenueCreate,
  coordinators: InviteBody,
  sessions: SessionCreate,
} as const;

/**
 * Issue codes the server adds on top of Zod's own (`invalid_type`, `too_small`, ...). `path` is
 * the field inside the row, for example `cityId` or `name.en`.
 * - `invalid_reference`: an id in the row points at nothing (city, area, venue, circle, season,
 *   or the assignment to replace).
 * - `area_not_in_city`: the area belongs to another city.
 * - `forbidden`: the caller may not do this for that city, venue or role.
 * - `invalid_range`: a date range that ends before it starts (a recurring session's `endsOn`
 *   earlier than its `startsOn`). The same code `adminRegistrations.export` uses for `from`/`to`.
 *
 * These are per-row codes. A file that clashes with something written by someone else between
 * the check and the write is refused as a whole with `conflict` (409), not as a row issue.
 */
export const IMPORT_SERVER_ISSUE_CODES = [
  'invalid_reference',
  'area_not_in_city',
  'forbidden',
  'invalid_range',
] as const;
export type ImportServerIssueCode = (typeof IMPORT_SERVER_ISSUE_CODES)[number];

/**
 * Request-level issue codes: they refuse the whole import (`validation_failed`, path `rows`, no
 * `ImportResult`), unlike the per-row codes above. Only `adminImport.coordinators` uses them.
 * - `too_big`: more than `COORDINATOR_IMPORT_MAX_ROWS` rows.
 * - `invite_daily_limit` (`INVITE_DAILY_LIMIT`): the rows that would be created take the caller
 *   past their invitations for the last 24 hours. Duplicate and invalid rows do not count.
 */
export const IMPORT_REQUEST_ISSUE_CODES = ['too_big', INVITE_DAILY_LIMIT] as const;
export type ImportRequestIssueCode = (typeof IMPORT_REQUEST_ISSUE_CODES)[number];

/**
 * A row is checked one by one on the server, so one bad row never rejects the whole request.
 * The type is the input of the matching create schema; the runtime check only needs an object.
 */
const importRows = <S extends z.ZodType>(kind: ImportKind) =>
  z
    .array(
      z.custom<z.input<S>>(
        (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
        'Each row must be an object',
      ),
    )
    .min(1)
    .max(IMPORT_MAX_ROWS)
    .meta({
      description: `Up to ${IMPORT_MAX_ROWS} rows. Each row has the shape of the single create call for ${kind}, and is validated one by one; a malformed row is reported as invalid in the result.`,
    });

const importBody = <S extends z.ZodType>(kind: ImportKind) =>
  z.object({
    /** True checks every row and changes nothing. False applies the import if no row is invalid. */
    dryRun: z.boolean(),
    rows: importRows<S>(kind),
  });

export const VenueImportBody = lazy(() => importBody<typeof VenueCreate>('venues'));
export const CoordinatorImportBody = lazy(() => importBody<typeof InviteBody>('coordinators'));
export const SessionImportBody = lazy(() => importBody<typeof SessionCreate>('sessions'));
export type VenueImportBody = z.infer<typeof VenueImportBody>;
export type CoordinatorImportBody = z.infer<typeof CoordinatorImportBody>;
export type SessionImportBody = z.infer<typeof SessionImportBody>;

export const IMPORT_ROW_STATUSES = ['created', 'duplicate', 'invalid'] as const;
export const ImportRowStatus = lazy(() => z.enum(IMPORT_ROW_STATUSES));

export const ImportRowResult = lazy(() =>
  z.object({
    /** Position in the request's `rows`, from 0. */
    index: z.number().int().min(0),
    /**
     * created: added (or would be added, on a dry run). duplicate: already there or repeated
     * earlier in the same request; skipped, not an error. invalid: see `issues`.
     */
    status: ImportRowStatus,
    /** Empty unless the row is invalid. Never contains the cell values. */
    issues: z.array(ValidationIssue),
  }),
);
export type ImportRowResult = z.infer<typeof ImportRowResult>;

export const ImportResult = lazy(() =>
  z.object({
    dryRun: z.boolean(),
    /**
     * True only when the rows were written: not a dry run, and no row invalid. One invalid row
     * means nothing is written (all or nothing); fix the file and send it again.
     */
    applied: z.boolean(),
    counts: z.object({
      created: z.number().int().min(0),
      duplicate: z.number().int().min(0),
      invalid: z.number().int().min(0),
    }),
    rows: z.array(ImportRowResult),
  }),
);
export type ImportResult = z.infer<typeof ImportResult>;

export type ImportRowCheck<K extends ImportKind> =
  | { index: number; ok: true; value: z.output<(typeof IMPORT_ROW_SCHEMAS)[K]> }
  | { index: number; ok: false; issues: ValidationIssue[] };

/**
 * Checks each row against its create schema. The API uses this for the shape of every row, then
 * adds the checks that need the database; the console uses it for a fast first pass.
 */
export function checkImportRows<K extends ImportKind>(
  kind: K,
  rows: readonly unknown[],
): ImportRowCheck<K>[] {
  const schema = IMPORT_ROW_SCHEMAS[kind] as z.ZodType;
  return rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    return parsed.success
      ? ({ index, ok: true, value: parsed.data } as ImportRowCheck<K>)
      : { index, ok: false, issues: issuesFromZod(parsed.error) };
  });
}

// Scoped registrations export

/** Most registration rows one scoped export may return. Over this the call is refused. */
export const REGISTRATION_EXPORT_MAX_ROWS = 50_000;

export const AdminRegistrationsExportQuery = lazy(() =>
  z.object({
    cityId: Uuid.optional(),
    venueId: Uuid.optional(),
    /** First day to include, a local date (Pakistan time) of the registration. */
    from: LocalDate.optional(),
    /** Last day to include, inclusive. */
    to: LocalDate.optional(),
  }),
);
export type AdminRegistrationsExportQuery = z.infer<typeof AdminRegistrationsExportQuery>;

/** The header row of the scoped export, in order. */
export const REGISTRATION_EXPORT_COLUMNS = [
  'session_id',
  'venue_id',
  'city_id',
  'name',
  'phone',
  'party_size',
  'section',
  'status',
  'registered_at',
] as const;

export { Occurrence };
