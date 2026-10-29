/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EFilingGrid, type EFilingColumn } from './EFilingGrid';
import { resetVisitCache, visitKey } from '@/lib/ui/table-prefs';

type Row = { id: string; name: string; changed?: string };
const rows: Row[] = [
  { id: 'a', name: 'GSTR-3B · Acme', changed: '2026-10-29T10:00:00Z' },
  { id: 'b', name: 'ADT-1 · Beta', changed: '2026-10-01T10:00:00Z' },
];
const columns: EFilingColumn<Row>[] = [{ key: 'name', header: 'Filing', render: (r) => r.name }];

beforeEach(() => {
  window.localStorage.clear();
  resetVisitCache();
});

describe('EFilingGrid', () => {
  it('keeps the plain grid when no opt-in prop is given', () => {
    render(<EFilingGrid columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const row = screen.getByText('GSTR-3B · Acme').closest('tr')!;
    expect(row).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('makes rows with onRowClick focusable and opens them with Enter', () => {
    const open = vi.fn();
    render(<EFilingGrid columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={open} />);
    const row = screen.getByText('ADT-1 · Beta').closest('tr')!;
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(open).toHaveBeenCalledWith(rows[1]);
  });

  it('runs a row shortcut on a focused row', () => {
    const remind = vi.fn();
    render(<EFilingGrid columns={columns} rows={rows} rowKey={(r) => r.id} rowShortcuts={[{ key: 'r', run: remind }]} />);
    fireEvent.keyDown(screen.getByText('GSTR-3B · Acme').closest('tr')!, { key: 'R' });
    expect(remind).toHaveBeenCalledWith(rows[0]);
  });

  it('shows the bulk bar when rows are picked and clears after an action', () => {
    const done = vi.fn();
    render(
      <EFilingGrid
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        selectable
        bulkActions={(picked) => [{ key: 'done', label: 'Mark done', onClick: () => done(picked.map((r) => r.id)) }]}
        bulkNoun={['filing', 'filings']}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick row 1' }));
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole('button', { name: 'Mark done 1 filing' }));
    expect(done).toHaveBeenCalledWith(['a']);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('picks every row on the page from the head box', () => {
    render(<EFilingGrid columns={columns} rows={rows} rowKey={(r) => r.id} selectable bulkActions={() => []} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick every row on this page' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('draws the dashed empty state with Clear filters', () => {
    const clear = vi.fn();
    render(<EFilingGrid columns={columns} rows={[]} rowKey={(r: Row) => r.id} empty="No filings match" onClearFilters={clear} />);
    expect(screen.getByText('No filings match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(clear).toHaveBeenCalledOnce();
  });

  it('marks rows changed since the last visit', () => {
    window.localStorage.setItem(visitKey('t:filings'), String(new Date('2026-10-15T00:00:00Z').getTime()));
    render(<EFilingGrid columns={columns} rows={rows} rowKey={(r) => r.id} changedAt={(r) => r.changed} visitKey="t:filings" />);
    expect(screen.getAllByText('Changed since your last visit')).toHaveLength(1);
    expect(screen.getByText('GSTR-3B · Acme').closest('td')).toContainElement(screen.getByText('Changed since your last visit'));
  });

  it('draws grey row shapes while loading', () => {
    render(<EFilingGrid columns={columns} rows={rows} rowKey={(r) => r.id} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('GSTR-3B · Acme')).toBeNull();
  });
});
