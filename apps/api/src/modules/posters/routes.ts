import type { HandlerCtx, Handlers } from '../shared/route';
import type { EndpointId } from '@qc/contracts';
import { throttle } from '../shared/throttle';
import { posterRuntimeFor } from './runtime';
import {
  createPosters,
  listPosters,
  listTemplates,
  readPosterFile,
  regeneratePoster,
  type PosterDeps,
} from './service';

const depsOf = <K extends EndpointId>(ctx: HandlerCtx<K>): PosterDeps => ({
  db: ctx.db,
  runtime: posterRuntimeFor(ctx.deps),
  logger: ctx.deps.logger,
  now: ctx.now,
  guard: ctx,
});

/**
 * SEC-13: making or remaking a poster queues a render job and adds rows and files, so each staff
 * member has one shared, tighter allowance for both calls (`posterRateLimit`, 10 a minute).
 */
const posterThrottle = <K extends EndpointId>(ctx: HandlerCtx<K>): Promise<void> =>
  throttle(ctx.deps, 'poster_write', ctx.uid(), ctx.deps.config.posterRateLimit, ctx.now);

/**
 * Posters (contract 1.0.0-rc.5, WP16). Every check is at the session's venue (for a poster, its
 * session's venue): `poster.create` to make or remake, `poster.read` to list or download. The
 * template list only needs `poster.create` somewhere. The renders themselves are the worker's.
 */
export const posterHandlers = (): Handlers => ({
  'adminPosters.templates': (ctx) => {
    ctx.qualify('poster.create');
    return listTemplates(ctx.db);
  },
  'adminPosters.create': async (ctx) => {
    await posterThrottle(ctx);
    return createPosters(depsOf(ctx), ctx.uid(), ctx.params.sessionId, ctx.body);
  },
  'adminPosters.list': (ctx) => listPosters(depsOf(ctx), ctx.params.sessionId),
  'adminPosters.regenerate': async (ctx) => {
    await posterThrottle(ctx);
    return regeneratePoster(depsOf(ctx), ctx.uid(), ctx.params.posterId);
  },
  'adminPosters.file': async (ctx) => {
    const file = await readPosterFile(depsOf(ctx), ctx.params.posterId);
    ctx.header('content-type', file.contentType);
    ctx.header('content-disposition', `attachment; filename="${file.filename}"`);
    return file.bytes;
  },
});
