import { z } from 'zod';

/**
 * Closed vocabularies shared by the database (check constraints), the API and the apps.
 * Add a value here and every layer sees it. Changing one is a contract change.
 */

export const LOCALES = ['en', 'ur'] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;

export const ROLES = ['national_admin', 'city_coordinator', 'venue_coordinator'] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const SCOPE_TYPES = ['national', 'city', 'venue'] as const;
export const ScopeType = z.enum(SCOPE_TYPES);
export type ScopeType = z.infer<typeof ScopeType>;

export const SECTIONS = ['women', 'men', 'family'] as const;
export const Section = z.enum(SECTIONS);
export type Section = z.infer<typeof Section>;

export const PROGRAMS = ['dora', 'circles'] as const;
export const Program = z.enum(PROGRAMS);
export type Program = z.infer<typeof Program>;

export const SESSION_KINDS = ['recurring', 'one_off'] as const;
export const SessionKind = z.enum(SESSION_KINDS);
export type SessionKind = z.infer<typeof SessionKind>;

export const SESSION_STATUSES = ['draft', 'published', 'cancelled', 'archived'] as const;
export const SessionStatus = z.enum(SESSION_STATUSES);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const OCCURRENCE_STATUSES = ['scheduled', 'cancelled', 'done'] as const;
export const OccurrenceStatus = z.enum(OCCURRENCE_STATUSES);
export type OccurrenceStatus = z.infer<typeof OccurrenceStatus>;

export const VENUE_STATUSES = ['active', 'archived'] as const;
export const VenueStatus = z.enum(VENUE_STATUSES);
export type VenueStatus = z.infer<typeof VenueStatus>;

export const CIRCLE_STATUSES = [
  'draft',
  'pending_approval',
  'published',
  'rejected',
  'archived',
] as const;
export const CircleStatus = z.enum(CIRCLE_STATUSES);
export type CircleStatus = z.infer<typeof CircleStatus>;

export const REGISTRATION_STATUSES = ['confirmed', 'waitlisted', 'cancelled'] as const;
export const RegistrationStatus = z.enum(REGISTRATION_STATUSES);
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
export const AgeBand = z.enum(AGE_BANDS);
export type AgeBand = z.infer<typeof AgeBand>;

export const PRIOR_READING = ['none', 'basic', 'regular', 'advanced'] as const;
export const PriorReading = z.enum(PRIOR_READING);
export type PriorReading = z.infer<typeof PriorReading>;

export const CONSENT_CHANNELS = ['whatsapp', 'sms', 'push', 'email'] as const;
export const ConsentChannel = z.enum(CONSENT_CHANNELS);
export type ConsentChannel = z.infer<typeof ConsentChannel>;

export const CONSENT_PURPOSES = [
  'registration_updates',
  'session_reminders',
  'venue_alerts',
  'announcements',
] as const;
export const ConsentPurpose = z.enum(CONSENT_PURPOSES);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export const PUSH_PROVIDERS = ['fcm', 'apns', 'webpush'] as const;
export const PushProvider = z.enum(PUSH_PROVIDERS);
export type PushProvider = z.infer<typeof PushProvider>;

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;
export const DevicePlatform = z.enum(DEVICE_PLATFORMS);
export type DevicePlatform = z.infer<typeof DevicePlatform>;

export const UPDATE_KINDS = [
  'announcement',
  'time_change',
  'cancellation',
  'special_lecture',
] as const;
export const UpdateKind = z.enum(UPDATE_KINDS);
export type UpdateKind = z.infer<typeof UpdateKind>;

export const UPDATE_SCOPE_TYPES = SCOPE_TYPES;

export const MESSAGE_CHANNELS = ['push', 'whatsapp', 'sms'] as const;
export const MessageChannel = z.enum(MESSAGE_CHANNELS);
export type MessageChannel = z.infer<typeof MessageChannel>;

export const OUTBOX_STATUSES = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'dead',
] as const;
export const OutboxStatus = z.enum(OUTBOX_STATUSES);
export type OutboxStatus = z.infer<typeof OutboxStatus>;

export const COST_CATEGORIES = [
  'free',
  'authentication',
  'utility',
  'marketing',
  'service',
] as const;
export const CostCategory = z.enum(COST_CATEGORIES);
export type CostCategory = z.infer<typeof CostCategory>;

export const TEMPLATE_STATUSES = ['draft', 'approved', 'retired'] as const;
export const TemplateStatus = z.enum(TEMPLATE_STATUSES);
export type TemplateStatus = z.infer<typeof TemplateStatus>;

export const CIRCLE_REQUEST_STATUSES = ['active', 'cancelled', 'fulfilled', 'expired'] as const;
export const CircleRequestStatus = z.enum(CIRCLE_REQUEST_STATUSES);
export type CircleRequestStatus = z.infer<typeof CircleRequestStatus>;

export const PORTION_KINDS = ['para', 'surah', 'ayah_range', 'lesson'] as const;
export const PortionKind = z.enum(PORTION_KINDS);
export type PortionKind = z.infer<typeof PortionKind>;

export const BOOKMARK_KINDS = ['ayah', 'surah', 'para'] as const;
export const BookmarkKind = z.enum(BOOKMARK_KINDS);
export type BookmarkKind = z.infer<typeof BookmarkKind>;

export const POSTER_STATUSES = ['queued', 'ready', 'failed'] as const;
export const PosterStatus = z.enum(POSTER_STATUSES);
export type PosterStatus = z.infer<typeof PosterStatus>;

export const POSTER_FORMATS = ['story', 'print_a4', 'print_a3', 'link_preview'] as const;
export const PosterFormat = z.enum(POSTER_FORMATS);
export type PosterFormat = z.infer<typeof PosterFormat>;

export const CONTENT_STATUSES = ['draft', 'published'] as const;
export const ContentStatus = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export const InviteStatus = z.enum(INVITE_STATUSES);
export type InviteStatus = z.infer<typeof InviteStatus>;

export const OTP_CHANNELS = ['whatsapp', 'sms'] as const;
export const OtpChannel = z.enum(OTP_CHANNELS);
export type OtpChannel = z.infer<typeof OtpChannel>;

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;
export const AccountStatus = z.enum(ACCOUNT_STATUSES);
export type AccountStatus = z.infer<typeof AccountStatus>;

export const SEASON_MODES = ['dora', 'circles'] as const;
export const SeasonMode = z.enum(SEASON_MODES);
export type SeasonMode = z.infer<typeof SeasonMode>;
