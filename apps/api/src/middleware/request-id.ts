import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../modules/shared/context';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Every response carries `x-request-id`. A safe id sent by the caller is kept, so a trace survives. */
export const requestId = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
};
