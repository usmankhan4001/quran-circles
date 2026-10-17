import { writeAudit, venueScope } from '../shared/audit';
import { messagingDepsOf } from '../shared/context';
import type { Handlers } from '../shared/route';
import { invalid } from '../shared/errors';
import { compareDates } from '../shared/time';
import { findSessionScope } from '../sessions/admin';
import { findVenue } from '../venues/service';
import { exportAuditScope, exportScopedRegistrations } from './export';
import {
  cancelRegistration,
  createRegistration,
  exportSessionRegistrations,
  listMyRegistrations,
  listSessionRegistrations,
} from './service';

export const registrationHandlers = (): Handlers => ({
  'registrations.create': (ctx) =>
    createRegistration(ctx.db, messagingDepsOf(ctx.deps, ctx.now), ctx.uid(), ctx.body),
  'registrations.listMine': (ctx) => listMyRegistrations(ctx.db, ctx.now, ctx.uid(), ctx.query),
  'registrations.cancel': (ctx) =>
    cancelRegistration(
      ctx.db,
      messagingDepsOf(ctx.deps, ctx.now),
      ctx.uid(),
      ctx.params.registrationId,
    ),

  'registrations.forSession': async (ctx) => {
    const record = await findSessionScope(ctx.db, ctx.params.sessionId);
    if (!record) return ctx.missing('registration.list');
    ctx.authorize('registration.list', { cityId: record.venue.cityId, venueId: record.s.venueId });
    return listSessionRegistrations(ctx.db, record.s.id, ctx.query);
  },

  'registrations.export': async (ctx) => {
    const record = await findSessionScope(ctx.db, ctx.params.sessionId);
    if (!record) return ctx.missing('registration.export');
    ctx.authorize('registration.export', {
      cityId: record.venue.cityId,
      venueId: record.s.venueId,
    });
    const csv = await exportSessionRegistrations(ctx.db, record.s.id);
    await writeAudit(ctx.db, {
      actorUserId: ctx.uid(),
      action: 'registration.export',
      entityType: 'session',
      entityId: record.s.id,
      scope: venueScope({ id: record.s.venueId, cityId: record.venue.cityId }),
    });
    ctx.header('content-disposition', `attachment; filename="registrations-${record.s.id}.csv"`);
    return csv;
  },

  'adminRegistrations.export': async (ctx) => {
    const filter = ctx.scope('registration.export');
    const query = ctx.query;
    if (query.from && query.to && compareDates(query.from, query.to) > 0) {
      invalid('from', 'invalid_range');
    }
    // The file must stay inside the caller's scope: a filter outside it is refused, and with no
    // filter the scope itself limits the rows. An unknown venue is refused like one out of scope.
    const venue = query.venueId ? await findVenue(ctx.db, query.venueId) : null;
    if (query.venueId) {
      ctx.authorize(
        'registration.export',
        venue ? { cityId: venue.cityId, venueId: venue.id } : { venueId: query.venueId },
      );
    } else if (query.cityId) {
      ctx.authorize('registration.export', { cityId: query.cityId });
    }
    const { csv, rows } = await exportScopedRegistrations(ctx.db, filter, query);
    await writeAudit(ctx.db, {
      actorUserId: ctx.uid(),
      action: 'registration.export',
      entityType: 'export',
      entityId: null,
      scope: await exportAuditScope(
        ctx.db,
        filter,
        query,
        venue ? { id: venue.id, cityId: venue.cityId } : null,
      ),
      meta: {
        cityId: query.cityId ?? null,
        venueId: query.venueId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        rows,
      },
    });
    ctx.header('content-disposition', 'attachment; filename="registrations.csv"');
    return csv;
  },
});
