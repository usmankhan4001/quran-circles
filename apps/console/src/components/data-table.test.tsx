import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type Column } from './ui';

interface Row {
  id: string;
  name: string;
  city: string;
}

const columns: Column<Row>[] = [
  { id: 'name', header: 'Masjid', rowHeader: true, cell: (r) => r.name },
  { id: 'city', header: 'City', cell: (r) => r.city },
  { id: 'actions', header: '', cell: () => <button type="button">Open</button> },
];

const rows: Row[] = [
  { id: 'a', name: 'Masjid Noor', city: 'Karachi' },
  { id: 'b', name: 'Masjid Taqwa', city: 'Lahore' },
];

describe('DataTable on a phone (stacked cards)', () => {
  it('labels every body cell with its column header, for the card view', () => {
    render(<DataTable caption="Venues" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const table = screen.getByRole('table', { name: 'Venues' });
    expect([...table.classList]).toEqual(['table', 'table-stack']);
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(2);
    for (const row of bodyRows) {
      const header = within(row).getByRole('rowheader');
      expect(header.getAttribute('data-label')).toBe('Masjid');
      const cells = within(row).getAllByRole('cell');
      expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['City', '']);
    }
  });

  it('keeps the column headers for screen readers and its own class next to the stack class', () => {
    render(
      <DataTable
        caption="Audit log"
        className="audit-table"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    const table = screen.getByRole('table', { name: 'Audit log' });
    expect([...table.classList]).toEqual(['table', 'table-stack', 'audit-table']);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Masjid', 'City', '']);
  });

  it('draws no body rows and no labels when there is nothing to show', () => {
    render(<DataTable caption="Empty" columns={columns} rows={[]} rowKey={(r) => r.id} />);
    const table = screen.getByRole('table', { name: 'Empty' });
    expect(within(table).getAllByRole('row')).toHaveLength(1);
    expect(table.querySelectorAll('[data-label]')).toHaveLength(0);
  });
});

describe('the phone breakpoint in the stylesheet', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
  const start = css.indexOf('@media (max-width: 40rem)');
  const block = start >= 0 ? css.slice(start) : '';

  it('has one shared rule set for every DataTable, not per page', () => {
    expect(start).toBeGreaterThan(-1);
    expect(css.match(/@media \(max-width: 40rem\)/g)).toHaveLength(1);
  });

  it('drops the fixed table width and the sideways scroller', () => {
    expect(block).toMatch(/\.table\.table-stack\s*\{\s*min-inline-size:\s*0;/);
    expect(block).toMatch(/\.table-wrap:has\(> \.table-stack\)\s*\{\s*overflow-x:\s*visible;/);
  });

  it('turns rows into blocks, hides the header row visually and shows each label', () => {
    expect(block).toMatch(/\.table-stack thead\s*\{[^}]*clip-path:\s*inset\(50%\)/);
    expect(block).toMatch(/\.table-stack tbody tr\s*\{\s*display:\s*block/);
    expect(block).toMatch(/content:\s*attr\(data-label\)/);
    expect(block).toMatch(/\[data-label=''\]::before\s*\{\s*content:\s*none;/);
  });

  it('uses only logical properties there, so the cards mirror in Urdu', () => {
    expect(block).not.toMatch(/\b(margin|padding|border)-(left|right)\b/);
    expect(block).not.toMatch(/text-align\s*:\s*(left|right)/);
  });
});
