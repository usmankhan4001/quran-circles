import { createServer, type Http2Server } from 'node:http2';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttp2Fetch } from './http2-fetch';

/** A loopback HTTP/2 (cleartext) server stands in for APNs. Nothing leaves the machine. */
let server: Http2Server | undefined;
const open = new Set<import('node:http2').ServerHttp2Session>();
const dropConnections = () => {
  for (const session of open) session.destroy();
  open.clear();
};
afterEach(async () => {
  if (server) {
    const s = server;
    server = undefined;
    dropConnections();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
});

async function listen(
  handler: (
    req: import('node:http2').Http2ServerRequest,
    res: import('node:http2').Http2ServerResponse,
  ) => void,
) {
  server = createServer(handler);
  server.on('session', (session) => {
    open.add(session);
    session.on('close', () => open.delete(session));
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

describe('createHttp2Fetch', () => {
  it('sends the method, path, headers and body, and reads status, headers and text', async () => {
    const seen: { method?: string; path?: string; auth?: string; body: string }[] = [];
    const origin = await listen((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        seen.push({
          method: req.method,
          path: req.url,
          auth: req.headers.authorization,
          body: Buffer.concat(chunks).toString(),
        });
        res.writeHead(410, { 'apns-id': 'abc' });
        res.end('{"reason":"Unregistered"}');
      });
    });
    const f = createHttp2Fetch();
    const res = await f(`${origin}/3/device/tok?x=1`, {
      method: 'POST',
      headers: { authorization: 'bearer t' },
      body: '{"aps":{}}',
    });
    expect(res.status).toBe(410);
    expect(res.headers.get('APNS-ID')).toBe('abc');
    expect(await res.text()).toBe('{"reason":"Unregistered"}');
    expect(seen).toEqual([
      { method: 'POST', path: '/3/device/tok?x=1', auth: 'bearer t', body: '{"aps":{}}' },
    ]);
    f.close();
  });

  it('reuses one session for several requests', async () => {
    let sessions = 0;
    const origin = await listen((_req, res) => {
      res.end('ok');
    });
    server!.on('session', () => (sessions += 1));
    const f = createHttp2Fetch();
    await Promise.all([f(`${origin}/a`), f(`${origin}/b`), f(`${origin}/c`)]);
    expect(sessions).toBe(1);
    f.close();
  });

  it('reconnects after the server drops the session', async () => {
    const origin = await listen((_req, res) => {
      res.end('ok');
    });
    const f = createHttp2Fetch();
    expect((await f(`${origin}/a`)).status).toBe(200);
    dropConnections();
    await new Promise((r) => setTimeout(r, 100));
    expect((await f(`${origin}/b`)).status).toBe(200);
    f.close();
  });

  it('cancels the request when the signal aborts', async () => {
    const origin = await listen(() => {
      /* never answers */
    });
    const f = createHttp2Fetch();
    const controller = new AbortController();
    const pending = f(`${origin}/slow`, { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    await expect(pending).rejects.toBeTruthy();
    f.close();
  });

  it('rejects when nothing is listening', async () => {
    const f = createHttp2Fetch();
    await expect(f('http://127.0.0.1:1/x')).rejects.toBeTruthy();
    f.close();
  });
});
