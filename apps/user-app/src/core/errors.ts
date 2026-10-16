import { ApiClientError, ERROR_CODE_LIST, type ErrorCode } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';

/** What the screens know about a failed call. It never carries names, numbers or bodies. */
export type AppErrorCode = ErrorCode | 'network_error' | 'invalid_response' | 'unknown';

export interface AppError {
  code: AppErrorCode;
  status: number;
  /** For support. Carries no personal data. */
  requestId: string | null;
  retryAfterSeconds?: number;
}

export function toAppError(error: unknown): AppError {
  if (error instanceof ApiClientError) {
    return {
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      ...(error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    };
  }
  return { code: 'unknown', status: 0, requestId: null };
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === 'network_error';
}

const apiCodes: ReadonlySet<string> = new Set(ERROR_CODE_LIST);

/** The i18n key that says what went wrong, in plain words, for any failed call. */
export function errorMessageKey(code: AppErrorCode): MessageKey {
  if (apiCodes.has(code)) return `errors.${code as ErrorCode}`;
  if (code === 'network_error') return 'ui.offlineBody';
  return 'ui.errorBody';
}

/** Sign-in problems send the person to sign in again instead of showing an error. */
export function needsSignIn(code: AppErrorCode): boolean {
  return code === 'unauthenticated' || code === 'token_expired' || code === 'refresh_token_invalid';
}
