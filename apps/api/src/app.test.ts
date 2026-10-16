import { describe, expect, it } from 'vitest';
import { HealthResponse } from '@qc/contracts';
import { app } from './app';

describe('GET /health', () => {
  it('returns a body that matches the contract', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(HealthResponse.safeParse(await res.json()).success).toBe(true);
  });
});
