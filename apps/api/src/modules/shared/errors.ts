import type { ApiError, ErrorCode } from '@qc/contracts';

type Extra = Partial<Pick<ApiError['error'], 'issues' | 'retryAfterSeconds'>>;

/**
 * The only way a handler reports a failure: a code from the contract, never free text.
 * The error handler turns it into the contract's error body with the request id.
 */
export class ApiException extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly extra: Extra = {},
  ) {
    super(code);
    this.name = 'ApiException';
  }
}

export function fail(code: ErrorCode, extra: Extra = {}): never {
  throw new ApiException(code, extra);
}

/** validation_failed for a problem found after parsing (for example an id that points nowhere). */
export function invalid(path: string, code = 'invalid_reference'): never {
  throw new ApiException('validation_failed', { issues: [{ path, code }] });
}

/** Finds a Postgres SQLSTATE inside whatever the driver or Drizzle wrapped it in. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const isUniqueViolation = (error: unknown): boolean => pgErrorCode(error) === '23505';
