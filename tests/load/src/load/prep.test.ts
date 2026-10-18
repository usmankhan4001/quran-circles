import { describe, expect, it } from 'vitest';
import {
  REMOTE_STATEMENTS,
  afterSeedWait,
  formatAnalyze,
  formatStatements,
  parseWaitSeconds,
  remoteAnalyze,
} from './prep';

/** The remote runner's side of the database steps: it reaches the API only. */

describe('remote report blocks', () => {
  it('says ANALYZE was not run and how to get it, without a wait', () => {
    const a = remoteAnalyze(0);
    expect(a).toMatchObject({ ran: false, tables: [], ms: null });
    expect(a.note).toMatch(/API only/);
    expect(a.note).toMatch(/--after-seed-wait/);
    expect(a.note).toMatch(/2026-10-18-load-runner-analyze/);
    expect(formatAnalyze(a)).toBe(`analyze: ${a.note}`);
  });

  it('records the wait when there was one', () => {
    expect(remoteAnalyze(150).note).toMatch(/waited 150 s after seeding/);
  });

  it('says pg_stat_statements was not read and where to read it', () => {
    expect(REMOTE_STATEMENTS.available).toBe(false);
    expect(REMOTE_STATEMENTS.note).toMatch(/Query statistics/);
    expect(formatStatements(REMOTE_STATEMENTS)).toEqual([
      `db statements: ${REMOTE_STATEMENTS.note}`,
    ]);
  });
});

describe('--after-seed-wait', () => {
  it('parses whole seconds, 0 when absent', () => {
    expect(parseWaitSeconds(undefined)).toBe(0);
    expect(parseWaitSeconds('')).toBe(0);
    expect(parseWaitSeconds('0')).toBe(0);
    expect(parseWaitSeconds('150')).toBe(150);
    expect(parseWaitSeconds('900')).toBe(900);
  });

  it.each(['-1', '1.5', 'two', '901'])('refuses %s', (v) => {
    expect(() => parseWaitSeconds(v)).toThrow(/whole seconds from 0 to 900/);
  });

  it('sleeps the given seconds and logs it, or does nothing for 0', async () => {
    const slept: number[] = [];
    const lines: string[] = [];
    const sleep = (ms: number): Promise<void> => {
      slept.push(ms);
      return Promise.resolve();
    };
    await afterSeedWait(0, (l) => lines.push(l), sleep);
    expect(slept).toEqual([]);
    expect(lines).toEqual([]);
    await afterSeedWait(120, (l) => lines.push(l), sleep);
    expect(slept).toEqual([120_000]);
    expect(lines[0]).toMatch(/^seeded; waiting 120 s before the first step/);
  });
});
