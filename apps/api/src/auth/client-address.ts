import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * The one rule for the caller's network address, used by every rate limiter in the API (SEC-20):
 * the auth lane's sign-in limits and the endpoint buckets in `modules/shared/route.ts`.
 *
 * Behind our reverse proxy (`trustProxy`), the address is the rightmost `X-Forwarded-For` entry:
 * the one hop the trusted proxy (Caddy) appended. Every entry to its left came from the client and
 * can be forged, so it is never used. Without a trusted proxy the header is ignored and the socket
 * address is used. If a CDN or a second proxy is ever put in front of Caddy, this rule must be
 * revisited together with Caddy's `trusted_proxies`, in this one place.
 */
export function rightmostForwarded(header: string | undefined | null): string | null {
  if (!header) return null;
  const last = header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return last ?? null;
}

/** The socket's remote address, or null when there is none (for example in `app.request` tests). */
function socketAddress(c: Context): string | null {
  try {
    return getConnInfo(c).remote.address ?? null;
  } catch {
    return null;
  }
}

/** The caller's address by the rule above, or null when nothing is known. */
export function clientAddress(c: Context, trustProxy: boolean): string | null {
  if (trustProxy) {
    const forwarded = rightmostForwarded(c.req.header('x-forwarded-for'));
    if (forwarded) return forwarded;
  }
  return socketAddress(c);
}
