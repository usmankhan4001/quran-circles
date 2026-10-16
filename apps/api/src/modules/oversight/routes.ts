import type { Handlers } from '../shared/route';
import { getSettings, listAudit, updateSettings } from './service';

export const oversightHandlers = (): Handlers => ({
  'adminAudit.list': (ctx) => listAudit(ctx.db, ctx.scope('audit.read'), ctx.query),

  'adminSettings.get': async (ctx) => {
    ctx.authorize('settings.read');
    return getSettings(ctx.db);
  },

  'adminSettings.update': async (ctx) => {
    ctx.authorize('settings.update');
    return updateSettings(ctx.db, ctx.uid(), ctx.body);
  },
});
