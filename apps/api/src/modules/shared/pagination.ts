import { fail } from './errors';

/**
 * Cursors are opaque to clients. Most lists use a position cursor; the Updates feed and the audit
 * log use keyset cursors so new rows never shift a page.
 */
const encode = (text: string): string => Buffer.from(text, 'utf8').toString('base64url');
const decode = (cursor: string): string => Buffer.from(cursor, 'base64url').toString('utf8');

export function encodeOffsetCursor(offset: number): string {
  return encode(`o:${offset}`);
}

export function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const m = /^o:(\d{1,9})$/.exec(decode(cursor));
  if (!m) return fail('validation_failed', { issues: [{ path: 'cursor', code: 'invalid_cursor' }] });
  return Number(m[1]);
}

export function encodeKeyCursor(...parts: string[]): string {
  return encode(`k:${parts.join('|')}`);
}

export function decodeKeyCursor(cursor: string | undefined, parts: number): string[] | null {
  if (!cursor) return null;
  const text = decode(cursor);
  if (!text.startsWith('k:')) {
    return fail('validation_failed', { issues: [{ path: 'cursor', code: 'invalid_cursor' }] });
  }
  const out = text.slice(2).split('|');
  if (out.length !== parts) {
    return fail('validation_failed', { issues: [{ path: 'cursor', code: 'invalid_cursor' }] });
  }
  return out;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Fetch `limit + 1` rows from `offset`, then pass them here. */
export function offsetPage<T>(rows: T[], limit: number, offset: number): Page<T> {
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : null,
  };
}
