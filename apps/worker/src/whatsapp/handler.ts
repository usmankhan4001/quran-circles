import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  parseWebhook,
  verifySignature,
  verifySubscription,
  type Logger,
  type WhatsAppWebhookEvent,
} from '@qc/messaging';

export const WEBHOOK_PATH = '/webhooks/whatsapp';
export const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

export interface WebhookRequest {
  method: string;
  /** Path without the query string. */
  path: string;
  query: Record<string, string | undefined>;
  /** Header names lower-cased. */
  headers: Record<string, string | undefined>;
  rawBody: Uint8Array;
}

export interface WebhookResponse {
  status: number;
  body: string;
  contentType: 'text/plain' | 'application/json';
}

export interface WebhookHandlerDeps {
  /** Both undefined: the endpoint answers 503, so a half-configured deployment is obvious. */
  appSecret: string | undefined;
  verifyToken: string | undefined;
  logger: Logger;
  /** Applies the events. Awaited before answering, so Meta retries when we could not store them. */
  onEvents(events: WhatsAppWebhookEvent[]): Promise<unknown>;
  /** Answers `/healthz`. */
  health?: () => Promise<{
    ok: boolean;
    details?: Record<string, unknown>;
    metrics?: Record<string, number>;
  }>;
}

const text = (status: number, body: string): WebhookResponse => ({
  status,
  body,
  contentType: 'text/plain',
});

/** The HTTP behaviour of the worker, free of any server so it can be tested without sockets. */
export function createWebhookHandler(deps: WebhookHandlerDeps) {
  return async function handle(req: WebhookRequest): Promise<WebhookResponse> {
    if (req.path === '/healthz') {
      if (req.method !== 'GET') return text(405, 'method not allowed');
      const health = deps.health ? await deps.health().catch(() => ({ ok: false })) : { ok: true };
      return {
        status: health.ok ? 200 : 503,
        body: JSON.stringify(health),
        contentType: 'application/json',
      };
    }
    if (req.path !== WEBHOOK_PATH) return text(404, 'not found');

    if (req.method === 'GET') {
      if (!deps.verifyToken) return text(503, 'webhook not configured');
      const check = verifySubscription(deps.verifyToken, req.query);
      if (!check.ok) {
        deps.logger.warn('whatsapp.webhook.handshake_rejected');
        return text(403, 'forbidden');
      }
      return text(200, check.challenge);
    }

    if (req.method !== 'POST') return text(405, 'method not allowed');
    if (!deps.appSecret) return text(503, 'webhook not configured');
    if (!verifySignature(deps.appSecret, req.rawBody, req.headers['x-hub-signature-256'])) {
      deps.logger.warn('whatsapp.webhook.bad_signature');
      return text(401, 'invalid signature');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(req.rawBody).toString('utf8'));
    } catch {
      // Signed but not JSON: nothing to retry.
      deps.logger.warn('whatsapp.webhook.bad_json');
      return text(400, 'bad request');
    }
    const events = parseWebhook(parsed);
    try {
      if (events.length > 0) await deps.onEvents(events);
    } catch (error) {
      deps.logger.error('whatsapp.webhook.store_failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
      return text(500, 'try again');
    }
    return text(200, 'ok');
  };
}

export type WebhookHandler = ReturnType<typeof createWebhookHandler>;

async function readBody(req: IncomingMessage, limit: number): Promise<Uint8Array | 'too_large'> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buf.length;
    if (size > limit) return 'too_large';
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function send(res: ServerResponse, response: WebhookResponse): void {
  res.writeHead(response.status, { 'content-type': `${response.contentType}; charset=utf-8` });
  res.end(response.body);
}

/** A thin `node:http` server around the handler. */
export function createWebhookServer(handler: WebhookHandler, logger: Logger): Server {
  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://worker.local');
        const query: Record<string, string | undefined> = {};
        for (const [key, value] of url.searchParams) query[key] = value;
        const headers: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
        const declared = Number(headers['content-length'] ?? 0);
        if (declared > MAX_WEBHOOK_BODY_BYTES) {
          res.writeHead(413, { connection: 'close' });
          res.end();
          return;
        }
        const body = await readBody(req, MAX_WEBHOOK_BODY_BYTES);
        if (body === 'too_large') {
          res.writeHead(413, { connection: 'close' });
          res.end();
          return;
        }
        send(
          res,
          await handler({
            method: req.method ?? 'GET',
            path: url.pathname,
            query,
            headers,
            rawBody: body,
          }),
        );
      } catch (error) {
        logger.error('worker.http.unhandled', {
          error: error instanceof Error ? error.name : 'unknown',
        });
        if (!res.headersSent) res.writeHead(500);
        res.end();
      }
    })();
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}
