/* global self, caches, URL, fetch, Response */
/* Quran Circles service worker: the offline shell and web push.
 *
 * It caches the app's own files so the page opens without a connection. It never caches
 * anything from another origin, which includes the API, and never caches a non-GET request.
 * The shell is replaced only by a successful same-origin HTML page (SEC-23), so a link to an
 * error page or to JSON cannot become the offline page.
 * What the person did last (public sessions and venues they viewed) is kept by the app itself
 * on the device; personal data is not stored here.
 */
// v2 drops any shell that v1 may have saved from a non-page response (SEC-23).
const VERSION = 'qc-shell-v2';
const SHELL = [
  '/',
  '/boot.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
// The start-up script the page loads before the app (public/boot.js). Its name has no content
// hash, so it is read from the network first and the saved copy is only for offline starts.
const BOOT_SCRIPT = '/boot.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  );
}

// Paths served by the server, never by the app: a page load there is left to the network.
const SERVER_PREFIXES = ['/api/', '/webhooks/'];

function isServerPath(url) {
  return SERVER_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

/**
 * Whether a page load's response may replace the saved shell: status 200 (not a redirect or an
 * error page), same-origin (`basic`, from this origin) and HTML.
 */
function isShellResponse(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  if (response.url) {
    let origin;
    try {
      origin = new URL(response.url).origin;
    } catch {
      return false;
    }
    if (origin !== self.location.origin) return false;
  }
  const type = (response.headers && response.headers.get('content-type')) || '';
  return type.toLowerCase().split(';')[0].trim() === 'text/html';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A page load: the network first so a new version shows up, the saved shell when offline.
  if (request.mode === 'navigate') {
    if (isServerPath(url)) return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isShellResponse(response)) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error())),
    );
    return;
  }

  if (url.pathname === BOOT_SCRIPT) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(BOOT_SCRIPT, copy));
          }
          return response;
        })
        .catch(() => caches.match(BOOT_SCRIPT).then((cached) => cached || Response.error())),
    );
    return;
  }

  // Built files have the content in their name, so a saved copy is never out of date.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

function readPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event);
  const title =
    typeof payload.title === 'string' && payload.title ? payload.title : 'Quran Circles';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: '/icons/icon-192.png',
    data: {
      url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/home',
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/home';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
