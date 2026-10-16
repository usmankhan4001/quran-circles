import { ApiClientError, ERROR_CODE_LIST, type ErrorCode } from '@qc/contracts';
import type { MessageKey } from '../i18n/translate';

/** The error code of a failed call, or null when the failure was not an API error. */
export function errorCodeOf(error: unknown): ErrorCode | 'network_error' | 'invalid_response' | null {
  return error instanceof ApiClientError ? error.code : null;
}

export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiClientError && error.code === code;
}

/** True when nothing reached the server. The screen offers the calmer "you are offline" wording. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === 'network_error';
}

/**
 * Maps any failure to the message the person sees. API codes use `errors.<code>`, which the
 * contracts lane keeps in step with the code list. Anything unexpected reads as a server error.
 */
export function errorMessageKey(error: unknown): MessageKey {
  if (error instanceof ApiClientError) {
    if (error.code === 'network_error') return 'ui.offlineBody';
    if (error.code === 'invalid_response') return 'errors.internal_error';
    if ((ERROR_CODE_LIST as string[]).includes(error.code)) {
      return `errors.${error.code}` as MessageKey;
    }
  }
  return 'errors.internal_error';
}

/** Seconds to wait before trying again, when the server said so. */
export function retryAfterOf(error: unknown): number | undefined {
  return error instanceof ApiClientError ? error.retryAfterSeconds : undefined;
}
