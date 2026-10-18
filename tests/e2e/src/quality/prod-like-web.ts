import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { REPO_DIR } from '../stack/paths';
import { freePort, run } from '../stack/processes';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.txt',
  '.ttf',
  '.otf',
]);

export interface ProdLikeWeb {
  /** The app's origin. Its API is at `${url}/api`, as in production. */
  url: string;
  root: string;
  stop(): Promise<void>;
}

/**
 * Builds an Expo app's web export and serves it the way production does
 * (infra/caddy/Caddyfile): the API on the same origin under /api with the prefix removed, gzip
 * for text, a year-long immutable cache for hashed build files, `no-cache` for the pages, and
 * index.html for client-side routes. The stack's own static server is plain (no compression and
 * a separate API origin), which would make a load-time budget measure something no user gets.
 * The API, database and worker are still the stack's.
 */
export async function startProdLikeWeb(
  app: 'user-app' | 'admin-app',
  outDir: string,
  apiUrl: string,
): Promise<ProdLikeWeb> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  rmSync(outDir, { recursive: true, force: true });
  const appDir = join(REPO_DIR, 'apps', app);
  await run({
    name: `${app}-quality-export`,
    command: join(appDir, 'node_modules', '.bin', 'expo'),
    args: ['export', '--platform', 'web', '--output-dir', outDir],
    cwd: appDir,
    env: { EXPO_PUBLIC_API_URL: `${url}/api`, CI: '1' },
    timeoutMs: 600_000,
  });
  const api = new URL(apiUrl);
  // One synthetic forwarded address for this server, as the production proxy would pass on.
  const forwardedFor = `10.250.${port % 250}.${(port >> 8) % 250}`;
  const gzipped = new Map<string, Buffer>();

  const server: Server = createServer((req, res) => {
    const rawPath = req.url ?? '/';
    if (rawPath === '/api' || rawPath.startsWith('/api/')) {
      const forward = request(
        {
          host: api.hostname,
          port: api.port,
          path: rawPath.slice(4) || '/',
          method: req.method,
          headers: { ...req.headers, host: api.host, 'x-forwarded-for': forwardedFor },
        },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      forward.on('error', () => res.writeHead(502).end());
      req.pipe(forward);
      return;
    }
    const pathname = decodeURIComponent(new URL(rawPath, 'http://x').pathname);
    let file = normalize(join(outDir, pathname));
    if (!file.startsWith(outDir + sep) && file !== outDir) {
      res.writeHead(400).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(outDir, 'index.html');
    const ext = extname(file);
    const headers: Record<string, string> = {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control':
        pathname.startsWith('/_expo/static/') || pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
    };
    if (file.endsWith('sw.js')) headers['service-worker-allowed'] = '/';
    const body = readFileSync(file);
    const acceptsGzip = String(req.headers['accept-encoding'] ?? '').includes('gzip');
    if (COMPRESSIBLE.has(ext) && acceptsGzip && body.length > 512) {
      let gz = gzipped.get(file);
      if (!gz) {
        gz = gzipSync(body, { level: 6 });
        gzipped.set(file, gz);
      }
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
      res.writeHead(200, headers).end(gz);
      return;
    }
    res.writeHead(200, headers).end(body);
  });
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => done());
  });
  return {
    url,
    root: outDir,
    stop: async () => {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
      rmSync(outDir, { recursive: true, force: true });
    },
  };
}
