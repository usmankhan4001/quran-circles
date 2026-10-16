import { cors } from 'hono/cors';

/** CORS for the web apps and the console. The allowed origins come from configuration. */
export const corsMiddleware = (allowedOrigins: readonly string[]) =>
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['authorization', 'content-type', 'x-request-id', 'accept-language'],
    exposeHeaders: ['x-request-id', 'retry-after', 'content-disposition'],
    maxAge: 600,
  });
