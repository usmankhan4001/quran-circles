import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  posterLanguagesOf,
  posterLocaleOf,
  type RendererRenderRequest,
  type RendererRenderResponse,
} from '@qc/contracts';

/** A synthetic token for tests only. */
export const FAKE_RENDERER_TOKEN = 'test-renderer-token-not-a-secret';

const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

export interface RecordedRequest {
  method: string;
  path: string;
  authorization: string | undefined;
  body: RendererRenderRequest;
}

/** How the fake answers one request. */
export type FakeAnswer =
  | { kind: 'render' }
  | { kind: 'status'; status: number; body: unknown }
  | { kind: 'raw'; status: number; text: string }
  | { kind: 'hang' }
  | { kind: 'corrupt' }
  | { kind: 'drop_format' };

/** The answer a real renderer would give, built from the request: deterministic bytes per input. */
export function renderAnswer(request: RendererRenderRequest): RendererRenderResponse {
  return {
    templateId: request.templateId,
    templateVersion: 1,
    provisional: true,
    language: request.language,
    locale: posterLocaleOf(request.language),
    deepLink: `https://example.test/register/${request.session.sessionId}`,
    sourceSnapshot: request.session,
    altText: Object.fromEntries(
      posterLanguagesOf(request.language).map((l) => [l, `Synthetic poster alt text (${l}).`]),
    ),
    files: request.formats.map((format) => {
      const cacheKey = sha256(JSON.stringify([request, format]));
      const pdf = format === 'print_a4' || format === 'print_a3';
      const bytes = new TextEncoder().encode(`${pdf ? '%PDF' : 'PNG'} fake ${cacheKey}`);
      return {
        format,
        contentType: pdf ? ('application/pdf' as const) : ('image/png' as const),
        filename: `poster-${format}.${pdf ? 'pdf' : 'png'}`,
        cacheKey,
        sha256: sha256(bytes),
        byteLength: bytes.byteLength,
        cached: false,
        base64: Buffer.from(bytes).toString('base64'),
      };
    }),
  };
}

/**
 * A stand-in for `apps/poster-renderer`'s `POST /render` on a loopback port. It checks the bearer
 * token like the real one, records what it was sent, and answers with deterministic synthetic files
 * or with whatever `next(...)` queued. No network beyond 127.0.0.1.
 */
export class FakeRenderer {
  readonly requests: RecordedRequest[] = [];
  private readonly queued: FakeAnswer[] = [];
  private fixed: FakeAnswer | undefined;
  private server: Server | undefined;
  url = '';

  constructor(private readonly token: string = FAKE_RENDERER_TOKEN) {}

  async start(): Promise<this> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}`;
    return this;
  }

  /** Queues answers for the next requests, in order; after them the fake renders. */
  next(...answers: FakeAnswer[]): this {
    this.queued.push(...answers);
    return this;
  }

  /** Answers every request with this from now on (until `reset`). */
  always(answer: FakeAnswer): this {
    this.fixed = answer;
    return this;
  }

  reset(): void {
    this.queued.length = 0;
    this.requests.length = 0;
    this.fixed = undefined;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = undefined;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== `Bearer ${this.token}`) {
      send(401, { error: { code: 'unauthenticated' } });
      return;
    }
    if (req.method !== 'POST' || req.url !== '/render') {
      send(404, { error: { code: 'not_found' } });
      return;
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as RendererRenderRequest;
    this.requests.push({
      method: req.method,
      path: req.url,
      authorization: req.headers.authorization,
      body,
    });
    const answer = this.queued.shift() ?? this.fixed ?? { kind: 'render' };
    switch (answer.kind) {
      case 'render':
        send(200, renderAnswer(body));
        return;
      case 'status':
        send(answer.status, answer.body);
        return;
      case 'raw':
        res.writeHead(answer.status, { 'content-type': 'application/json' });
        res.end(answer.text);
        return;
      case 'hang':
        // Never answers; the client's timeout or abort ends it, or `stop` closes the socket.
        return;
      case 'corrupt': {
        const good = renderAnswer(body);
        send(200, {
          ...good,
          files: good.files.map((f) => ({
            ...f,
            base64: Buffer.from('tampered').toString('base64'),
          })),
        });
        return;
      }
      case 'drop_format': {
        const good = renderAnswer(body);
        // One file short, or with one format only, a format nobody asked for.
        const files =
          good.files.length > 1
            ? good.files.slice(0, -1)
            : good.files.map((f) => ({
                ...f,
                format:
                  f.format === 'link_preview' ? ('story' as const) : ('link_preview' as const),
              }));
        send(200, { ...good, files });
        return;
      }
    }
  }
}
