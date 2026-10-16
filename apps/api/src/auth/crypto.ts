import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/** Keys derived from the one server secret, one per purpose, so none can stand in for another. */
export interface AuthKeys {
  /** Signs access tokens. */
  token: Uint8Array;
  /** Hashes sign-in codes. */
  otp: Buffer;
  /** Hashes network addresses and phone numbers used as rate-limit keys. */
  id: Buffer;
}

const derive = (secret: string, purpose: string): Buffer =>
  Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), `qc-auth/${purpose}`, 32),
  );

export function deriveKeys(secret: string): AuthKeys {
  return {
    token: new Uint8Array(derive(secret, 'access-token')),
    otp: derive(secret, 'otp'),
    id: derive(secret, 'identifier'),
  };
}

/** Six random digits, uniformly. */
export const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** The stored form of a code. Bound to its challenge, so a hash cannot be moved to another row. */
export const hashCode = (keys: AuthKeys, challengeId: string, code: string): string =>
  createHmac('sha256', keys.otp).update(`${challengeId}:${code}`).digest('hex');

/** A stable, non-reversible stand-in for a phone number or address (rate-limit keys, `ip_hash`). */
export const hashIdentifier = (keys: AuthKeys, kind: 'phone' | 'ip', value: string): string =>
  createHmac('sha256', keys.id).update(`${kind}:${value}`).digest('hex');

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

const SECRET_PART = /^[A-Za-z0-9_-]{43}$/;

/** `<sessionId>.<32 random bytes>`. The session id is public; the second part is the secret. */
export const newRefreshToken = (sessionId: string): string =>
  `${sessionId}.${randomBytes(32).toString('base64url')}`;

export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const dot = token.indexOf('.');
  if (dot !== 36) return null;
  const sessionId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  // Tokens are issued in lower case; any other spelling is not one of ours.
  if (!isUuid(sessionId) || sessionId !== sessionId.toLowerCase() || !SECRET_PART.test(secret)) {
    return null;
  }
  return { sessionId, secret };
}

/** Only this hash is stored in `auth_sessions.refresh_token_hash`. */
export const hashRefreshToken = (token: string): string => sha256Hex(token);
