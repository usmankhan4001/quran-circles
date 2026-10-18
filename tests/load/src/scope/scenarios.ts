import type { ScopeAction } from '@qc/contracts';
import type { Fixture, Scenario } from './types';

/**
 * One request per endpoint (more where the scope engine decides by the body), against a running
 * API. The expected outcome is never written here: `expect.ts` derives it for every caller from
 * the contract (`auth`, `actions`) and the scope engine (`can`, `scopeFilter`). The staff rows
 * follow the API's in-process matrix test so both suites check the same rules; this one goes
 * through real sign-in, real role resolution and the real HTTP stack.
 */

const ROLE_ACTIONS: ScopeAction[] = [
  'role.assign_national_admin',
  'role.assign_city_coordinator',
  'role.assign_venue_coordinator',
];

const venueImportRow = (fx: Fixture) => ({
  cityId: fx.world.cityA.id,
  areaId: fx.world.cityA.areaId,
  name: { en: `Scope import venue ${fx.runTag}` },
  address: { en: '3 Synthetic Road' },
  lat: 31.5,
  lng: 74.3,
});

const sessionBody = (fx: Fixture) => ({
  kind: 'one_off' as const,
  venueId: fx.world.venueA1,
  program: 'dora' as const,
  title: { en: `Scope lecture ${fx.runTag}` },
  section: 'family' as const,
  language: 'en' as const,
  localStartTime: '20:00',
  durationMinutes: 60,
  date: fx.pickDate,
});

const staff: Scenario[] = [
  {
    id: 'registrations.forSession',
    label: 'list',
    staff: { action: 'registration.list', target: 'venue' },
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'registrations.export',
    label: 'export',
    staff: { action: 'registration.export', target: 'venue' },
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'adminUpdates.post',
    label: 'national',
    staff: { action: 'update.post_national', target: 'national' },
    request: (fx) => ({
      body: {
        scope: { type: 'national' },
        title: { en: `Scope check ${fx.runTag}` },
        body: { en: 'Synthetic scope verification post.' },
        notify: false,
      },
    }),
  },
  {
    id: 'adminUpdates.post',
    label: 'city',
    staff: { action: 'update.post_city', target: 'city' },
    request: (fx) => ({
      body: {
        scope: { type: 'city', cityId: fx.world.cityA.id },
        title: { en: `Scope check ${fx.runTag}` },
        body: { en: 'Synthetic scope verification post.' },
        notify: false,
      },
    }),
  },
  {
    id: 'adminUpdates.post',
    label: 'venue',
    staff: { action: 'update.post_venue', target: 'venue' },
    request: (fx) => ({
      body: {
        scope: { type: 'venue', venueId: fx.world.venueA1 },
        title: { en: `Scope check ${fx.runTag}` },
        body: { en: 'Synthetic scope verification post.' },
        notify: false,
      },
    }),
  },
  ...(['national', 'city', 'venue'] as const).map((type): Scenario => ({
    id: 'adminUpdates.preview',
    label: type,
    staff: {
      action:
        type === 'national'
          ? 'update.post_national'
          : type === 'city'
            ? 'update.post_city'
            : 'update.post_venue',
      target: type,
    },
    request: (fx) => ({
      body: {
        scope:
          type === 'national'
            ? { type }
            : type === 'city'
              ? { type, cityId: fx.world.cityA.id }
              : { type, venueId: fx.world.venueA1 },
        title: { en: 'Preview' },
        body: { en: 'Preview' },
      },
    }),
  })),
  {
    id: 'adminRegistrations.export',
    label: 'one venue',
    staff: { action: 'registration.export', target: 'venue' },
    request: (fx) => ({ query: { venueId: fx.world.venueA1 } }),
  },
  {
    id: 'adminRegistrations.export',
    label: 'one city',
    // A venue coordinator may not ask for a whole city, even their own.
    staff: { action: 'registration.export', target: 'city' },
    request: (fx) => ({ query: { cityId: fx.world.cityA.id } }),
  },
  {
    id: 'adminRegistrations.export',
    label: 'whole scope',
    staff: { action: 'registration.export', target: 'any', oracle: 'holds_any' },
    request: () => ({ query: {} }),
  },
  {
    id: 'adminImport.venues',
    label: 'dry run',
    staff: { action: 'venue.create', target: 'city', denied: 'row_forbidden' },
    request: (fx) => ({ body: { dryRun: true, rows: [venueImportRow(fx)] } }),
  },
  {
    id: 'adminImport.sessions',
    label: 'dry run',
    staff: { action: 'session.create', target: 'venue', denied: 'row_forbidden' },
    request: (fx) => ({ body: { dryRun: true, rows: [sessionBody(fx)] } }),
  },
  {
    id: 'adminImport.coordinators',
    label: 'dry run',
    staff: {
      action: 'role.assign_venue_coordinator',
      target: 'venue',
      denied: 'row_forbidden',
      qualifying: ROLE_ACTIONS,
    },
    request: (fx) => ({
      body: {
        dryRun: true,
        rows: [{ role: 'venue_coordinator', venueId: fx.world.venueA1, phone: '+923139999001' }],
      },
    }),
  },
  {
    id: 'adminUpdates.list',
    label: 'list',
    staff: { action: 'update.list_admin', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminTemplates.list',
    label: 'list',
    staff: { action: 'template.read', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminRoles.invite',
    label: 'national admin',
    staff: { action: 'role.assign_national_admin', target: 'national' },
    prepare: 'fresh_phone',
    request: (_fx, p) => ({ body: { role: 'national_admin', phone: p.phone } }),
  },
  {
    id: 'adminRoles.invite',
    label: 'city coordinator',
    staff: { action: 'role.assign_city_coordinator', target: 'city' },
    prepare: 'fresh_phone',
    request: (fx, p) => ({
      body: { role: 'city_coordinator', cityId: fx.world.cityA.id, phone: p.phone },
    }),
  },
  {
    id: 'adminRoles.invite',
    label: 'venue coordinator',
    staff: { action: 'role.assign_venue_coordinator', target: 'venue' },
    prepare: 'fresh_phone',
    request: (fx, p) => ({
      body: { role: 'venue_coordinator', venueId: fx.world.venueA1, phone: p.phone },
    }),
  },
  {
    id: 'adminRoles.invites',
    label: 'list',
    staff: { action: 'role.list', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminRoles.revokeInvite',
    label: 'revoke',
    staff: { action: 'role.assign_venue_coordinator', target: 'venue' },
    request: (fx) => ({ params: { inviteId: fx.inviteId } }),
  },
  {
    id: 'adminRoles.list',
    label: 'list',
    staff: { action: 'role.list', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminRoles.assign',
    label: 'venue coordinator',
    staff: { action: 'role.assign_venue_coordinator', target: 'venue' },
    request: (fx) => ({
      body: {
        role: 'venue_coordinator',
        venueId: fx.world.venueA1,
        userId: fx.handoverTargetUserId,
      },
    }),
  },
  {
    id: 'adminRoles.assign',
    label: 'city coordinator',
    staff: { action: 'role.assign_city_coordinator', target: 'city' },
    request: (fx) => ({
      body: {
        role: 'city_coordinator',
        cityId: fx.world.cityA.id,
        userId: fx.handoverTargetUserId,
      },
    }),
  },
  {
    id: 'adminRoles.assign',
    label: 'national admin',
    staff: { action: 'role.assign_national_admin', target: 'national' },
    request: (fx) => ({ body: { role: 'national_admin', userId: fx.handoverTargetUserId } }),
  },
  {
    id: 'adminRoles.revoke',
    label: 'revoke',
    staff: { action: 'role.assign_venue_coordinator', target: 'venue' },
    request: (fx) => ({ params: { assignmentId: fx.assignmentId } }),
  },
  {
    id: 'adminVenues.list',
    label: 'list',
    staff: { action: 'venue.list_admin', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminVenues.create',
    label: 'create',
    staff: { action: 'venue.create', target: 'city' },
    request: (fx) => ({
      body: {
        cityId: fx.world.cityA.id,
        areaId: fx.world.cityA.areaId,
        name: { en: `Scope new venue ${fx.runTag}` },
        address: { en: '2 Synthetic Road' },
        lat: 31.5,
        lng: 74.3,
      },
    }),
  },
  {
    id: 'adminVenues.update',
    label: 'update',
    staff: { action: 'venue.update', target: 'venue' },
    request: (fx) => ({ params: { venueId: fx.world.venueA1 }, body: { contactPhone: null } }),
  },
  {
    id: 'adminVenues.archive',
    label: 'archive',
    staff: { action: 'venue.archive', target: 'city' },
    last: true,
    request: (fx) => ({ params: { venueId: fx.world.venueA1 } }),
  },
  {
    id: 'adminCircles.list',
    label: 'list',
    staff: { action: 'circle.list_admin', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminCircles.get',
    label: 'get',
    staff: {
      action: 'circle.list_admin',
      target: 'venue',
      oracle: 'list_covers',
      denied: 'not_found',
    },
    request: (fx) => ({ params: { circleId: fx.circleId } }),
  },
  {
    id: 'adminCircles.create',
    label: 'create',
    staff: { action: 'circle.create', target: 'venue' },
    request: (fx) => ({
      body: {
        venueId: fx.world.venueA1,
        name: { en: `Scope circle ${fx.runTag}` },
        language: 'en',
      },
    }),
  },
  {
    id: 'adminCircles.update',
    label: 'update',
    staff: { action: 'circle.update', target: 'venue' },
    request: (fx) => ({ params: { circleId: fx.circleId }, body: { teacherName: 'Teacher Name' } }),
  },
  {
    id: 'adminCircles.decide',
    label: 'approve',
    staff: { action: 'circle.approve', target: 'city' },
    request: (fx) => ({ params: { circleId: fx.circleId }, body: { decision: 'approve' } }),
  },
  {
    id: 'adminSessions.list',
    label: 'list',
    staff: { action: 'session.list_admin', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminSessions.get',
    label: 'get',
    staff: {
      action: 'session.list_admin',
      target: 'venue',
      oracle: 'list_covers',
      denied: 'not_found',
    },
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'adminSessions.create',
    label: 'create',
    staff: { action: 'session.create', target: 'venue' },
    request: (fx) => ({ body: sessionBody(fx) }),
  },
  {
    id: 'adminSessions.update',
    label: 'update',
    staff: { action: 'session.update', target: 'venue' },
    request: (fx) => ({ params: { sessionId: fx.sessionId }, body: { section: 'family' } }),
  },
  {
    id: 'adminSessions.changeSchedule',
    label: 'schedule',
    staff: { action: 'session.change_schedule', target: 'venue' },
    request: (fx) => ({
      params: { sessionId: fx.sessionId },
      body: { localStartTime: '21:30', effectiveFrom: fx.pickDate, notify: false },
    }),
  },
  {
    id: 'adminSessions.occurrences',
    label: 'tick list',
    staff: { action: 'attendance.read', target: 'venue' },
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'adminOccurrences.update',
    label: 'update',
    staff: { action: 'occurrence.update', target: 'venue' },
    request: (fx) => ({
      params: { occurrenceId: fx.occurrenceId },
      body: { recapNote: 'Done', notify: false },
    }),
  },
  {
    id: 'adminAttendance.get',
    label: 'get',
    staff: { action: 'attendance.read', target: 'venue' },
    request: (fx) => ({ params: { occurrenceId: fx.occurrenceId } }),
  },
  {
    id: 'adminAttendance.put',
    label: 'put',
    staff: { action: 'attendance.mark', target: 'venue' },
    request: (fx) => ({
      params: { occurrenceId: fx.occurrenceId },
      body: { headcount: 3, entries: [] },
    }),
  },
  {
    id: 'adminDailyAyahs.list',
    label: 'list',
    staff: { action: 'daily_ayah.manage', target: 'any', oracle: 'holds_any' },
    request: (fx) => ({ query: { from: fx.today, to: fx.pickDate } }),
  },
  {
    id: 'adminDailyAyahs.put',
    label: 'national pick',
    staff: { action: 'daily_ayah.manage', target: 'national' },
    request: (fx) => ({
      body: { date: fx.pickDate, scope: { type: 'national' }, surah: 2, ayah: 255 },
    }),
  },
  {
    id: 'adminDailyAyahs.put',
    label: 'venue pick',
    staff: { action: 'daily_ayah.manage', target: 'venue' },
    request: (fx) => ({
      body: {
        date: fx.pickDate,
        scope: { type: 'venue', venueId: fx.world.venueA1 },
        surah: 1,
        ayah: 1,
      },
    }),
  },
  {
    id: 'adminDailyAyahs.put',
    label: 'circle pick (checked at its venue)',
    staff: { action: 'daily_ayah.manage', target: 'venue' },
    request: (fx) => ({
      body: {
        date: fx.pickDate,
        scope: { type: 'circle', circleId: fx.circleId },
        surah: 112,
        ayah: 1,
      },
    }),
  },
  {
    id: 'adminDailyAyahs.delete',
    label: 'venue pick',
    staff: { action: 'daily_ayah.manage', target: 'venue' },
    request: (fx) => ({ params: { dailyAyahId: fx.venueDailyAyahId } }),
  },
  {
    id: 'adminDailyAyahs.delete',
    label: 'national pick',
    staff: { action: 'daily_ayah.manage', target: 'national' },
    request: (fx) => ({ params: { dailyAyahId: fx.nationalDailyAyahId } }),
  },
  {
    id: 'adminPosters.templates',
    label: 'templates',
    staff: { action: 'poster.create', target: 'any', oracle: 'holds_any' },
    request: () => ({}),
  },
  {
    id: 'adminPosters.create',
    label: 'create',
    staff: { action: 'poster.create', target: 'venue' },
    request: (fx) => ({
      params: { sessionId: fx.sessionId },
      body: {
        templateKey: 'cloud',
        language: 'en',
        formats: ['story'],
        fields: { title: { en: 'Scope poster' } },
      },
    }),
  },
  {
    id: 'adminPosters.list',
    label: 'list',
    staff: { action: 'poster.read', target: 'venue' },
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'adminPosters.regenerate',
    label: 'regenerate',
    staff: { action: 'poster.create', target: 'venue' },
    request: (fx) => ({ params: { posterId: fx.posterId } }),
  },
  {
    id: 'adminPosters.file',
    label: 'file',
    staff: { action: 'poster.read', target: 'venue' },
    request: (fx) => ({ params: { posterId: fx.posterId } }),
  },
  {
    id: 'adminAudit.list',
    label: 'list',
    staff: { action: 'audit.read', target: 'any' },
    request: () => ({}),
  },
  {
    id: 'adminSettings.get',
    label: 'get',
    staff: { action: 'settings.read', target: 'national' },
    request: () => ({}),
  },
  {
    id: 'adminSettings.update',
    label: 'update (same value)',
    staff: { action: 'settings.update', target: 'national' },
    // Writes back the value read at setup, so a staging run changes nothing.
    request: (fx) => ({ body: { hijriOffsetDays: fx.hijriOffsetDays } }),
  },
];

const publicScenarios: Scenario[] = [
  { id: 'system.health', label: 'health', request: () => ({}) },
  {
    id: 'config.get',
    label: 'config',
    request: (fx) => ({ query: { cityId: fx.world.cityA.id } }),
  },
  { id: 'content.page', label: 'about', request: () => ({ params: { slug: 'about' } }) },
  {
    id: 'auth.requestCode',
    label: 'request code',
    prepare: 'fresh_phone',
    request: (_fx, p) => ({ body: { phone: p.phone, locale: 'en', channel: 'whatsapp' } }),
  },
  {
    id: 'auth.verifyCode',
    label: 'verify code',
    prepare: 'challenge',
    request: (fx, p) => ({
      body: { challengeId: p.challengeId, code: fx.fixedCode, deviceLabel: 'qc-scope' },
    }),
  },
  {
    id: 'auth.refresh',
    label: 'refresh',
    prepare: 'fresh_refresh_token',
    request: (_fx, p) => ({ body: { refreshToken: p.refreshToken } }),
  },
  { id: 'community.today', label: 'today', request: () => ({}) },
  {
    id: 'ayahOfTheDay.get',
    label: 'ayah',
    request: (fx) => ({ query: { venueId: [fx.world.venueA1] } }),
  },
  { id: 'places.provinces', label: 'provinces', request: () => ({}) },
  { id: 'places.cities', label: 'cities', request: () => ({}) },
  {
    id: 'places.areas',
    label: 'areas',
    request: (fx) => ({ query: { cityId: fx.world.cityA.id } }),
  },
  {
    id: 'venues.list',
    label: 'list',
    request: (fx) => ({ query: { cityId: fx.world.cityA.id } }),
  },
  { id: 'venues.get', label: 'get', request: (fx) => ({ params: { venueId: fx.world.venueA1 } }) },
  {
    id: 'sessions.list',
    label: 'near a point',
    request: (fx) => ({ query: { cityId: fx.world.cityA.id, lat: 31.52, lng: 74.35 } }),
  },
  {
    id: 'sessions.get',
    label: 'get',
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'sessions.occurrences',
    label: 'occurrences',
    request: (fx) => ({ params: { sessionId: fx.sessionId } }),
  },
  {
    id: 'occurrences.list',
    label: 'list',
    request: (fx) => ({ query: { cityId: fx.world.cityA.id } }),
  },
  {
    id: 'occurrences.get',
    label: 'get',
    request: (fx) => ({ params: { occurrenceId: fx.occurrenceId } }),
  },
];

const userScenarios: Scenario[] = [
  { id: 'me.get', label: 'own', request: () => ({}) },
  { id: 'me.update', label: 'own', request: () => ({ body: { locale: 'en' } }) },
  { id: 'auth.signOut', label: 'own session', disposable: true, request: () => ({}) },
  {
    id: 'me.delete',
    label: 'own account',
    disposable: true,
    request: () => ({ body: { confirm: true } }),
  },
  { id: 'consents.list', label: 'own', request: () => ({}) },
  {
    id: 'consents.set',
    label: 'own',
    request: () => ({ body: { channel: 'push', purpose: 'announcements', granted: true } }),
  },
  { id: 'follows.list', label: 'own', request: () => ({}) },
  {
    id: 'follows.create',
    label: 'own',
    request: (fx) => ({ body: { target: 'venue', venueId: fx.world.venueA1 } }),
  },
  {
    id: 'follows.update',
    label: 'own',
    prepare: 'own_follow_update',
    request: (_fx, p) => ({ params: { followId: p.followId }, body: { alertsEnabled: false } }),
  },
  {
    id: 'follows.update',
    label: "another person's",
    owner: 'other',
    request: (fx) => ({ params: { followId: fx.owner.followId }, body: { alertsEnabled: false } }),
  },
  {
    id: 'follows.delete',
    label: 'own',
    prepare: 'own_follow_delete',
    request: (_fx, p) => ({ params: { followId: p.followId } }),
  },
  {
    id: 'follows.delete',
    label: "another person's",
    owner: 'other',
    request: (fx) => ({ params: { followId: fx.owner.followId } }),
  },
  {
    id: 'devices.register',
    label: 'own',
    prepare: 'fresh_phone',
    request: (_fx, p) => ({
      body: {
        platform: 'android',
        provider: 'fcm',
        token: `qc-scope-fake-${p.phone}`,
        locale: 'en',
      },
    }),
  },
  {
    id: 'devices.remove',
    label: 'own',
    prepare: 'own_device',
    request: (_fx, p) => ({ params: { deviceId: p.deviceId } }),
  },
  {
    id: 'devices.remove',
    label: "another person's",
    owner: 'other',
    request: (fx) => ({ params: { deviceId: fx.owner.deviceId } }),
  },
  { id: 'bookmarks.list', label: 'own', request: () => ({}) },
  {
    id: 'bookmarks.create',
    label: 'own',
    request: () => ({ body: { kind: 'surah', surah: 1 } }),
  },
  {
    id: 'bookmarks.delete',
    label: 'own',
    prepare: 'own_bookmark',
    request: (_fx, p) => ({ params: { bookmarkId: p.bookmarkId } }),
  },
  {
    id: 'bookmarks.delete',
    label: "another person's",
    owner: 'other',
    request: (fx) => ({ params: { bookmarkId: fx.owner.bookmarkId } }),
  },
  {
    id: 'bookmarks.import',
    label: 'own',
    request: () => ({ body: { items: [{ kind: 'para', para: 3 }] } }),
  },
  { id: 'readingPosition.get', label: 'own', request: () => ({}) },
  {
    id: 'readingPosition.put',
    label: 'own',
    request: () => ({ body: { surah: 2, ayah: 1 } }),
  },
  {
    id: 'readingDays.record',
    label: 'own',
    request: () => ({ body: { source: 'manual', pages: 1 } }),
  },
  {
    id: 'readingDays.list',
    label: 'own',
    request: (fx) => ({ query: { from: fx.today, to: fx.today } }),
  },
  { id: 'memorisation.list', label: 'own', request: () => ({}) },
  {
    id: 'memorisation.put',
    label: 'own',
    request: () => ({ params: { surah: 112 }, body: { status: 'learning' } }),
  },
  {
    id: 'memorisation.delete',
    label: 'own',
    prepare: 'own_memorisation',
    request: () => ({ params: { surah: 113 } }),
  },
  { id: 'circleRequests.list', label: 'own', request: () => ({}) },
  {
    id: 'circleRequests.create',
    label: 'own',
    request: (fx) => ({ body: { areaId: fx.world.cityA.areaId, days: [5] } }),
  },
  {
    id: 'circleRequests.cancel',
    label: 'own',
    prepare: 'own_circle_request',
    request: (_fx, p) => ({ params: { requestId: p.circleRequestId } }),
  },
  {
    id: 'circleRequests.cancel',
    label: "another person's",
    owner: 'other',
    request: (fx) => ({ params: { requestId: fx.owner.circleRequestId } }),
  },
  {
    id: 'registrations.create',
    label: 'own',
    request: (fx) => ({
      body: {
        sessionId: fx.sessionId,
        areaId: fx.world.cityA.areaId,
        section: 'family',
        partySize: 1,
        name: 'Scope Person',
        allowWhatsapp: false,
      },
    }),
  },
  { id: 'registrations.listMine', label: 'own', request: () => ({}) },
  {
    id: 'registrations.cancel',
    label: 'own',
    prepare: 'own_registration',
    request: (_fx, p) => ({ params: { registrationId: p.registrationId } }),
  },
  {
    id: 'registrations.cancel',
    label: "another person's",
    owner: 'other',
    request: (fx) => ({ params: { registrationId: fx.owner.registrationId } }),
  },
  { id: 'updates.feed', label: 'own', request: () => ({}) },
  { id: 'updates.unreadCount', label: 'own', request: () => ({}) },
  { id: 'updates.markRead', label: 'own', request: () => ({ body: { all: true } }) },
];

/** Every scenario, in run order: ordinary ones, then disposable ones, then `last` ones. */
export const SCENARIOS: Scenario[] = [...publicScenarios, ...userScenarios, ...staff];

export function runOrder(scenarios: readonly Scenario[] = SCENARIOS): Scenario[] {
  const rank = (s: Scenario): number => (s.last ? 2 : s.disposable ? 1 : 0);
  return [...scenarios].sort((a, b) => rank(a) - rank(b));
}

export const scenarioName = (s: Scenario): string => `${s.id} (${s.label})`;
