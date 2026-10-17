import { createHash } from 'node:crypto';
import {
  RendererErrorResponse,
  RendererRenderResponse,
  posterFailureFromRenderer,
  type PosterFailureCode,
  type PosterFormat,
  type RendererRenderRequest,
} from '@qc/contracts';

/** How the worker reaches the renderer (`RENDERER_URL`, `RENDERER_TOKEN`, `RENDERER_TIMEOUT_MS`). */
export interface RendererClientConfig {
  /** The renderer's base URL on the internal network, e.g. `http://poster-renderer:8090`. */
  url: string;
  /** The shared bearer token. Never logged. */
  token: string;
  /** Give up on one call after this long. Must stay under the queue's 120 s expiry. */
  timeoutMs: number;
  /** For tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

/** One file from the renderer, decoded and checked against its hash. */
export interface RenderedPosterFile {
  format: PosterFormat;
  contentType: 'image/png' | 'application/pdf';
  cacheKey: string;
  bytes: Uint8Array;
}

export type RendererCallResult =
  | { ok: true; response: RendererRenderResponse; files: RenderedPosterFile[] }
  | {
      ok: false;
      failure: PosterFailureCode;
      /** The HTTP status, or 0 when no answer came (network error, timeout). */
      status: number;
    };

/** `<base>/render`, keeping any path on the base URL. */
export const renderEndpoint = (base: string): URL =>
  new URL('render', base.endsWith('/') ? base : `${base}/`);

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/**
 * `POST <RENDERER_URL>/render` with `Authorization: Bearer <RENDERER_TOKEN>`. Never throws for a
 * renderer problem: every way the call can go wrong becomes a `PosterFailureCode`
 * (`posterFailureFromRenderer` for answers, `render_timeout` when the time ran out or the job was
 * aborted, `render_failed` for a network error, an unreadable answer or a file whose bytes do not
 * match its hash).
 */
export async function callRenderer(
  config: RendererClientConfig,
  request: RendererRenderRequest,
  signal?: AbortSignal,
): Promise<RendererCallResult> {
  const timeout = AbortSignal.timeout(config.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const fail = (failure: PosterFailureCode, status: number): RendererCallResult => ({
    ok: false,
    failure,
    status,
  });
  const failOnError = (status: number): RendererCallResult =>
    combined.aborted ? fail('render_timeout', status) : fail(posterFailureFromRenderer(0), status);

  let answer: Response;
  try {
    answer = await (config.fetch ?? fetch)(renderEndpoint(config.url), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(request),
      redirect: 'error',
      signal: combined,
    });
  } catch {
    return failOnError(0);
  }

  let json: unknown;
  try {
    json = await answer.json();
  } catch {
    if (combined.aborted) return fail('render_timeout', answer.status);
    json = undefined;
  }

  if (!answer.ok) {
    const error = RendererErrorResponse.safeParse(json);
    return fail(
      posterFailureFromRenderer(answer.status, error.success ? error.data.error.code : undefined),
      answer.status,
    );
  }

  const parsed = RendererRenderResponse.safeParse(json);
  if (!parsed.success) return fail('render_failed', answer.status);

  const files: RenderedPosterFile[] = [];
  for (const file of parsed.data.files) {
    const bytes = new Uint8Array(Buffer.from(file.base64, 'base64'));
    if (bytes.byteLength !== file.byteLength || sha256(bytes) !== file.sha256) {
      return fail('render_failed', answer.status);
    }
    files.push({
      format: file.format,
      contentType: file.contentType,
      cacheKey: file.cacheKey,
      bytes,
    });
  }
  return { ok: true, response: parsed.data, files };
}
