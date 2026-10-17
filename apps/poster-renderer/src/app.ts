import { timingSafeEqual } from 'node:crypto';
import {
  POSTER_ACCENTS,
  POSTER_LANGUAGES,
  type RendererErrorResponse,
  type RendererRenderResponse,
} from '@qc/contracts';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { TextTooLongError } from './browser';
import { classify } from './errors';
import { RenderRequest } from './input';
import type { Limiter } from './limiter';
import type { Logger } from './logger';
import type { PosterRenderer, RenderResult } from './renderer';
import { TEMPLATES } from './templates';

export interface AppDeps {
  renderer: PosterRenderer;
  limiter: Limiter;
  logger: Logger;
  /** When set, every route but `/healthz` needs `Authorization: Bearer <token>`. */
  token?: string;
}

/** Requests are small: a template id, a few short texts and the session snapshot. */
export const MAX_BODY_BYTES = 64 * 1024;

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Every error answer has the contract's `RendererErrorResponse` shape: codes, paths, box names. */
const error = (
  c: Context,
  status: 400 | 401 | 404 | 413 | 422 | 500 | 503 | 504,
  code: string,
  extra: Omit<RendererErrorResponse['error'], 'code'> = {},
) => c.json({ error: { code, ...extra } } satisfies RendererErrorResponse, status);

/**
 * The JSON body of a render (the contract's `RendererRenderResponse`): the files as base64, with
 * everything the API stores beside them.
 */
export function renderBody(result: RenderResult): RendererRenderResponse {
  return {
    ...result,
    files: result.files.map(({ bytes, ...file }) => ({
      ...file,
      base64: bytes.toString('base64'),
    })),
  };
}

/**
 * The renderer's HTTP interface, for the api and the worker on the internal network only (it is not
 * routed by the proxy):
 *
 * - `GET /healthz`: liveness and load.
 * - `GET /templates`: the locked templates, their formats, accents and languages. `cloud` and
 *   `night` are the demo templates and say `provisional: true` until the final designs.
 * - `POST /render`: a `RendererRenderRequest` for a template this renderer has; answers a
 *   `RendererRenderResponse`, or a `RendererErrorResponse`.
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get('/healthz', (c) =>
    c.json({ ok: true, active: deps.limiter.active, queued: deps.limiter.queued }),
  );

  app.use('*', async (c, next) => {
    if (!deps.token) return next();
    const header = c.req.header('authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!safeEqual(given, deps.token)) return error(c, 401, 'unauthenticated');
    return next();
  });

  app.get('/templates', (c) =>
    c.json({
      items: Object.values(TEMPLATES).map((tpl) => ({
        id: tpl.id,
        version: tpl.version,
        name: tpl.name,
        formats: tpl.formats,
        accents: POSTER_ACCENTS,
        languages: POSTER_LANGUAGES,
        provisional: tpl.provisional,
      })),
    }),
  );

  app.post(
    '/render',
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => error(c, 413, 'payload_too_large') }),
    async (c) => {
      let json: unknown;
      try {
        json = await c.req.json();
      } catch {
        return error(c, 400, 'validation_failed', { issues: [{ path: '', code: 'invalid_json' }] });
      }
      const parsed = RenderRequest.safeParse(json);
      if (!parsed.success) {
        // Paths and issue codes only: never echo a value back or into the logs.
        const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code }));
        return error(c, 400, 'validation_failed', { issues });
      }
      try {
        const result = await deps.renderer.render(parsed.data);
        return c.json(renderBody(result));
      } catch (e) {
        const { code } = classify(e);
        deps.logger.warn('render.failed', { code, template: parsed.data.templateId });
        if (e instanceof TextTooLongError) {
          return error(c, 422, code, { fields: e.fields, regions: e.regions });
        }
        if (code === 'busy') {
          c.header('Retry-After', '5');
          return error(c, 503, code);
        }
        if (code === 'render_timeout') return error(c, 504, code);
        return error(c, 500, code);
      }
    },
  );

  app.notFound((c) => error(c, 404, 'not_found'));
  app.onError((e, c) => {
    deps.logger.error('http.error', { error: e.name });
    return error(c, 500, 'internal_error');
  });
  return app;
}
