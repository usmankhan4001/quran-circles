import { SignJWT, errors, jwtVerify } from 'jose';
import type { AuthConfig } from './config';
import { isUuid, type AuthKeys } from './crypto';

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

/**
 * Access tokens carry the user id and session id and nothing else: no phone number, name or role.
 * Roles are read from the database on every request so that revoking one takes effect at once.
 */
export async function signAccessToken(
  keys: AuthKeys,
  config: AuthConfig,
  claims: AccessTokenClaims,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAtSeconds = issuedAt + config.accessTokenTtlSeconds;
  const token = await new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAtSeconds)
    .sign(keys.token);
  return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
}

export type AccessTokenResult =
  ({ ok: true } & AccessTokenClaims) | { ok: false; reason: 'expired' | 'invalid' };

export async function verifyAccessToken(
  keys: AuthKeys,
  config: AuthConfig,
  token: string,
  now: Date,
): Promise<AccessTokenResult> {
  try {
    const { payload } = await jwtVerify(token, keys.token, {
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience,
      currentDate: now,
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    const sessionId = payload.sid;
    if (!isUuid(payload.sub) || !isUuid(sessionId)) return { ok: false, reason: 'invalid' };
    return { ok: true, userId: payload.sub, sessionId };
  } catch (error) {
    return { ok: false, reason: error instanceof errors.JWTExpired ? 'expired' : 'invalid' };
  }
}
