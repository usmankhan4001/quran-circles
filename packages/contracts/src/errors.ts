import { z } from 'zod';

/**
 * Stable error codes. Handlers return a code, never free text. The client shows the message for
 * `errors.<code>` from @qc/i18n (English and Urdu). Names and statuses are frozen at Gate 1.
 */
export const ERROR_CODES = {
  // Generic
  validation_failed: 400,
  unauthenticated: 401,
  token_expired: 401,
  refresh_token_invalid: 401,
  forbidden: 403,
  account_suspended: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
  // Sign-in
  otp_invalid: 400,
  otp_expired: 410,
  otp_too_many_attempts: 429,
  // Registration and sessions
  already_registered: 409,
  registration_closed: 409,
  session_full: 409,
  session_cancelled: 409,
  occurrence_in_past: 409,
  // Circles and requests
  circle_not_pending: 409,
  circle_request_exists: 409,
  // Roles and invites
  role_already_assigned: 409,
  last_national_admin: 409,
  invite_expired: 410,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
export const ERROR_CODE_LIST = Object.keys(ERROR_CODES) as ErrorCode[];
export const ErrorCodeSchema = z.enum(ERROR_CODE_LIST as [ErrorCode, ...ErrorCode[]]);

export const errorStatus = (code: ErrorCode): number => ERROR_CODES[code];

/** The i18n key for an error code's user-facing message. */
export const errorMessageKey = (code: ErrorCode): `errors.${ErrorCode}` => `errors.${code}`;

/** One thing wrong with input: where, and a short machine code. Never the input itself. */
export const ValidationIssue = z.object({ path: z.string(), code: z.string() });
export type ValidationIssue = z.infer<typeof ValidationIssue>;

/** Every error response has this shape. `requestId` is for support; it carries no personal data. */
export const ApiError = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    messageKey: z.string(),
    requestId: z.string(),
    /** Present for validation_failed: where the input was wrong, never the input itself. */
    issues: z.array(ValidationIssue).optional(),
    /** Present for rate_limited and otp_too_many_attempts. */
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const makeApiError = (
  code: ErrorCode,
  requestId: string,
  extra: Partial<Pick<ApiError['error'], 'issues' | 'retryAfterSeconds'>> = {},
): ApiError => ({
  error: { code, messageKey: errorMessageKey(code), requestId, ...extra },
});

/**
 * The code a Zod issue is reported with: Zod's own code, except a custom refinement that names its
 * own code in `params.code` (for example `phone_not_pakistan_mobile`).
 */
export const issueCodeOf = (issue: z.core.$ZodIssue): string => {
  if (issue.code === 'custom') {
    const own: unknown = issue.params?.['code'];
    if (typeof own === 'string' && own.length > 0) return own;
  }
  return issue.code;
};

/** Turns a Zod error into issues, at most 20, for `validation_failed` and per-row import results. */
export const issuesFromZod = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((i) => ({ path: i.path.join('.'), code: issueCodeOf(i) })).slice(0, 20);

/** Errors every endpoint can return, so endpoints list only their own domain errors. */
export const COMMON_ERRORS = [
  'rate_limited',
  'internal_error',
  'service_unavailable',
] as const satisfies readonly ErrorCode[];
