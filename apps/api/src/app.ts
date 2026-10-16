import { Hono } from 'hono';
import type { HealthResponse } from '@qc/contracts';

export const app = new Hono();

app.get('/health', (c) => {
  const body: HealthResponse = { ok: true, service: 'api' };
  return c.json(body);
});
