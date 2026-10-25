import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@qc/contracts';
import type { Locale } from '../i18n';
import { renderConsole, screen, text } from '../test/harness';

const row = (n: number, actorName: string | null): AuditEntry => ({
  id: `audit-${n}`,
  actorName,
  action: 'venue.update',
  entityType: 'venue',
  entityId: null,
  scopeType: 'national',
  cityId: null,
  venueId: null,
  createdAt: '2027-02-10T05:00:00Z',
});

describe.each<Locale>(['en', 'ur'])('who did it, in the audit log (%s)', (locale) => {
  it('names the person, and never calls a person without a name "System"', async () => {
    renderConsole({
      role: 'national',
      locale,
      path: '/audit',
      handlers: {
        'adminAudit.list': () => ({
          items: [row(1, 'Test Coordinator'), row(2, null)],
          nextCursor: null,
        }),
      },
    });
    const table = await screen.findByRole('table', { name: text('console.audit.title', locale) });
    const who = Array.from(table.querySelectorAll('.audit-who')).map((n) => n.textContent);
    expect(who).toEqual(['Test Coordinator', text('console.invites.unnamed', locale)]);
    expect(within(table).queryByText(text('console.audit.system', locale))).toBeNull();
  });
});
