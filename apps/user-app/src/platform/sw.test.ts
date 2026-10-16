import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

type Listener = (event: Record<string, unknown>) => void;

/** Runs `public/sw.js` against small fakes of the worker scope, and records what it does. */
function loadWorker(options: { cached?: Set<string>; networkFails?: boolean } = {}) {
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
    keys: async () => ['qc-shell-v0', 'qc-shell-v1'],
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
    ok = true;
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
    return new FakeResponse();
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
      expect.arrayContaining(['/', '/manifest.webmanifest', '/icons/icon-192.png']),
    );
    await worker.waitUntilOf('activate');
    expect(worker.deleted).toEqual(['qc-shell-v0']);
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

  it('opens the saved shell for a page load when there is no connection', async () => {
    const offline = loadWorker({ cached: new Set(['/']), networkFails: true });
    const { response } = offline.fetchEvent('https://app.test/home', { mode: 'navigate' });
    await expect(response).resolves.toBe('cached:/');
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
