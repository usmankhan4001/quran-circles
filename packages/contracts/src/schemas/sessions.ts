import { z } from 'zod';
import {
  DayOfWeek,
  InstantUtc,
  Localized,
  LocalDate,
  LocalTime,
  PageQuery,
  QueryBool,
  Uuid,
  pageOf,
} from '../common';
import {
  Locale,
  OccurrenceStatus,
  Program,
  SessionKind,
  SessionStatus,
  Section,
  CircleStatus,
} from '../enums';
import { VenueSummary } from './places';

/** What a session covers on a day. Stored on the occurrence; coordinators set it per session. */
export const Portion = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('para'), para: z.number().int().min(1).max(30) }),
  z.object({ kind: z.literal('surah'), surah: z.number().int().min(1).max(114) }),
  z.object({
    kind: z.literal('ayah_range'),
    surah: z.number().int().min(1).max(114),
    fromAyah: z.number().int().min(1).max(286),
    toAyah: z.number().int().min(1).max(286),
  }),
  z.object({ kind: z.literal('lesson'), title: z.string().trim().min(1).max(200) }),
]);
export type Portion = z.infer<typeof Portion>;

export const SessionRegistrationInfo = z.object({
  enabled: z.boolean(),
  /** Null when capacity is off, which is the default. */
  capacity: z.number().int().positive().nullable(),
  /** Seats taken, counting party sizes. Null when capacity is off. */
  seatsTaken: z.number().int().min(0).nullable(),
  full: z.boolean(),
});
export type SessionRegistrationInfo = z.infer<typeof SessionRegistrationInfo>;

export const CircleInfo = z.object({
  id: Uuid,
  name: Localized,
  teacherName: z.string().nullable(),
  onlineLink: z.url().nullable(),
});
export type CircleInfo = z.infer<typeof CircleInfo>;

/** An occurrence is one dated instance of a session. The public view leaves out headcount. */
export const Occurrence = z.object({
  id: Uuid,
  sessionId: Uuid,
  startsAt: InstantUtc,
  endsAt: InstantUtc,
  status: OccurrenceStatus,
  portion: Portion.nullable(),
  /** Free-text portion label shown when the portion is not a Para or Surah. */
  portionLabel: z.string().nullable(),
  recapNote: z.string().nullable(),
  recapLocale: Locale.nullable(),
});
export type Occurrence = z.infer<typeof Occurrence>;

export const AdminOccurrence = Occurrence.extend({
  headcount: z.number().int().min(0).nullable(),
});
export type AdminOccurrence = z.infer<typeof AdminOccurrence>;

export const Session = z.object({
  id: Uuid,
  program: Program,
  seasonId: Uuid.nullable(),
  venueId: Uuid,
  cityId: Uuid,
  areaId: Uuid,
  venue: VenueSummary,
  circle: CircleInfo.nullable(),
  kind: SessionKind,
  title: Localized,
  description: Localized.nullable(),
  section: Section,
  language: Locale,
  /** Local wall-clock time in `timezone` (Pakistan time by default). */
  localStartTime: LocalTime,
  durationMinutes: z.number().int().min(5).max(600),
  /** 0 is Sunday. Empty for a one-off lecture. */
  daysOfWeek: z.array(DayOfWeek),
  startsOn: LocalDate,
  endsOn: LocalDate.nullable(),
  timezone: z.string(),
  registration: SessionRegistrationInfo,
  status: SessionStatus,
  nextOccurrence: Occurrence.nullable(),
});
export type Session = z.infer<typeof Session>;

export const AdminSession = Session.extend({
  circleStatus: CircleStatus.nullable(),
});
export type AdminSession = z.infer<typeof AdminSession>;

const SessionFilters = z.object({
  cityId: Uuid.optional(),
  areaId: Uuid.optional(),
  venueId: Uuid.optional(),
  circleId: Uuid.optional(),
  program: Program.optional(),
  kind: SessionKind.optional(),
  section: Section.optional(),
  language: Locale.optional(),
  /** Day of the week, 0 is Sunday. Repeat the parameter for several days. */
  dayOfWeek: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  /** Only sessions starting at or after this local time. */
  timeFrom: LocalTime.optional(),
  /** Only sessions starting at or before this local time. */
  timeTo: LocalTime.optional(),
  /** Free-text search of venue and session names. */
  q: z.string().trim().min(1).max(100).optional(),
  /** Sort by distance when both are given. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const SessionListQuery = PageQuery.extend(SessionFilters.shape);
export type SessionListQuery = z.infer<typeof SessionListQuery>;
export const SessionListResponse = pageOf(Session);

export const AdminSessionListQuery = PageQuery.extend({
  cityId: Uuid.optional(),
  venueId: Uuid.optional(),
  status: SessionStatus.optional(),
});
export const AdminSessionListResponse = pageOf(AdminSession);

export const OccurrenceWithSession = Occurrence.extend({ session: Session });
export type OccurrenceWithSession = z.infer<typeof OccurrenceWithSession>;

/** Occurrences across sessions, for "today near me" and the calendar. */
export const OccurrenceListQuery = PageQuery.extend({
  ...SessionFilters.shape,
  from: InstantUtc.optional(),
  to: InstantUtc.optional(),
  includeCancelled: QueryBool.optional(),
});
export const OccurrenceListResponse = pageOf(OccurrenceWithSession);

export const SessionOccurrencesQuery = z.object({
  from: InstantUtc.optional(),
  to: InstantUtc.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const OccurrencesResponse = z.object({ items: z.array(Occurrence) });
export const AdminOccurrencesResponse = z.object({ items: z.array(AdminOccurrence) });
