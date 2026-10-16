export const APP_ENVS = ['production', 'staging', 'development', 'test'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface RateRule {
  limit: number;
  windowSeconds: number;
}

export interface AuthConfig {
  appEnv: AppEnv;
  /** Server secret, at least 32 characters. Access-token and code-hash keys are derived from it. */
  secret: string;
  issuer: string;
  audience: string;
  accessTokenTtlSeconds: number;
  /** Sliding: every refresh extends the session by this much, up to `sessionMaxAgeSeconds`. */
  refreshTokenTtlSeconds: number;
  /** Absolute limit from the first sign-in. */
  sessionMaxAgeSeconds: number;
  otp: {
    ttlSeconds: number;
    maxAttempts: number;
    /** Wait after the first code. It doubles with each further code in the last hour. */
    cooldownBaseSeconds: number;
    cooldownMaxSeconds: number;
    /** Test mode: every code is this value. Never allowed in production. */
    fixedCode: string | null;
  };
  rateLimits: {
    requestPerPhone: RateRule;
    requestPerIp: RateRule;
    verifyPerPhone: RateRule;
    verifyPerIp: RateRule;
  };
  /** Trust the last `X-Forwarded-For` entry (set by our reverse proxy) as the caller's address. */
  trustProxy: boolean;
}

export type AuthConfigInput = Partial<Omit<AuthConfig, 'otp' | 'rateLimits' | 'secret'>> & {
  secret: string;
  otp?: Partial<AuthConfig['otp']>;
  rateLimits?: Partial<AuthConfig['rateLimits']>;
};

export class AuthConfigError extends Error {
  override name = 'AuthConfigError';
}

const DAY = 24 * 60 * 60;

export const MIN_SECRET_LENGTH = 32;

/** Fills in defaults and refuses unsafe settings. Error messages never repeat the secret. */
export function createAuthConfig(input: AuthConfigInput): AuthConfig {
  const config: AuthConfig = {
    appEnv: input.appEnv ?? 'production',
    secret: input.secret,
    issuer: input.issuer ?? 'qc-api',
    audience: input.audience ?? 'qc-app',
    accessTokenTtlSeconds: input.accessTokenTtlSeconds ?? 15 * 60,
    refreshTokenTtlSeconds: input.refreshTokenTtlSeconds ?? 30 * DAY,
    sessionMaxAgeSeconds: input.sessionMaxAgeSeconds ?? 180 * DAY,
    otp: {
      ttlSeconds: 5 * 60,
      maxAttempts: 5,
      cooldownBaseSeconds: 60,
      cooldownMaxSeconds: 15 * 60,
      fixedCode: null,
      ...input.otp,
    },
    rateLimits: {
      requestPerPhone: { limit: 5, windowSeconds: 60 * 60 },
      requestPerIp: { limit: 30, windowSeconds: 60 * 60 },
      verifyPerPhone: { limit: 10, windowSeconds: 15 * 60 },
      verifyPerIp: { limit: 40, windowSeconds: 15 * 60 },
      ...input.rateLimits,
    },
    trustProxy: input.trustProxy ?? false,
  };

  if (!APP_ENVS.includes(config.appEnv)) throw new AuthConfigError('Unknown appEnv');
  if (typeof config.secret !== 'string' || config.secret.length < MIN_SECRET_LENGTH) {
    throw new AuthConfigError(`The auth secret must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  const positive = (name: string, value: number) => {
    if (!Number.isInteger(value) || value < 1) {
      throw new AuthConfigError(`${name} must be a whole number of at least 1`);
    }
  };
  positive('accessTokenTtlSeconds', config.accessTokenTtlSeconds);
  positive('refreshTokenTtlSeconds', config.refreshTokenTtlSeconds);
  positive('sessionMaxAgeSeconds', config.sessionMaxAgeSeconds);
  positive('otp.ttlSeconds', config.otp.ttlSeconds);
  positive('otp.maxAttempts', config.otp.maxAttempts);
  positive('otp.cooldownBaseSeconds', config.otp.cooldownBaseSeconds);
  positive('otp.cooldownMaxSeconds', config.otp.cooldownMaxSeconds);
  for (const [name, rule] of Object.entries(config.rateLimits)) {
    positive(`rateLimits.${name}.limit`, rule.limit);
    positive(`rateLimits.${name}.windowSeconds`, rule.windowSeconds);
  }
  if (config.otp.fixedCode !== null) {
    if (config.appEnv === 'production') {
      throw new AuthConfigError('A fixed sign-in code is not allowed when appEnv is production');
    }
    if (!/^[0-9]{6}$/.test(config.otp.fixedCode)) {
      throw new AuthConfigError('The fixed sign-in code must be six digits');
    }
  }
  return config;
}

type Env = Record<string, string | undefined>;

/**
 * Reads the configuration from environment variables.
 * `AUTH_SECRET` (required), `APP_ENV` (production | staging | development | test; production when
 * unset), `AUTH_FIXED_CODE` (test mode, refused in production), `AUTH_TRUST_PROXY` (`true`).
 */
export function loadAuthConfigFromEnv(env: Env = process.env): AuthConfig {
  const appEnv = (env.APP_ENV ?? 'production') as AppEnv;
  const secret = env.AUTH_SECRET;
  if (!secret) throw new AuthConfigError('AUTH_SECRET is not set');
  return createAuthConfig({
    appEnv,
    secret,
    trustProxy: env.AUTH_TRUST_PROXY === 'true',
    ...(env.AUTH_FIXED_CODE ? { otp: { fixedCode: env.AUTH_FIXED_CODE } } : {}),
  });
}
