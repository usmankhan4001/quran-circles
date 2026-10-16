/**
 * A local API for developing the app without a backend: the contract's mock handler behind a
 * small Node server. It adds the CORS headers a browser needs, since the app and the mock run
 * on different ports. Start it with `pnpm --filter @qc/user-app mock`, then run the app with
 * EXPO_PUBLIC_API_URL=http://localhost:4010.
 */
import { createServer } from 'node:http';
import { createMockHandler } from '@qc/contracts/mock';

const port = Number(process.env.PORT ?? 4010);
const handler = createMockHandler();

const cors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);
  const hasBody = body.length > 0 && req.method !== 'GET' && req.method !== 'HEAD';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  const request = new Request(`http://localhost:${port}${req.url ?? '/'}`, {
    method: req.method ?? 'GET',
    headers,
    ...(hasBody ? { body } : {}),
  });
  const response = await handler(request);
  const out: Record<string, string> = { ...cors };
  response.headers.forEach((value, key) => {
    out[key] = value;
  });
  res.writeHead(response.status, out).end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  console.log(`Mock API on http://localhost:${port}`);
});
