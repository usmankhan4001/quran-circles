import { ApiClientError, ERROR_CODES, type ErrorCode } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';

/**
 * Turns anything thrown by the API client into a message key. Every API error code has an
 * `errors.<code>` message in English and Urdu; network and decoding problems use the generic
 * `ui.*` messages. The UI never shows server text or request details.
 */
export type ErrorKind = ErrorCode | 'network_error' | 'invalid_response' | 'unknown';

export function errorKind(error: unknown): ErrorKind {
  if (error instanceof ApiClientError) return error.code;
  return 'unknown';
}

/** One literal key per code, so the compiler checks that each exists in the translation files. */
export const ERROR_MESSAGE_KEYS = {
  validation_failed: 'errors.validation_failed',
  unauthenticated: 'errors.unauthenticated',
  token_expired: 'errors.token_expired',
  refresh_token_invalid: 'errors.refresh_token_invalid',
  forbidden: 'errors.forbidden',
  account_suspended: 'errors.account_suspended',
  not_found: 'errors.not_found',
  conflict: 'errors.conflict',
  rate_limited: 'errors.rate_limited',
  internal_error: 'errors.internal_error',
  service_unavailable: 'errors.service_unavailable',
  otp_invalid: 'errors.otp_invalid',
  otp_expired: 'errors.otp_expired',
  otp_too_many_attempts: 'errors.otp_too_many_attempts',
  already_registered: 'errors.already_registered',
  registration_closed: 'errors.registration_closed',
  session_full: 'errors.session_full',
  session_cancelled: 'errors.session_cancelled',
  occurrence_in_past: 'errors.occurrence_in_past',
  circle_not_pending: 'errors.circle_not_pending',
  circle_request_exists: 'errors.circle_request_exists',
  role_already_assigned: 'errors.role_already_assigned',
  last_national_admin: 'errors.last_national_admin',
  invite_expired: 'errors.invite_expired',
} as const satisfies Record<ErrorCode, MessageKey>;

export function errorMessageKeyOf(error: unknown): MessageKey {
  const kind = errorKind(error);
  if (kind === 'network_error') return 'ui.offlineBody';
  if (kind === 'invalid_response' || kind === 'unknown') return 'ui.errorBody';
  return ERROR_MESSAGE_KEYS[kind];
}

export function isErrorCode(value: string): value is ErrorCode {
  return value in ERROR_CODES;
}

/** Seconds to wait before retrying, when the server said so. */
export function retryAfterOf(error: unknown): number | null {
  return error instanceof ApiClientError ? (error.retryAfterSeconds ?? null) : null;
}

/** Errors that mean the sign-in is no longer valid. */
export function isAuthLost(error: unknown): boolean {
  const kind = errorKind(error);
  return kind === 'unauthenticated' || kind === 'token_expired' || kind === 'refresh_token_invalid';
}
