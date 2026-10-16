import { createApiClient, type ApiClient } from '@qc/contracts';
import type { ContentApi } from '../account/api';

export interface ServerBookmark {
  id: string;
  kind: 'ayah' | 'surah' | 'para';
  surah: number | null;
  ayah: number | null;
  para: number | null;
  note: string | null;
  createdAt: string;
}

export interface FakeAccountServer {
  fetch: typeof fetch;
  /** A real typed client from @qc/contracts pointed at this fake, so requests are checked against the contract. */
  api: ContentApi;
  client: ApiClient;
  bookmarks: ServerBookmark[];
  position: { surah: number; ayah: number; updatedAt: string } | null;
  /** Every request as "METHOD /path". */
  requests: string[];
  /** While true, every request fails like a dropped connection. */
  offline: boolean;
  /** Answer the next request with this error code and status. */
  failNext?: { status: number; code: string };
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const keyOf = (b: { kind: string; surah?: number | null; ayah?: number | null; para?: number | null }) =>
  `${b.kind}:${b.surah ?? ''}:${b.ayah ?? ''}:${b.para ?? ''}`;

/** An in-memory stand-in for the bookmark and reading-position endpoints. */
export function createFakeAccountServer(now: () => Date = () => new Date()): FakeAccountServer {
  let counter = 0;
  const server: FakeAccountServer = {
    bookmarks: [],
    position: null,
    requests: [],
    offline: false,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      server.requests.push(`${method} ${url.pathname}`);
      if (server.offline) throw new TypeError('Failed to fetch');
      if (server.failNext) {
        const { status, code } = server.failNext;
        server.failNext = undefined;
        return error(status, code);
      }
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      const path = url.pathname;

      if (path === '/v1/me/bookmarks' && method === 'GET') return ok(200, { items: server.bookmarks });
      if (path === '/v1/me/bookmarks' && method === 'POST') {
        const input = body as Omit<ServerBookmark, 'id' | 'createdAt'>;
        const full = normalise(input);
        if (server.bookmarks.some((b) => keyOf(b) === keyOf(full))) return error(409, 'conflict');
        const created = { ...full, id: uuid(++counter), createdAt: now().toISOString() };
        server.bookmarks.push(created);
        return ok(201, created);
      }
      if (path === '/v1/me/bookmarks/import' && method === 'POST') {
        const items = (body as { items: Partial<ServerBookmark>[] }).items;
        let imported = 0;
        let skipped = 0;
        for (const item of items) {
          const full = normalise(item);
          if (server.bookmarks.some((b) => keyOf(b) === keyOf(full))) {
            skipped++;
          } else {
            server.bookmarks.push({ ...full, id: uuid(++counter), createdAt: now().toISOString() });
            imported++;
          }
        }
        return ok(200, { imported, skipped });
      }
      const del = /^\/v1\/me\/bookmarks\/([^/]+)$/.exec(path);
      if (del && method === 'DELETE') {
        const index = server.bookmarks.findIndex((b) => b.id === del[1]);
        if (index < 0) return error(404, 'not_found');
        server.bookmarks.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      if (path === '/v1/me/reading-position' && method === 'GET') {
        return server.position ? ok(200, server.position) : error(404, 'not_found');
      }
      if (path === '/v1/me/reading-position' && method === 'PUT') {
        const input = body as { surah: number; ayah: number };
        server.position = { surah: input.surah, ayah: input.ayah, updatedAt: now().toISOString() };
        return ok(200, server.position);
      }
      return error(404, 'not_found');
    }) as typeof fetch,
    api: undefined as unknown as ContentApi,
    client: undefined as unknown as ApiClient,
  };
  server.client = createApiClient({
    baseUrl: 'http://fake.test',
    fetch: server.fetch,
    getAccessToken: () => 'fake-test-token',
  });
  server.api = server.client;
  return server;
}

function normalise(input: Partial<ServerBookmark>) {
  return {
    kind: input.kind ?? 'ayah',
    surah: input.surah ?? null,
    ayah: input.ayah ?? null,
    para: input.para ?? null,
    note: input.note ?? null,
  } as Omit<ServerBookmark, 'id' | 'createdAt'>;
}

const ok = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const error = (status: number, code: string) =>
  ok(status, { error: { code, messageKey: `errors.${code}`, requestId: 'test-request' } });
