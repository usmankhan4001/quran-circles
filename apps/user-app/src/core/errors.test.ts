import { describe, expect, it } from 'vitest';
import { ApiClientError, ERROR_CODE_LIST } from '@qc/contracts';
import { messages } from '@qc/i18n';
import { errorMessageKey, isNetworkError, needsSignIn, toAppError } from './errors';

const REGISTRATION_ERRORS = [
  'already_registered',
  'session_full',
  'registration_closed',
  'session_cancelled',
  'occurrence_in_past',
] as const;

describe('errorMessageKey', () => {
  it('maps every API error code to a message that exists in both languages', () => {
    for (const code of ERROR_CODE_LIST) {
      const key = errorMessageKey(code);
      expect(key, code).toBe(`errors.${code}`);
      expect(messages.en[key]?.trim(), `${key} in English`).toBeTruthy();
      expect(messages.ur[key]?.trim(), `${key} in Urdu`).toBeTruthy();
    }
  });

  it('maps the registration errors to their own sentences', () => {
    const seen = new Set<string>();
    for (const code of REGISTRATION_ERRORS) {
      const key = errorMessageKey(code);
      expect(key).toBe(`errors.${code}`);
      seen.add(messages.en[key]);
    }
    expect(seen.size).toBe(REGISTRATION_ERRORS.length);
    expect(messages.en[errorMessageKey('already_registered')]).toMatch(/already registered/i);
    expect(messages.en[errorMessageKey('session_full')]).toMatch(/full/i);
    expect(messages.en[errorMessageKey('registration_closed')]).toMatch(/closed/i);
  });

  it('maps connection and unknown failures to plain messages', () => {
    expect(errorMessageKey('network_error')).toBe('ui.offlineBody');
    expect(errorMessageKey('invalid_response')).toBe('ui.errorBody');
    expect(errorMessageKey('unknown')).toBe('ui.errorBody');
  });
});

describe('toAppError', () => {
  it('keeps the code, status and request id, and nothing else', () => {
    const error = new ApiClientError(429, 'rate_limited', 'req-1', 30);
    expect(toAppError(error)).toEqual({
      code: 'rate_limited',
      status: 429,
      requestId: 'req-1',
      retryAfterSeconds: 30,
    });
  });

  it('turns anything that is not an API error into unknown', () => {
    expect(toAppError(new Error('boom'))).toEqual({ code: 'unknown', status: 0, requestId: null });
  });

  it('recognises a dropped connection', () => {
    expect(isNetworkError(new ApiClientError(0, 'network_error', null))).toBe(true);
    expect(isNetworkError(new ApiClientError(500, 'internal_error', null))).toBe(false);
  });
});

describe('needsSignIn', () => {
  it('is true only for sign-in problems', () => {
    expect(needsSignIn('unauthenticated')).toBe(true);
    expect(needsSignIn('token_expired')).toBe(true);
    expect(needsSignIn('refresh_token_invalid')).toBe(true);
    expect(needsSignIn('session_full')).toBe(false);
    expect(needsSignIn('network_error')).toBe(false);
  });
});
