import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminSession } from '@qc/contracts';
import { sessions } from '@qc/contracts/fixtures';
import type { Locale } from '../i18n';
import { renderConsole, screen, text } from '../test/harness';

/**
 * The console home (the first page, Sessions) shows only figures the API backs. A figure with no
 * data (check-ins, registrations this month, the share who turned up) is not drawn, and a count of
 * loaded rows is never shown as a total while more pages exist.
 */

const listed = sessions.map((s) => ({ ...s, circleStatus: null })) as AdminSession[];
const fill = (message: string, params: Record<string, string>) =>
  message.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');

const terms = () =>
  within(screen.getByRole('region', { name: text('console.kpi.label') }))
    .getAllByRole('term')
    .map((t) => t.textContent);

describe.each<Locale>(['en', 'ur'])('figures on the console home (%s)', (locale) => {
  it('never draws the check-in card, which has no data behind it', async () => {
    renderConsole({
      role: 'national',
      locale,
      path: '/',
      handlers: { 'adminSessions.list': () => ({ items: listed, nextCursor: null }) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title', locale) });
    const region = screen.getByRole('region', { name: text('console.kpi.label', locale) });
    expect(within(region).queryByText(text('console.sessions.kpi.reliability', locale))).toBeNull();
    expect(screen.queryByText(text('console.sessions.kpi.reliabilityValue', locale))).toBeNull();
    expect(screen.queryByText(text('console.sessions.kpi.reliabilitySub', locale))).toBeNull();
  });
});

describe('figures on the console home when the list has more pages', () => {
  it('leaves out the circles total and shows loaded counts as "at least"', async () => {
    renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => ({ items: listed, nextCursor: 'next-page' }) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    expect(terms()).not.toContain(text('console.sessions.kpi.total'));
    expect(terms()).toContain(text('console.sessions.kpi.masjids'));
    expect(screen.getByText(text('console.kpi.partial'))).toBeTruthy();
    const count = `${listed.length}+`;
    expect(screen.getByText(fill(text('console.sessions.tab.sessions'), { count }))).toBeTruthy();
    expect(screen.getByText(fill(text('console.sessions.awaiting'), { count: '0+' }))).toBeTruthy();
  });

  it('shows the circles total and plain counts once every row is loaded', async () => {
    renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => ({ items: listed, nextCursor: null }) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    expect(terms()).toContain(text('console.sessions.kpi.total'));
    expect(screen.queryByText(text('console.kpi.partial'))).toBeNull();
    expect(
      screen.getByText(
        fill(text('console.sessions.tab.sessions'), { count: String(listed.length) }),
      ),
    ).toBeTruthy();
  });
});
