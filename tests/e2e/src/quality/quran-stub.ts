import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { CACHE_DIR } from '../stack/paths';
import { QURAN_SOURCE_HOST, quranStubPort } from '../support/network';

/** Ayahs per surah (public metadata, 6236 in all). */
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112,
  78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37,
  35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8,
  8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
const FIRST_NUMBER = AYAH_COUNTS.reduce<number[]>(
  (acc, _n, i) => [...acc, (acc[i] ?? 1) + (AYAH_COUNTS[i] ?? 0)],
  [1],
);

/**
 * Placeholder text of a realistic length. It is not Quran text and not a translation: the tests
 * stay on this machine, and the content lane owns anything that stores the real text. The
 * Arabic-script filler means "sample text" so the right-to-left layout and the Arabic and Urdu
 * fonts are exercised as with the real source.
 */
function filler(edition: string, surah: number, ayah: number): string {
  const words = 18 + ((surah * 7 + ayah * 13) % 40);
  if (edition.startsWith('en.')) {
    return `Sample translation placeholder ${surah}:${ayah}. ${'Lorem ipsum dolor sit amet. '.repeat(Math.ceil(words / 5))}`.trim();
  }
  const word = edition.startsWith('ur.') ? 'نمونہ متن' : 'نص تجريبي';
  return Array.from({ length: words }, () => word).join(' ');
}

function edition(id: string, ayahs: { surah: number; ayah: number }[]): unknown {
  return {
    identifier: id,
    ayahs: ayahs.map(({ surah, ayah }) => ({
      number: (FIRST_NUMBER[surah - 1] ?? 1) + ayah - 1,
      numberInSurah: ayah,
      text: filler(id, surah, ayah),
      surah: { number: surah },
    })),
  };
}

/** The JSON the service answers for one path, or null for a path it does not know. */
function answer(pathname: string): unknown {
  const parts = pathname.split('/').filter(Boolean);
  // v1/surah/{n}/editions/{a,b,c} | v1/ayah/{s}:{a}/editions/{a,b,c} | v1/juz/{n}/{edition}
  if (parts[1] === 'surah' && parts[3] === 'editions') {
    const surah = Number(parts[2]);
    const count = AYAH_COUNTS[surah - 1] ?? 0;
    const ayahs = Array.from({ length: count }, (_x, i) => ({ surah, ayah: i + 1 }));
    return (parts[4] ?? '').split(',').map((id) => edition(id, ayahs));
  }
  if (parts[1] === 'ayah' && parts[3] === 'editions') {
    const [s, a] = (parts[2] ?? '').split(':').map(Number);
    return (parts[4] ?? '').split(',').map((id) => edition(id, [{ surah: s ?? 1, ayah: a ?? 1 }]));
  }
  if (parts[1] === 'juz') return edition(parts[3] ?? 'quran-uthmani', [{ surah: 2, ayah: 1 }]);
  return null;
}

/**
 * A throwaway self-signed certificate for the service's name, made once with openssl and kept
 * under node_modules/.cache (never committed). The browser contexts that use the stub accept it
 * with `ignoreHTTPSErrors`; every other outside host is unresolvable, so nothing else can use it.
 */
function certificate(): { key: Buffer; cert: Buffer } {
  const dir = join(CACHE_DIR, 'quran-stub');
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  if (!existsSync(key) || !existsSync(cert)) {
    mkdirSync(dir, { recursive: true });
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '3650',
        '-subj',
        `/CN=${QURAN_SOURCE_HOST}`,
        '-addext',
        `subjectAltName=DNS:${QURAN_SOURCE_HOST}`,
      ],
      { stdio: 'ignore' },
    );
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

let running: Promise<Server> | null = null;

function start(port: number): Promise<Server> {
  const bodies = new Map<string, { status: number; gzipped: Buffer }>();
  const server = createServer(certificate(), (request, response) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET',
      'access-control-allow-headers': '*',
    };
    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers).end();
      return;
    }
    const pathname = new URL(request.url ?? '/', `https://${QURAN_SOURCE_HOST}`).pathname;
    let body = bodies.get(pathname);
    if (!body) {
      const data = answer(pathname);
      const json =
        data === null
          ? { code: 404, status: 'NOT FOUND', data: null }
          : { code: 200, status: 'OK', data };
      // Gzipped like the real service, so a throttled browser spends the time it would there.
      body = { status: data === null ? 404 : 200, gzipped: gzipSync(JSON.stringify(json)) };
      bodies.set(pathname, body);
    }
    response
      .writeHead(body.status, {
        ...headers,
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': body.gzipped.length,
      })
      .end(body.gzipped);
  });
  return new Promise((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'EADDRINUSE'
          ? new Error(
              `Port ${port} for the Quran stub is taken; set QC_QURAN_STUB_PORT to a free port.`,
            )
          : error,
      );
    });
    server.listen(port, '127.0.0.1', () => {
      server.unref(); // never keeps a worker alive
      resolve(server);
    });
  });
}

/**
 * Answers the Quran text service (api.alquran.cloud) from this machine with placeholder text, so
 * the reader opens without the internet and its timing reflects only our app. The quality
 * project's browser resolves the service's name to this server (playwright.config.ts), so its
 * requests take Chromium's ordinary path, throttling included; nothing is intercepted. The
 * context must be created with `ignoreHTTPSErrors: true` (the certificate is self-signed).
 * Starts the server once per worker; later calls return at once.
 */
export async function stubQuranSource(): Promise<void> {
  running ??= start(quranStubPort()).catch((error: unknown) => {
    running = null;
    throw error;
  });
  await running;
}
