import { writeAudit, venueScope } from '../shared/audit';
import { messagingDepsOf } from '../shared/context';
import type { Handlers } from '../shared/route';
import { findSessionScope } from '../sessions/admin';
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
});
