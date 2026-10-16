import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { defaultClientIp } from './context';

const appWith = (trustProxy: boolean) => {
  const app = new Hono();
  const ip = defaultClientIp(trustProxy);
  app.get('/ip', (c) => c.json({ ip: ip(c) }));
  return app;
};

const ipFor = async (trustProxy: boolean, headers: Record<string, string>) =>
  ((await (await appWith(trustProxy).request('/ip', { headers })).json()) as { ip: string | null })
    .ip;

describe('client address', () => {
  it('uses the entry our own proxy appended when proxy headers are trusted', async () => {
    expect(await ipFor(true, { 'x-forwarded-for': '198.51.100.9' })).toBe('198.51.100.9');
    // Anything the caller put in front of it is ignored.
    expect(await ipFor(true, { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 198.51.100.9' })).toBe(
      '198.51.100.9',
    );
    expect(await ipFor(true, { 'x-forwarded-for': ' , ' })).toBeNull();
  });

  it('ignores proxy headers when they are not trusted', async () => {
    expect(await ipFor(false, { 'x-forwarded-for': '198.51.100.9' })).toBeNull();
  });

  it('is null, not an error, when there is no socket information', async () => {
    expect(await ipFor(true, {})).toBeNull();
  });
});
