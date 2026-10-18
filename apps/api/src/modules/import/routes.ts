import type { Handlers, HandlerCtx } from '../shared/route';
import { inviteDepsOf, messagingDepsOf } from '../shared/context';
import { importCoordinators, importSessions, importVenues, type ImportCaller } from './service';

/** The caller as the import sees it: who they are, and the scope engine's per-row answer. */
const callerOf = (
  ctx: HandlerCtx<'adminImport.venues' | 'adminImport.sessions' | 'adminImport.coordinators'>,
): ImportCaller => ({
  actorId: ctx.uid(),
  allowed: (action, resource) => ctx.allowed(action, resource),
});

/**
 * Each row is decided on its own (a row outside the caller's scope is invalid with the issue
 * `forbidden`); a caller with no qualifying role anywhere is refused as a whole.
 */
export const importHandlers = (): Handlers => ({
  'adminImport.venues': async (ctx) => {
    ctx.qualify('venue.create');
    return importVenues(ctx.db, callerOf(ctx), ctx.body);
  },

  'adminImport.sessions': async (ctx) => {
    ctx.qualify('session.create');
    return importSessions(ctx.db, messagingDepsOf(ctx.deps, ctx.now), callerOf(ctx), ctx.body);
  },

  'adminImport.coordinators': async (ctx) => {
    ctx.qualify(
      'role.assign_national_admin',
      'role.assign_city_coordinator',
      'role.assign_venue_coordinator',
    );
    return importCoordinators(ctx.db, inviteDepsOf(ctx.deps, ctx.now), callerOf(ctx), ctx.body);
  },
});
