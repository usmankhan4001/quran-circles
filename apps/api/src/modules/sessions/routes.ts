import type { Handlers } from '../shared/route';
import { messagingDepsOf } from '../shared/context';
import { findVenue } from '../venues/service';
import {
  changeSchedule,
  createSession,
  findOccurrence,
  findSessionScope,
  listAdminOccurrences,
  listAdminSessions,
  updateOccurrence,
  updateSession,
} from './admin';
import {
  getPublicOccurrence,
  getPublicOccurrences,
  getPublicSession,
  listPublicOccurrences,
  listPublicSessions,
} from './public';

export const sessionHandlers = (): Handlers => ({
  'sessions.list': (ctx) => listPublicSessions(ctx.db, ctx.now, ctx.query),
  'sessions.get': (ctx) => getPublicSession(ctx.db, ctx.now, ctx.params.sessionId),
  'sessions.occurrences': (ctx) =>
    getPublicOccurrences(
      ctx.db,
      ctx.now,
      ctx.deps.config.occurrenceHorizonDays,
      ctx.params.sessionId,
      ctx.query,
    ),
  'occurrences.list': (ctx) => listPublicOccurrences(ctx.db, ctx.now, ctx.query),
  'occurrences.get': (ctx) => getPublicOccurrence(ctx.db, ctx.now, ctx.params.occurrenceId),

  'adminSessions.list': (ctx) =>
    listAdminSessions(ctx.db, ctx.now, ctx.scope('session.list_admin'), ctx.query),

  'adminSessions.create': async (ctx) => {
    const venue = await findVenue(ctx.db, ctx.body.venueId);
    if (!venue) return ctx.missing('session.create');
    ctx.authorize('session.create', { cityId: venue.cityId, venueId: venue.id });
    return createSession(
      ctx.db,
      messagingDepsOf(ctx.deps, ctx.now),
      ctx.uid(),
      { id: venue.id, cityId: venue.cityId },
      ctx.body,
    );
  },

  'adminSessions.update': async (ctx) => {
    const record = await findSessionScope(ctx.db, ctx.params.sessionId);
    if (!record) return ctx.missing('session.update');
    ctx.authorize('session.update', { cityId: record.venue.cityId, venueId: record.s.venueId });
    return updateSession(
      ctx.db,
      messagingDepsOf(ctx.deps, ctx.now),
      ctx.uid(),
      record.s.id,
      ctx.body,
    );
  },

  'adminSessions.changeSchedule': async (ctx) => {
    const record = await findSessionScope(ctx.db, ctx.params.sessionId);
    if (!record) return ctx.missing('session.change_schedule');
    ctx.authorize('session.change_schedule', {
      cityId: record.venue.cityId,
      venueId: record.s.venueId,
    });
    return changeSchedule(
      ctx.db,
      messagingDepsOf(ctx.deps, ctx.now),
      ctx.uid(),
      record.s.id,
      ctx.body,
    );
  },

  'adminSessions.occurrences': async (ctx) => {
    const record = await findSessionScope(ctx.db, ctx.params.sessionId);
    if (!record) return ctx.missing('attendance.read');
    ctx.authorize('attendance.read', { cityId: record.venue.cityId, venueId: record.s.venueId });
    return listAdminOccurrences(ctx.db, ctx.now, record.s, ctx.query);
  },

  'adminOccurrences.update': async (ctx) => {
    const found = await findOccurrence(ctx.db, ctx.params.occurrenceId);
    if (!found) return ctx.missing('occurrence.update');
    ctx.authorize('occurrence.update', { cityId: found.cityId, venueId: found.venueId });
    return updateOccurrence(
      ctx.db,
      messagingDepsOf(ctx.deps, ctx.now),
      ctx.uid(),
      found.occurrence.id,
      ctx.body,
    );
  },
});
