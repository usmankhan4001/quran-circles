import { z } from 'zod';
import { lazy } from './lazy';

/**
 * Closed vocabularies shared by the database (check constraints), the API and the apps.
 * Add a value here and every layer sees it. Changing one is a contract change.
 */

export const LOCALES = ['en', 'ur'] as const;
export const Locale = lazy(() => z.enum(LOCALES));
export type Locale = z.infer<typeof Locale>;

export const ROLES = ['national_admin', 'city_coordinator', 'venue_coordinator'] as const;
export const Role = lazy(() => z.enum(ROLES));
export type Role = z.infer<typeof Role>;

export const SCOPE_TYPES = ['national', 'city', 'venue'] as const;
export const ScopeType = lazy(() => z.enum(SCOPE_TYPES));
export type ScopeType = z.infer<typeof ScopeType>;

export const SECTIONS = ['women', 'men', 'family'] as const;
export const Section = lazy(() => z.enum(SECTIONS));
export type Section = z.infer<typeof Section>;

export const PROGRAMS = ['dora', 'circles'] as const;
export const Program = lazy(() => z.enum(PROGRAMS));
export type Program = z.infer<typeof Program>;

export const SESSION_KINDS = ['recurring', 'one_off'] as const;
export const SessionKind = lazy(() => z.enum(SESSION_KINDS));
export type SessionKind = z.infer<typeof SessionKind>;

export const SESSION_STATUSES = ['draft', 'published', 'cancelled', 'archived'] as const;
export const SessionStatus = lazy(() => z.enum(SESSION_STATUSES));
export type SessionStatus = z.infer<typeof SessionStatus>;

export const OCCURRENCE_STATUSES = ['scheduled', 'cancelled', 'done'] as const;
export const OccurrenceStatus = lazy(() => z.enum(OCCURRENCE_STATUSES));
export type OccurrenceStatus = z.infer<typeof OccurrenceStatus>;

export const VENUE_STATUSES = ['active', 'archived'] as const;
export const VenueStatus = lazy(() => z.enum(VENUE_STATUSES));
export type VenueStatus = z.infer<typeof VenueStatus>;

export const CIRCLE_STATUSES = [
  'draft',
  'pending_approval',
  'published',
  'rejected',
  'archived',
] as const;
export const CircleStatus = lazy(() => z.enum(CIRCLE_STATUSES));
export type CircleStatus = z.infer<typeof CircleStatus>;

export const REGISTRATION_STATUSES = ['confirmed', 'waitlisted', 'cancelled'] as const;
export const RegistrationStatus = lazy(() => z.enum(REGISTRATION_STATUSES));
export type RegistrationStatus = z.infer<typeof RegistrationStatus>;

export const AGE_BANDS = [
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_64',
  '65_plus',
] as const;
export const AgeBand = lazy(() => z.enum(AGE_BANDS));
export type AgeBand = z.infer<typeof AgeBand>;

export const PRIOR_READING = ['none', 'basic', 'regular', 'advanced'] as const;
export const PriorReading = lazy(() => z.enum(PRIOR_READING));
export type PriorReading = z.infer<typeof PriorReading>;

export const CONSENT_CHANNELS = ['whatsapp', 'sms', 'push', 'email'] as const;
export const ConsentChannel = lazy(() => z.enum(CONSENT_CHANNELS));
export type ConsentChannel = z.infer<typeof ConsentChannel>;

export const CONSENT_PURPOSES = [
  'registration_updates',
  'session_reminders',
  'venue_alerts',
  'announcements',
  /**
   * The ayah of the day push (rc.4). Push only, and on by default: no consent row means on, a
   * revoked row means off. See `DEFAULT_ON_CONSENTS` in `schemas/people.ts`.
   */
  'ayah_daily',
] as const;
export const ConsentPurpose = lazy(() => z.enum(CONSENT_PURPOSES));
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export const PUSH_PROVIDERS = ['fcm', 'apns', 'webpush'] as const;
export const PushProvider = lazy(() => z.enum(PUSH_PROVIDERS));
export type PushProvider = z.infer<typeof PushProvider>;

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;
export const DevicePlatform = lazy(() => z.enum(DEVICE_PLATFORMS));
export type DevicePlatform = z.infer<typeof DevicePlatform>;

export const UPDATE_KINDS = [
  'announcement',
  'time_change',
  'cancellation',
  'special_lecture',
] as const;
export const UpdateKind = lazy(() => z.enum(UPDATE_KINDS));
export type UpdateKind = z.infer<typeof UpdateKind>;

export const UPDATE_SCOPE_TYPES = SCOPE_TYPES;

export const MESSAGE_CHANNELS = ['push', 'whatsapp', 'sms'] as const;
export const MessageChannel = lazy(() => z.enum(MESSAGE_CHANNELS));
export type MessageChannel = z.infer<typeof MessageChannel>;

export const OUTBOX_STATUSES = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'dead',
] as const;
export const OutboxStatus = lazy(() => z.enum(OUTBOX_STATUSES));
export type OutboxStatus = z.infer<typeof OutboxStatus>;

export const COST_CATEGORIES = [
  'free',
  'authentication',
  'utility',
  'marketing',
  'service',
] as const;
export const CostCategory = lazy(() => z.enum(COST_CATEGORIES));
export type CostCategory = z.infer<typeof CostCategory>;

export const TEMPLATE_STATUSES = ['draft', 'approved', 'retired'] as const;
export const TemplateStatus = lazy(() => z.enum(TEMPLATE_STATUSES));
export type TemplateStatus = z.infer<typeof TemplateStatus>;

export const CIRCLE_REQUEST_STATUSES = ['active', 'cancelled', 'fulfilled', 'expired'] as const;
export const CircleRequestStatus = lazy(() => z.enum(CIRCLE_REQUEST_STATUSES));
export type CircleRequestStatus = z.infer<typeof CircleRequestStatus>;

export const PORTION_KINDS = ['para', 'surah', 'ayah_range', 'lesson'] as const;
export const PortionKind = lazy(() => z.enum(PORTION_KINDS));
export type PortionKind = z.infer<typeof PortionKind>;

export const BOOKMARK_KINDS = ['ayah', 'surah', 'para'] as const;
export const BookmarkKind = lazy(() => z.enum(BOOKMARK_KINDS));
export type BookmarkKind = z.infer<typeof BookmarkKind>;

export const POSTER_STATUSES = ['queued', 'ready', 'failed'] as const;
export const PosterStatus = lazy(() => z.enum(POSTER_STATUSES));
export type PosterStatus = z.infer<typeof PosterStatus>;

export const POSTER_FORMATS = ['story', 'print_a4', 'print_a3', 'link_preview'] as const;
export const PosterFormat = lazy(() => z.enum(POSTER_FORMATS));
export type PosterFormat = z.infer<typeof PosterFormat>;

export const CONTENT_STATUSES = ['draft', 'published'] as const;
export const ContentStatus = lazy(() => z.enum(CONTENT_STATUSES));
export type ContentStatus = z.infer<typeof ContentStatus>;

export const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export const InviteStatus = lazy(() => z.enum(INVITE_STATUSES));
export type InviteStatus = z.infer<typeof InviteStatus>;

export const OTP_CHANNELS = ['whatsapp', 'sms', 'email'] as const;
export const OtpChannel = lazy(() => z.enum(OTP_CHANNELS));
export type OtpChannel = z.infer<typeof OtpChannel>;

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;
export const AccountStatus = lazy(() => z.enum(ACCOUNT_STATUSES));
export type AccountStatus = z.infer<typeof AccountStatus>;

export const SEASON_MODES = ['dora', 'circles'] as const;
export const SeasonMode = lazy(() => z.enum(SEASON_MODES));
export type SeasonMode = z.infer<typeof SeasonMode>;

// Next features (contract 1.0.0-rc.4): days read, ayah of the day, memorisation.

/**
 * What made a day count as a day read. `attendance` is added by the server when a coordinator
 * marks a named registrant present; clients never send it (`READING_DAY_CLIENT_SOURCES`).
 */
export const READING_DAY_SOURCES = ['reader', 'goal', 'manual', 'attendance', 'portion'] as const;
export const ReadingDaySource = lazy(() => z.enum(READING_DAY_SOURCES));
export type ReadingDaySource = z.infer<typeof ReadingDaySource>;

/** The sources a client may record with `POST /v1/me/reading-days`. */
export const READING_DAY_CLIENT_SOURCES = ['reader', 'goal', 'manual', 'portion'] as const;
export const ReadingDayClientSource = lazy(() => z.enum(READING_DAY_CLIENT_SOURCES));
export type ReadingDayClientSource = z.infer<typeof ReadingDayClientSource>;

export const DAILY_GOAL_UNITS = ['pages', 'rukus', 'minutes'] as const;
export const DailyGoalUnit = lazy(() => z.enum(DAILY_GOAL_UNITS));
export type DailyGoalUnit = z.infer<typeof DailyGoalUnit>;

export const MEMORISATION_STATUSES = ['learning', 'memorised', 'revising'] as const;
export const MemorisationStatus = lazy(() => z.enum(MEMORISATION_STATUSES));
export type MemorisationStatus = z.infer<typeof MemorisationStatus>;

/** Who an ayah of the day pick is for. A circle pick also carries the circle's venue. */
export const DAILY_AYAH_SCOPES = ['national', 'venue', 'circle'] as const;
export const DailyAyahScope = lazy(() => z.enum(DAILY_AYAH_SCOPES));
export type DailyAyahScope = z.infer<typeof DailyAyahScope>;

/** Where the resolved ayah of the day came from: a pick, or the built-in list. */
export const AYAH_OF_THE_DAY_SOURCES = ['national', 'venue', 'circle', 'built_in'] as const;
export const AyahOfTheDaySource = lazy(() => z.enum(AYAH_OF_THE_DAY_SOURCES));
export type AyahOfTheDaySource = z.infer<typeof AyahOfTheDaySource>;

// Posters (contract 1.0.0-rc.5, change request 2026-10-17-poster-renderer).

/**
 * Which languages a poster shows. `en_ur` and `ur_en` are bilingual: the first language leads (top,
 * or the start side). The stored `posters.locale` is the leading language.
 */
export const POSTER_LANGUAGES = ['en', 'ur', 'en_ur', 'ur_en'] as const;
export const PosterLanguage = lazy(() => z.enum(POSTER_LANGUAGES));
export type PosterLanguage = z.infer<typeof PosterLanguage>;

/** The only accent colours an editor can pick (D3). The renderer checks each against its text. */
export const POSTER_ACCENTS = ['tanzeem', 'deep', 'night'] as const;
export const PosterAccent = lazy(() => z.enum(POSTER_ACCENTS));
export type PosterAccent = z.infer<typeof PosterAccent>;

/** What a poster's QR code opens: registration (the default for posters) or the session page. */
export const POSTER_QR_TARGETS = ['register', 'session'] as const;
export const PosterQrTarget = lazy(() => z.enum(POSTER_QR_TARGETS));
export type PosterQrTarget = z.infer<typeof PosterQrTarget>;

/** Why a poster no longer matches its session: what it prints changed. */
export const POSTER_OUT_OF_DATE_REASONS = ['time', 'venue'] as const;
export const PosterOutOfDateReason = lazy(() => z.enum(POSTER_OUT_OF_DATE_REASONS));
export type PosterOutOfDateReason = z.infer<typeof PosterOutOfDateReason>;

/**
 * Why a poster render failed (`posters.failure_code`), so a screen can say "shorten the title"
 * instead of a bare "failed". `invalid_request` and `text_too_long` are not retried; the others are
 * (`POSTER_FAILURE_RETRYABLE`).
 */
export const POSTER_FAILURE_CODES = [
  'invalid_request',
  'text_too_long',
  'busy',
  'render_timeout',
  'render_failed',
] as const;
export const PosterFailureCode = lazy(() => z.enum(POSTER_FAILURE_CODES));
export type PosterFailureCode = z.infer<typeof PosterFailureCode>;
