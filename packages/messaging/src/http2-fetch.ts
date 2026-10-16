import { connect, constants, type ClientHttp2Session } from 'node:http2';
import type { FetchLike, HttpRequestInit, HttpResponseLike } from './http';

/**
 * A minimal fetch over HTTP/2, for APNs, which accepts nothing else. It keeps one session per
 * origin and reconnects when the server closes it. Production wiring only; tests use a fake fetch,
 * except one loopback test of this transport itself.
 */
export function createHttp2Fetch(): FetchLike & { close(): void } {
  const sessions = new Map<string, ClientHttp2Session>();

  const sessionFor = (origin: string): ClientHttp2Session => {
    const existing = sessions.get(origin);
    if (existing && !existing.closed && !existing.destroyed) return existing;
    const session = connect(origin);
    session.on('error', () => sessions.delete(origin));
    session.on('close', () => sessions.delete(origin));
    // Do not keep the process alive for an idle session.
    session.unref();
    sessions.set(origin, session);
    return session;
  };

  const fn = ((url: string, init: HttpRequestInit = {}): Promise<HttpResponseLike> =>
    new Promise((resolve, reject) => {
      const target = new URL(url);
      const session = sessionFor(target.origin);
      const headers: Record<string, string> = {
        ...(init.headers ?? {}),
        [constants.HTTP2_HEADER_METHOD]: init.method ?? 'GET',
        [constants.HTTP2_HEADER_PATH]: `${target.pathname}${target.search}`,
      };
      const request = session.request(headers);
      let status = 0;
      const responseHeaders = new Map<string, string>();
      const chunks: Buffer[] = [];
      const abort = (): void => request.close(constants.NGHTTP2_CANCEL);
      init.signal?.addEventListener('abort', abort, { once: true });
      request.on('response', (h) => {
        status = Number(h[constants.HTTP2_HEADER_STATUS] ?? 0);
        for (const [k, v] of Object.entries(h)) {
          if (typeof v === 'string') responseHeaders.set(k.toLowerCase(), v);
        }
      });
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('error', reject);
      request.on('close', () => {
        init.signal?.removeEventListener('abort', abort);
        if (status === 0) {
          reject(new Error('http2_no_response'));
          return;
        }
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status,
          headers: { get: (name) => responseHeaders.get(name.toLowerCase()) ?? null },
          text: () => Promise.resolve(text),
        });
      });
      if (init.body !== undefined) request.end(init.body);
      else request.end();
    })) as FetchLike & { close(): void };

  fn.close = () => {
    for (const s of sessions.values()) s.close();
    sessions.clear();
  };
  return fn;
}
