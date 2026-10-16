import { describe, expect, it } from 'vitest';
import { MigrationToolError, describeFailure } from './errors';

describe('describeFailure', () => {
  it("shows the message of the tool's own errors", () => {
    expect(describeFailure(new MigrationToolError('no_database', 'DATABASE_URL is not set'))).toBe(
      'no_database: DATABASE_URL is not set',
    );
  });

  it('reduces a database error to its code, table and constraint, never its detail', () => {
    const error = Object.assign(
      new Error('new row for relation "legacy_registrations" violates check constraint'),
      {
        code: '23514',
        table: 'legacy_registrations',
        constraint: 'legacy_registrations_party_size_chk',
        detail: 'Failing row contains (Test Person 1, +923000000101, Sample Masjid Al-Noor)',
      },
    );
    const text = describeFailure(error);
    expect(text).toBe(
      'database error 23514, table legacy_registrations, constraint legacy_registrations_party_size_chk',
    );
    expect(text).not.toContain('Test Person');
    expect(text).not.toContain('+92');
  });

  it('finds a database error inside a wrapper', () => {
    const inner = Object.assign(new Error('Key (phone)=(+923000000101) already exists'), {
      code: '23505',
    });
    expect(describeFailure(new Error('wrapped', { cause: inner }))).toBe('database error 23505');
  });

  it('withholds the message of anything it does not recognise', () => {
    const text = describeFailure(new TypeError('cannot read name of Test Person 1 +923000000101'));
    expect(text).toContain('TypeError');
    expect(text).not.toContain('Test Person');
    expect(text).not.toContain('923000000101');
  });

  it('copes with values that are not errors', () => {
    expect(describeFailure('Test Person 1')).not.toContain('Test Person');
    expect(describeFailure(null)).toContain('unexpected');
    expect(
      describeFailure({ code: 'ECONNREFUSED', message: 'host db.example.test' }),
    ).not.toContain('example');
  });

  it('reports Node system error codes without the host', () => {
    const text = describeFailure(
      Object.assign(new Error('connect ECONNREFUSED db.example.test:5432'), {
        code: 'ECONNREFUSED',
      }),
    );
    expect(text).toBe('connection error ECONNREFUSED');
    expect(describeFailure({ cause: { code: 'ENOTFOUND' } })).toBe('connection error ENOTFOUND');
  });
});
