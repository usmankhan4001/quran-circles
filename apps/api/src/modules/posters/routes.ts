import type { HandlerCtx, Handlers } from '../shared/route';
import type { EndpointId } from '@qc/contracts';
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
 * Posters (contract 1.0.0-rc.5, WP16). Every check is at the session's venue (for a poster, its
 * session's venue): `poster.create` to make or remake, `poster.read` to list or download. The
 * template list only needs `poster.create` somewhere. The renders themselves are the worker's.
 */
export const posterHandlers = (): Handlers => ({
  'adminPosters.templates': (ctx) => {
    ctx.qualify('poster.create');
    return listTemplates(ctx.db);
  },
  'adminPosters.create': (ctx) =>
    createPosters(depsOf(ctx), ctx.uid(), ctx.params.sessionId, ctx.body),
  'adminPosters.list': (ctx) => listPosters(depsOf(ctx), ctx.params.sessionId),
  'adminPosters.regenerate': (ctx) => regeneratePoster(depsOf(ctx), ctx.uid(), ctx.params.posterId),
  'adminPosters.file': async (ctx) => {
    const file = await readPosterFile(depsOf(ctx), ctx.params.posterId);
    ctx.header('content-type', file.contentType);
    ctx.header('content-disposition', `attachment; filename="${file.filename}"`);
    return file.bytes;
  },
});
