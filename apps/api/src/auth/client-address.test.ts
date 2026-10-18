import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { clientAddress, rightmostForwarded } from './client-address';
import { defaultClientIp } from './context';

/** SEC-20: one rule for the caller's address, used by sign-in and by the endpoint buckets. */
describe('the client address rule', () => {
  it('takes the rightmost entry, the one our proxy appended, and ignores forged ones', () => {
    expect(rightmostForwarded('198.51.100.9')).toBe('198.51.100.9');
    expect(rightmostForwarded('6.6.6.6, 198.51.100.9')).toBe('198.51.100.9');
    expect(rightmostForwarded('6.6.6.6,7.7.7.7 ,  198.51.100.9 ')).toBe('198.51.100.9');
    expect(rightmostForwarded('2001:db8::1, 2001:db8::2')).toBe('2001:db8::2');
    expect(rightmostForwarded(' , ')).toBeNull();
    expect(rightmostForwarded('')).toBeNull();
    expect(rightmostForwarded(undefined)).toBeNull();
  });

  const forged = [
    { 'x-forwarded-for': '198.51.100.9' },
    { 'x-forwarded-for': '10.0.0.1, 198.51.100.9' },
    { 'x-forwarded-for': '127.0.0.1, 1.1.1.1, 198.51.100.9' },
  ];

  it('gives the sign-in limiter and the shared helper the same answer for forged headers', async () => {
    for (const trustProxy of [true, false]) {
      const app = new Hono();
      const auth = defaultClientIp(trustProxy);
      app.get('/ip', (c) => c.json({ auth: auth(c), shared: clientAddress(c, trustProxy) }));
      for (const headers of forged) {
        const body = (await (await app.request('/ip', { headers })).json()) as {
          auth: string | null;
          shared: string | null;
        };
        expect(body.auth).toBe(body.shared);
        expect(body.shared).toBe(trustProxy ? '198.51.100.9' : null);
      }
    }
  });
});
