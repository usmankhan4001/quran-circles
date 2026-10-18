import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

type Listener = (event: Record<string, unknown>) => void;

/** What the fake network answers: by default a 200 same-origin HTML page. */
interface FakeNetworkResponse {
  status?: number;
  type?: string;
  url?: string;
  contentType?: string | null;
}

/** Runs `public/sw.js` against small fakes of the worker scope, and records what it does. */
function loadWorker(
  options: { cached?: Set<string>; networkFails?: boolean; response?: FakeNetworkResponse } = {},
) {
  const listeners = new Map<string, Listener>();
  const stored = new Map<string, unknown>();
  const cache = {
    addAll: async (urls: string[]) => urls.forEach((u) => stored.set(u, 'shell')),
    put: async (request: unknown, response: unknown) => {
      stored.set(
        typeof request === 'string' ? request : (request as { url: string }).url,
        response,
      );
    },
  };
  const deleted: string[] = [];
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  const focused: number[] = [];
  const windows: { navigate: (u: string) => Promise<void>; focus: () => Promise<void> }[] = [];
  const fetched: string[] = [];

  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (name: string, fn: Listener) => listeners.set(name, fn),
    skipWaiting: async () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async () => windows,
      openWindow: async (url: string) => {
        opened.push(url);
      },
    },
    registration: {
      showNotification: async (title: string, o: Record<string, unknown>) => {
        shown.push({ title, options: o });
      },
    },
  };
  const caches = {
    open: async () => cache,
    keys: async () => ['qc-shell-v0', 'qc-shell-v1', 'qc-shell-v2'],
    delete: async (key: string) => {
      deleted.push(key);
      return true;
    },
    match: async (request: unknown) => {
      const key = typeof request === 'string' ? request : (request as { url: string }).url;
      return options.cached?.has(key) ? `cached:${key}` : undefined;
    },
  };
  class FakeResponse {
    status: number;
    ok: boolean;
    type: string;
    url: string;
    headers: { get: (name: string) => string | null };
    constructor(requestUrl: string) {
      const r = options.response ?? {};
      this.status = r.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.type = r.type ?? 'basic';
      this.url = r.url ?? requestUrl;
      const contentType = r.contentType === undefined ? 'text/html; charset=utf-8' : r.contentType;
      this.headers = {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
      };
    }
    clone() {
      return this;
    }
    static error() {
      return 'error-response';
    }
  }
  const fetchFn = async (request: { url: string }) => {
    fetched.push(request.url);
    if (options.networkFails) throw new Error('offline');
    return new FakeResponse(request.url);
  };
  runInNewContext(readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8'), {
    self,
    caches,
    URL,
    fetch: fetchFn,
    Response: FakeResponse,
  });

  const fetchEvent = (url: string, init: { method?: string; mode?: string } = {}) => {
    let response: unknown;
    const event = {
      request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' },
      respondWith: (value: unknown) => {
        response = value;
      },
    };
    listeners.get('fetch')!(event);
    return { handled: response !== undefined, response };
  };

  return {
    listeners,
    stored,
    deleted,
    shown,
    opened,
    navigated,
    focused,
    windows,
    fetched,
    fetchEvent,
    waitUntilOf: async (name: string, event: Record<string, unknown> = {}) => {
      let promise: Promise<unknown> = Promise.resolve();
      listeners.get(name)!({ ...event, waitUntil: (p: Promise<unknown>) => (promise = p) });
      await promise;
    },
  };
}

describe('service worker', () => {
  let worker: ReturnType<typeof loadWorker>;
  beforeEach(() => {
    worker = loadWorker({ cached: new Set(['/', 'https://app.test/assets/logo.png']) });
  });

  it('saves the shell on install and removes older versions when it takes over', async () => {
    await worker.waitUntilOf('install');
    expect([...worker.stored.keys()]).toEqual(
      expect.arrayContaining(['/', '/boot.js', '/manifest.webmanifest', '/icons/icon-192.png']),
    );
    await worker.waitUntilOf('activate');
    expect(worker.deleted).toEqual(['qc-shell-v0', 'qc-shell-v1']);
  });

  it('never touches another origin, so API calls are never saved', () => {
    expect(worker.fetchEvent('https://api.example/v1/me').handled).toBe(false);
  });

  it('never touches a request that is not a plain read', () => {
    expect(worker.fetchEvent('https://app.test/v1/registrations', { method: 'POST' }).handled).toBe(
      false,
    );
  });

  it('leaves unknown same-origin requests to the network', () => {
    expect(worker.fetchEvent('https://app.test/some/data.json').handled).toBe(false);
  });

  it('answers a saved built file from the saved copy', async () => {
    const { handled, response } = worker.fetchEvent('https://app.test/assets/logo.png');
    expect(handled).toBe(true);
    await expect(response).resolves.toBe('cached:https://app.test/assets/logo.png');
    expect(worker.fetched).toHaveLength(0);
  });

  it('reads the start-up script from the network first and saves the new copy', async () => {
    const online = loadWorker({ cached: new Set(['/boot.js']) });
    const { handled, response } = online.fetchEvent('https://app.test/boot.js');
    expect(handled).toBe(true);
    await expect(response).resolves.toMatchObject({ status: 200 });
    await new Promise((done) => setTimeout(done, 0));
    expect(online.fetched).toEqual(['https://app.test/boot.js']);
    expect(online.stored.get('/boot.js')).toMatchObject({ status: 200 });
  });

  it('starts from the saved start-up script when there is no connection', async () => {
    const offline = loadWorker({ cached: new Set(['/boot.js']), networkFails: true });
    const { response } = offline.fetchEvent('https://app.test/boot.js');
    await expect(response).resolves.toBe('cached:/boot.js');
    const none = loadWorker({ networkFails: true });
    await expect(none.fetchEvent('https://app.test/boot.js').response).resolves.toBe(
      'error-response',
    );
  });

  it('never saves a failed start-up script', async () => {
    const failing = loadWorker({ response: { status: 404 } });
    await failing.fetchEvent('https://app.test/boot.js').response;
    await new Promise((done) => setTimeout(done, 0));
    expect(failing.stored.has('/boot.js')).toBe(false);
  });

  it('opens the saved shell for a page load when there is no connection', async () => {
    const offline = loadWorker({ cached: new Set(['/']), networkFails: true });
    const { response } = offline.fetchEvent('https://app.test/home', { mode: 'navigate' });
    await expect(response).resolves.toBe('cached:/');
  });

  describe('saving the shell from a page load (SEC-23)', () => {
    /** Loads a page online, lets the cache write settle, and says whether the shell changed. */
    async function shellAfterPageLoad(url: string, response?: FakeNetworkResponse) {
      const online = loadWorker({ response });
      const { handled, response: answer } = online.fetchEvent(url, { mode: 'navigate' });
      if (handled) await answer;
      await new Promise((done) => setTimeout(done, 0));
      return { handled, saved: online.stored.get('/') };
    }

    it('saves a successful same-origin HTML page as the shell', async () => {
      const { handled, saved } = await shellAfterPageLoad('https://app.test/home');
      expect(handled).toBe(true);
      expect(saved).toMatchObject({ status: 200, url: 'https://app.test/home' });
    });

    it('accepts text/html in any letter case', async () => {
      const { saved } = await shellAfterPageLoad('https://app.test/home', {
        contentType: 'Text/HTML',
      });
      expect(saved).toBeDefined();
    });

    it.each([
      ['an error page', { status: 404 }],
      ['a server error', { status: 500 }],
      ['a success that is not 200', { status: 204 }],
      ['a redirect the browser handles itself', { status: 0, type: 'opaqueredirect' }],
      ['JSON', { contentType: 'application/json' }],
      ['plain text', { contentType: 'text/plain' }],
      ['a response with no content type', { contentType: null }],
      ['a cross-origin response', { type: 'cors', url: 'https://evil.example/page' }],
      ['a basic response that ended on another origin', { url: 'https://evil.example/page' }],
    ] as const)('does not save %s as the shell', async (_name, response) => {
      const { handled, saved } = await shellAfterPageLoad('https://app.test/home', response);
      expect(handled).toBe(true);
      expect(saved).toBeUndefined();
    });

    it('still passes a refused response on to the page', async () => {
      const online = loadWorker({ response: { status: 404 } });
      const { response } = online.fetchEvent('https://app.test/missing', { mode: 'navigate' });
      await expect(response).resolves.toMatchObject({ status: 404 });
    });

    it.each(['https://app.test/api/v1/config', 'https://app.test/webhooks/whatsapp'])(
      'leaves a page load of the server path %s to the network and saves nothing',
      async (url) => {
        const { handled, saved } = await shellAfterPageLoad(url, {
          contentType: 'application/json',
        });
        expect(handled).toBe(false);
        expect(saved).toBeUndefined();
      },
    );
  });

  it('shows a notification from a push, with a safe link', async () => {
    await worker.waitUntilOf('push', {
      data: { json: () => ({ title: 'Reminder', body: 'Starts soon', url: '/session/abc' }) },
    });
    expect(worker.shown[0]).toMatchObject({
      title: 'Reminder',
      options: { body: 'Starts soon', data: { url: '/session/abc' } },
    });
  });

  it('ignores a link that leaves the app, and copes with a push that has no data', async () => {
    await worker.waitUntilOf('push', {
      data: { json: () => ({ title: 'Hi', url: 'https://evil.example' }) },
    });
    await worker.waitUntilOf('push', {});
    expect(worker.shown[0]!.options.data).toEqual({ url: '/home' });
    expect(worker.shown[1]).toMatchObject({ title: 'Quran Circles' });
  });

  it('opens the session when a notification is tapped and no window is open', async () => {
    let closed = false;
    await worker.waitUntilOf('notificationclick', {
      notification: { close: () => (closed = true), data: { url: '/session/abc' } },
    });
    expect(closed).toBe(true);
    expect(worker.opened).toEqual(['/session/abc']);
  });

  it('brings an open window to the session instead of opening another', async () => {
    worker.windows.push({
      navigate: async (u) => {
        worker.navigated.push(u);
      },
      focus: async () => {
        worker.focused.push(1);
      },
    });
    await worker.waitUntilOf('notificationclick', {
      notification: { close: () => undefined, data: { url: '/session/abc' } },
    });
    expect(worker.navigated).toEqual(['/session/abc']);
    expect(worker.focused).toHaveLength(1);
    expect(worker.opened).toHaveLength(0);
  });
});
