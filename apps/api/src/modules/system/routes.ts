import type { HealthResponse } from '@qc/contracts';
import type { Handlers } from '../shared/route';
import { getConfig, getContentPage } from './service';

export const healthHandlers = (): Handlers => ({
  'system.health': async () => ({ ok: true, service: 'api' }) satisfies HealthResponse,
});

export const systemHandlers = (): Handlers => ({
  ...healthHandlers(),
  'config.get': (ctx) => getConfig(ctx.db, ctx.now, ctx.query),
  'content.page': (ctx) => getContentPage(ctx.db, ctx.params.slug),
});
