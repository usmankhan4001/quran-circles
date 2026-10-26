import { E164_PATTERN, EMAIL_PATTERN } from '@qc/contracts';

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
    /**
     * WhatsApp sign-in (a code to a Pakistani mobile number, by WhatsApp with an SMS fallback).
     * Off since 2026-10-25: sign-in codes go to an email address. The code path is kept; set
     * `AUTH_PHONE_SIGN_IN=true` to bring it back next to email.
     */
    phoneSignIn: boolean;
  };
  rateLimits: {
    requestPerPhone: RateRule;
    requestPerIp: RateRule;
    verifyPerPhone: RateRule;
    verifyPerIp: RateRule;
    /** Refresh calls per address (SEC-07). Generous: many people can share one carrier address. */
    refreshPerIp: RateRule;
  };
  /**
   * Ceilings on codes sent, counted from `otp_challenges` in the database, so they survive restarts
   * and hold across processes (SEC-04, SEC-07). The global ones are a cost backstop against SMS
   * pumping; reaching one logs `auth.code_global_cap_reached` (no personal data) for alerting.
   */
  codeCaps: {
    /** Codes per number in any 24 hours. */
    perPhonePerDay: number;
    /** Codes for all numbers together in any hour, and in any 24 hours. */
    globalPerHour: number;
    globalPerDay: number;
  };
  /** Trust the last `X-Forwarded-For` entry (set by our reverse proxy) as the caller's address. */
  trustProxy: boolean;
  /**
   * The first national admin, from the environment (owner decision 2026-10-26): a fixed sign-in
   * identity whose invite the API creates at start-up when no admin exists, and whose sign-in
   * codes may be delivered to another mailbox (`codeTo`). Null when not configured. Nothing else
   * about that identity is special: the same rate limits and the same code rules apply.
   */
  firstAdmin: FirstAdmin | null;
}

export interface FirstAdmin {
  /** The address the admin signs in with. */
  email: string;
  /** The WhatsApp number on the invite and, at the first sign-in, on the account. */
  phone: string;
  /** Where that identity's sign-in codes are emailed instead. Null: to `email` itself. */
  codeTo: string | null;
}

export type AuthConfigInput = Partial<
  Omit<AuthConfig, 'otp' | 'rateLimits' | 'codeCaps' | 'secret'>
> & {
  secret: string;
  otp?: Partial<AuthConfig['otp']>;
  rateLimits?: Partial<AuthConfig['rateLimits']>;
  codeCaps?: Partial<AuthConfig['codeCaps']>;
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
      phoneSignIn: false,
      ...input.otp,
    },
    rateLimits: {
      requestPerPhone: { limit: 5, windowSeconds: 60 * 60 },
      requestPerIp: { limit: 30, windowSeconds: 60 * 60 },
      verifyPerPhone: { limit: 10, windowSeconds: 15 * 60 },
      verifyPerIp: { limit: 40, windowSeconds: 15 * 60 },
      refreshPerIp: { limit: 600, windowSeconds: 10 * 60 },
      ...input.rateLimits,
    },
    codeCaps: {
      perPhonePerDay: 10,
      globalPerHour: 1_000,
      globalPerDay: 10_000,
      ...input.codeCaps,
    },
    trustProxy: input.trustProxy ?? false,
    firstAdmin: input.firstAdmin ?? null,
  };

  if (!APP_ENVS.includes(config.appEnv)) throw new AuthConfigError('Unknown appEnv');
  if (config.firstAdmin) {
    const { email, phone, codeTo } = config.firstAdmin;
    if (!EMAIL_PATTERN.test(email)) throw new AuthConfigError('firstAdmin.email is not valid');
    if (!E164_PATTERN.test(phone)) throw new AuthConfigError('firstAdmin.phone is not E.164');
    if (codeTo !== null && !EMAIL_PATTERN.test(codeTo)) {
      throw new AuthConfigError('firstAdmin.codeTo is not valid');
    }
  }
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
  positive('codeCaps.perPhonePerDay', config.codeCaps.perPhonePerDay);
  positive('codeCaps.globalPerHour', config.codeCaps.globalPerHour);
  positive('codeCaps.globalPerDay', config.codeCaps.globalPerDay);
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
 * unset), `AUTH_FIXED_CODE` (test mode, refused in production), `AUTH_TRUST_PROXY` (`true`),
 * `AUTH_PHONE_SIGN_IN` (`true` brings back WhatsApp sign-in next to email; off by default),
 * `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PHONE` (together: the first national admin the API
 * invites at start-up when none exists) with `BOOTSTRAP_ADMIN_CODE_TO` (optional: the mailbox that
 * identity's sign-in codes go to instead).
 */
export function loadAuthConfigFromEnv(env: Env = process.env): AuthConfig {
  const appEnv = (env.APP_ENV ?? 'production') as AppEnv;
  const secret = env.AUTH_SECRET;
  if (!secret) throw new AuthConfigError('AUTH_SECRET is not set');
  return createAuthConfig({
    appEnv,
    secret,
    trustProxy: env.AUTH_TRUST_PROXY === 'true',
    otp: {
      ...(env.AUTH_FIXED_CODE ? { fixedCode: env.AUTH_FIXED_CODE } : {}),
      phoneSignIn: env.AUTH_PHONE_SIGN_IN === 'true',
    },
    firstAdmin: firstAdminFromEnv(env),
  });
}

const cleanAddress = (value: string | undefined): string | null => {
  const v = value?.trim().toLowerCase();
  return v ? v : null;
};

/** Both the email and the phone, or neither; a code redirect only with them. */
export function firstAdminFromEnv(env: Env): FirstAdmin | null {
  const email = cleanAddress(env.BOOTSTRAP_ADMIN_EMAIL);
  const phone = env.BOOTSTRAP_ADMIN_PHONE?.trim() || null;
  const codeTo = cleanAddress(env.BOOTSTRAP_ADMIN_CODE_TO);
  if (!email && !phone) {
    if (codeTo) throw new AuthConfigError('BOOTSTRAP_ADMIN_CODE_TO needs BOOTSTRAP_ADMIN_EMAIL');
    return null;
  }
  if (!email || !phone) {
    throw new AuthConfigError('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PHONE go together');
  }
  return { email, phone, codeTo };
}
