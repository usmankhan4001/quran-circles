import { describe, expect, it } from 'vitest';
import type { AdminSession } from '@qc/contracts';
import { sessions } from '@qc/contracts/fixtures';
import type { Locale } from '../i18n';
import { renderConsole, screen, text } from '../test/harness';

/**
 * The console home (the first page, Sessions) draws number cards, but only counts the loaded rows
 * back (never check-ins or seats), and says so while more pages exist.
 */

const listed = sessions.map((s) => ({ ...s, circleStatus: null })) as AdminSession[];
const fill = (message: string, params: Record<string, string>) =>
  message.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');

describe.each<Locale>(['en', 'ur'])('the console home (%s)', (locale) => {
  it('draws number cards, but no check-in or seats-reserved figure', async () => {
    renderConsole({
      role: 'national',
      locale,
      path: '/',
      handlers: { 'adminSessions.list': () => ({ items: listed, nextCursor: null }) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title', locale) });
    expect(screen.getByRole('region', { name: text('console.kpi.label', locale) })).toBeTruthy();
    expect(screen.queryByText(text('console.sessions.kpi.reliability', locale))).toBeNull();
    expect(screen.queryByText(text('console.sessions.kpi.demand', locale))).toBeNull();
  });
});

describe('counts on the console home', () => {
  it('shows loaded counts as "at least" when the list has more pages', async () => {
    renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => ({ items: listed, nextCursor: 'next-page' }) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    const count = `${listed.length}+`;
    expect(screen.getByText(fill(text('console.sessions.tab.sessions'), { count }))).toBeTruthy();
    expect(screen.getByText(fill(text('console.sessions.awaiting'), { count: '0+' }))).toBeTruthy();
  });

  it('shows plain counts once every row is loaded', async () => {
    renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => ({ items: listed, nextCursor: null }) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    expect(
      screen.getByText(
        fill(text('console.sessions.tab.sessions'), { count: String(listed.length) }),
      ),
    ).toBeTruthy();
  });
});
