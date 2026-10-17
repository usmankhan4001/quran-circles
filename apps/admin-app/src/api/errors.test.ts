import { ApiClientError, ERROR_CODE_LIST } from '@qc/contracts';
import { messages } from '@qc/i18n';
import { describe, expect, it } from 'vitest';
import {
  errorCodeOf,
  errorMessageKey,
  isErrorCode,
  isNotAvailable,
  isOffline,
  rejectedFields,
  retryAfterOf,
  serverFieldErrors,
} from './errors';

const en = messages.en as Record<string, string>;
const ur = messages.ur as Record<string, string>;

describe('errorMessageKey', () => {
  it.each(ERROR_CODE_LIST)('maps the code %s to a message in English and Urdu', (code) => {
    const key = errorMessageKey(new ApiClientError(400, code, null));
    expect(key).toBe(`errors.${code}`);
    expect(en[key], key).toBeTruthy();
    expect(ur[key], key).toBeTruthy();
  });

  it('maps a network failure to the offline message', () => {
    const key = errorMessageKey(new ApiClientError(0, 'network_error', null));
    expect(key).toBe('ui.offlineBody');
    expect(en[key]).toBeTruthy();
    expect(ur[key]).toBeTruthy();
  });

  it('maps an unreadable response and any other failure to the server error message', () => {
    expect(errorMessageKey(new ApiClientError(200, 'invalid_response', null))).toBe(
      'errors.internal_error',
    );
    expect(errorMessageKey(new Error('boom'))).toBe('errors.internal_error');
    expect(errorMessageKey('text')).toBe('errors.internal_error');
    expect(errorMessageKey(null)).toBe('errors.internal_error');
  });
});

describe('error helpers', () => {
  it('reads the code only from API errors', () => {
    expect(errorCodeOf(new ApiClientError(403, 'forbidden', 'req-1'))).toBe('forbidden');
    expect(errorCodeOf(new Error('x'))).toBeNull();
  });

  it('checks for one code', () => {
    const error = new ApiClientError(404, 'not_found', null);
    expect(isErrorCode(error, 'not_found')).toBe(true);
    expect(isErrorCode(error, 'forbidden')).toBe(false);
    expect(isErrorCode(new Error('x'), 'not_found')).toBe(false);
  });

  it('tells offline from other failures', () => {
    expect(isOffline(new ApiClientError(0, 'network_error', null))).toBe(true);
    expect(isOffline(new ApiClientError(500, 'internal_error', null))).toBe(false);
    expect(isOffline(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('reads how long to wait', () => {
    expect(retryAfterOf(new ApiClientError(429, 'rate_limited', null, 30))).toBe(30);
    expect(retryAfterOf(new ApiClientError(429, 'rate_limited', null))).toBeUndefined();
    expect(retryAfterOf(new Error('x'))).toBeUndefined();
  });
});

describe('fields the server rejected', () => {
  const fields = { name: 'name', teacherName: 'teacher', 'portion.para': 'para' } as const;
  const rejected = (issues: { path: string; code: string }[]) =>
    new ApiClientError(400, 'validation_failed', 'req-1', undefined, issues);

  it('matches the full path first, then its first part', () => {
    const error = rejected([
      { path: 'name.en', code: 'too_small' },
      { path: 'portion.para', code: 'too_big' },
      { path: 'teacherName', code: 'too_small' },
    ]);
    expect(rejectedFields(error, fields)).toEqual(['name', 'para', 'teacher']);
  });

  it('ignores paths that are not on the form and answers that are not validation failures', () => {
    expect(rejectedFields(rejected([{ path: 'kind', code: 'invalid_value' }]), fields)).toEqual([]);
    expect(rejectedFields(new ApiClientError(403, 'forbidden', null), fields)).toEqual([]);
    expect(rejectedFields(new ApiClientError(400, 'validation_failed', null), fields)).toEqual([]);
    expect(rejectedFields(new Error('x'), fields)).toEqual([]);
  });

  it('gives each rejected field the not-accepted message, in both languages', () => {
    const out = serverFieldErrors(rejected([{ path: 'name.ur', code: 'too_big' }]), fields);
    expect(out).toEqual({ name: 'admin.common.notAccepted' });
    expect(en['admin.common.notAccepted']).toBeTruthy();
    expect(ur['admin.common.notAccepted']).toBeTruthy();
  });

  it('reads not_found as not available', () => {
    expect(isNotAvailable(new ApiClientError(404, 'not_found', null))).toBe(true);
    expect(isNotAvailable(new ApiClientError(403, 'forbidden', null))).toBe(false);
  });
});
