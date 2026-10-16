import { z } from 'zod';
import {
  InstantUtc,
  Latitude,
  LocalDate,
  LocalTime,
  Localized,
  LocalizedInput,
  LocalizedLongInput,
  Longitude,
  PageQuery,
  PersonName,
  PhoneE164,
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
import { Portion, Occurrence, AdminOccurrence, Session } from './sessions';
import { VenueFacilities } from './places';

// Roles and invites

const roleTargetShapes = {
  national_admin: z.object({ role: z.literal('national_admin') }),
  city_coordinator: z.object({ role: z.literal('city_coordinator'), cityId: Uuid }),
  venue_coordinator: z.object({ role: z.literal('venue_coordinator'), venueId: Uuid }),
};

/** Invite a person who may not have an account yet. Coordinators sign in with a phone code. */
export const InviteBody = z.discriminatedUnion('role', [
  roleTargetShapes.national_admin.extend({ phone: PhoneE164, displayName: PersonName.optional() }),
  roleTargetShapes.city_coordinator.extend({
    phone: PhoneE164,
    displayName: PersonName.optional(),
  }),
  roleTargetShapes.venue_coordinator.extend({
    phone: PhoneE164,
    displayName: PersonName.optional(),
  }),
]);
export type InviteBody = z.infer<typeof InviteBody>;

export const Invite = z.object({
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
});
export type Invite = z.infer<typeof Invite>;

/**
 * Give an existing person a role. For a handover, pass `replacesAssignmentId`: the previous
 * coordinator loses access in the same transaction and the history stays.
 */
export const AssignRoleBody = z.discriminatedUnion('role', [
  roleTargetShapes.national_admin.extend({ userId: Uuid }),
  roleTargetShapes.city_coordinator.extend({ userId: Uuid, replacesAssignmentId: Uuid.optional() }),
  roleTargetShapes.venue_coordinator.extend({
    userId: Uuid,
    replacesAssignmentId: Uuid.optional(),
  }),
]);
export type AssignRoleBody = z.infer<typeof AssignRoleBody>;

export const StaffRoleAssignment = z.object({
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
});
export const RoleAssignmentsQuery = PageQuery.extend({
  cityId: Uuid.optional(),
  venueId: Uuid.optional(),
  includeRevoked: z.stringbool().optional(),
});
export const RoleAssignmentsResponse = pageOf(StaffRoleAssignment);
export const InvitesResponse = z.object({ items: z.array(Invite) });

// Venues

export const VenueCreate = z.object({
  cityId: Uuid,
  areaId: Uuid,
  name: LocalizedInput,
  address: LocalizedInput,
  lat: Latitude,
  lng: Longitude,
  contactPhone: PhoneE164.nullable().default(null),
  facilities: VenueFacilities.partial().default({}),
});
export type VenueCreate = z.infer<typeof VenueCreate>;

export const VenueUpdate = z.object({
  areaId: Uuid.optional(),
  name: LocalizedInput.optional(),
  address: LocalizedInput.optional(),
  lat: Latitude.optional(),
  lng: Longitude.optional(),
  contactPhone: PhoneE164.nullable().optional(),
  facilities: VenueFacilities.partial().optional(),
});
export const AdminVenuesQuery = PageQuery.extend({
  cityId: Uuid.optional(),
  includeArchived: z.stringbool().optional(),
});

// Circles

export const AdminCircle = z.object({
  id: Uuid,
  venueId: Uuid,
  cityId: Uuid,
  name: Localized,
  teacherName: z.string().nullable(),
  description: Localized.nullable(),
  language: Locale,
  section: Section,
  onlineLink: z.url().nullable(),
  status: CircleStatus,
  createdAt: InstantUtc,
  approvedAt: InstantUtc.nullable(),
});
export type AdminCircle = z.infer<typeof AdminCircle>;

/** Venue coordinators create circles pending approval; a city coordinator or admin publishes them. */
export const CircleCreate = z.object({
  venueId: Uuid,
  name: LocalizedInput,
  /** The teacher is an optional name, not an account. */
  teacherName: z.string().trim().min(2).max(80).nullable().default(null),
  description: LocalizedLongInput.nullable().default(null),
  language: Locale,
  section: Section.default('family'),
  onlineLink: z.url().nullable().default(null),
});
export const CircleUpdate = z.object({
  name: LocalizedInput.optional(),
  teacherName: z.string().trim().min(2).max(80).nullable().optional(),
  description: LocalizedLongInput.nullable().optional(),
  language: Locale.optional(),
  section: Section.optional(),
  onlineLink: z.url().nullable().optional(),
});
export const CircleDecisionBody = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
});
export const AdminCirclesQuery = PageQuery.extend({
  cityId: Uuid.optional(),
  venueId: Uuid.optional(),
  status: CircleStatus.optional(),
});
export const AdminCirclesResponse = pageOf(AdminCircle);

// Sessions

const sessionBase = {
  venueId: Uuid,
  circleId: Uuid.nullable().default(null),
  program: Program,
  seasonId: Uuid.nullable().default(null),
  title: LocalizedInput,
  description: LocalizedLongInput.nullable().default(null),
  section: Section,
  language: Locale,
  localStartTime: LocalTime,
  durationMinutes: z.number().int().min(5).max(600),
  registrationEnabled: z.boolean().default(true),
  /** Null keeps capacity off, which is the default. */
  capacity: z.number().int().positive().nullable().default(null),
  status: z.enum(['draft', 'published']).default('published'),
};

export const SessionCreate = z.discriminatedUnion('kind', [
  z.object({
    ...sessionBase,
    kind: z.literal('recurring'),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startsOn: LocalDate,
    endsOn: LocalDate.nullable().default(null),
  }),
  z.object({ ...sessionBase, kind: z.literal('one_off'), date: LocalDate }),
]);
export type SessionCreate = z.infer<typeof SessionCreate>;

export const SessionUpdate = z.object({
  title: LocalizedInput.optional(),
  description: LocalizedLongInput.nullable().optional(),
  section: Section.optional(),
  language: Locale.optional(),
  registrationEnabled: z.boolean().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: SessionStatus.optional(),
});

/** A time or day change. It reschedules reminders and, with notify, posts an update to the feed. */
export const ScheduleChangeBody = z.object({
  localStartTime: LocalTime.optional(),
  durationMinutes: z.number().int().min(5).max(600).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  endsOn: LocalDate.nullable().optional(),
  /** First local date the change applies to. Earlier occurrences stay as they were. */
  effectiveFrom: LocalDate,
  notify: z.boolean().default(true),
});
export const ScheduleChangeResponse = z.object({
  session: Session,
  occurrencesChanged: z.number().int().min(0),
  updatePostedId: Uuid.nullable(),
});

export const OccurrenceUpdate = z.object({
  portion: Portion.nullable().optional(),
  portionLabel: z.string().trim().max(200).nullable().optional(),
  recapNote: z.string().trim().max(2000).nullable().optional(),
  recapLocale: Locale.nullable().optional(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
  startsAt: InstantUtc.optional(),
  endsAt: InstantUtc.optional(),
  notify: z.boolean().default(false),
});
export const OccurrenceView = z.object({ occurrence: AdminOccurrence });

// Attendance

export const AttendanceEntry = z.object({
  registrationId: Uuid.nullable().default(null),
  /** Optional name for drop-ins the coordinator knows. */
  name: z.string().trim().min(1).max(80).nullable().default(null),
  count: z.number().int().min(1).max(50).default(1),
});
export const AttendancePut = z.object({
  headcount: z.number().int().min(0).max(5000),
  entries: z.array(AttendanceEntry).max(500).default([]),
});
export const Attendance = z.object({
  occurrenceId: Uuid,
  headcount: z.number().int().min(0).nullable(),
  entries: z.array(AttendanceEntry),
  markedAt: InstantUtc.nullable(),
});

// Audit, templates, settings

export const AuditEntry = z.object({
  id: z.string(),
  actorName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  scopeType: ScopeType,
  cityId: Uuid.nullable(),
  venueId: Uuid.nullable(),
  createdAt: InstantUtc,
});
export const AuditQuery = PageQuery.extend({
  cityId: Uuid.optional(),
  venueId: Uuid.optional(),
  entityType: z.string().max(60).optional(),
  from: InstantUtc.optional(),
  to: InstantUtc.optional(),
});
export const AuditResponse = pageOf(AuditEntry);

export const MessageTemplateView = z.object({
  key: z.string(),
  channel: MessageChannel,
  locale: Locale,
  body: z.string(),
  variables: z.array(z.string()),
  costCategory: CostCategory,
  status: TemplateStatus,
});
export const MessageTemplatesResponse = z.object({ items: z.array(MessageTemplateView) });

export const Settings = z.object({
  /** Days to add to the calculated Hijri date. Pakistan starts months by moon sighting. */
  hijriOffsetDays: z.number().int().min(-2).max(2),
  seasonMode: SeasonMode,
  whatsappDailyCapPerPerson: z.number().int().min(0).max(5),
  circleRequestAlertThreshold: z.number().int().min(1).max(1000),
});
export type Settings = z.infer<typeof Settings>;
export const SettingsUpdate = Settings.partial();

export { Occurrence };
