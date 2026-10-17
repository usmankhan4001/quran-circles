import { ApiClientError, ERROR_CODES, type ErrorCode } from '@qc/contracts';
import { messages } from '@qc/i18n';
import { describe, expect, it } from 'vitest';
import {
  ERROR_MESSAGE_KEYS,
  errorKind,
  errorMessageKeyOf,
  fieldIssues,
  isAuthLost,
  issuesOf,
  isErrorCode,
  retryAfterOf,
} from './errors';

const codes = Object.keys(ERROR_CODES) as ErrorCode[];

describe('error code mapping', () => {
  it('maps every contract error code to an errors.* key', () => {
    expect(Object.keys(ERROR_MESSAGE_KEYS).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      expect(errorMessageKeyOf(new ApiClientError(ERROR_CODES[code], code, 'r1'))).toBe(
        `errors.${code}`,
      );
    }
  });

  it('has an English and an Urdu message for every code', () => {
    for (const code of codes) {
      expect(messages.en[`errors.${code}`], `en ${code}`).toBeTruthy();
      expect(messages.ur[`errors.${code}`], `ur ${code}`).toBeTruthy();
    }
  });

  it('uses the generic messages for network and unknown failures', () => {
    expect(errorMessageKeyOf(new ApiClientError(0, 'network_error', null))).toBe('ui.offlineBody');
    expect(errorMessageKeyOf(new ApiClientError(200, 'invalid_response', 'r'))).toBe(
      'ui.errorBody',
    );
    expect(errorMessageKeyOf(new Error('boom'))).toBe('ui.errorBody');
    expect(errorMessageKeyOf('nope')).toBe('ui.errorBody');
    expect(errorKind(new TypeError('x'))).toBe('unknown');
  });

  it('knows which errors end a sign-in and when to retry', () => {
    expect(isAuthLost(new ApiClientError(401, 'token_expired', 'r'))).toBe(true);
    expect(isAuthLost(new ApiClientError(401, 'refresh_token_invalid', 'r'))).toBe(true);
    expect(isAuthLost(new ApiClientError(403, 'forbidden', 'r'))).toBe(false);
    expect(retryAfterOf(new ApiClientError(429, 'rate_limited', 'r', 30))).toBe(30);
    expect(retryAfterOf(new ApiClientError(403, 'forbidden', 'r'))).toBeNull();
    expect(isErrorCode('forbidden')).toBe(true);
    expect(isErrorCode('toString')).toBe(false);
  });
});

describe('validation issues from the server', () => {
  const rejected = new ApiClientError(400, 'validation_failed', 'r1', undefined, [
    { path: 'phone', code: 'invalid_format' },
    { path: 'name.en', code: 'too_small' },
    { path: 'replacesAssignmentId', code: 'invalid_reference' },
  ]);

  it('reads the issues of a validation_failed answer only', () => {
    expect(issuesOf(rejected)).toHaveLength(3);
    expect(issuesOf(new ApiClientError(403, 'forbidden', 'r1'))).toEqual([]);
    expect(issuesOf(new Error('x'))).toEqual([]);
  });

  it('points each issue at the form field it belongs to, by path prefix', () => {
    expect(fieldIssues(rejected, { phone: 'phone', name: 'name' })).toEqual({
      phone: { path: 'phone', code: 'invalid_format' },
      name: { path: 'name.en', code: 'too_small' },
    });
  });
});
