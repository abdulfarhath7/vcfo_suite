import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { InternWorkItem } from '@/lib/intern/intern-work';

/** The Work board (M6 G1): which cards drag, where task statuses land, and the done card (G3). */

vi.mock('@/context/AppContext', () => ({ useApp: () => ({ updateTask: vi.fn() }) }));
vi.mock('@/components/intern/InternWorkCtaButton', () => ({ InternWorkCtaButton: () => null }));

const { WorkBoard } = await import('@/components/work/WorkBoard');

function item(patch: Partial<InternWorkItem> & { id: string }): InternWorkItem {
  return {
    source: 'task',
    engagementId: 'e1',
    companyName: 'Acme Pvt Ltd',
    title: patch.id,
    kind: 'task',
    href: '/x',
    why: '',
    isOverdue: false,
    isCritical: false,
    ...patch,
  };
}

const items = [
  item({ id: 'task:a', title: 'Call bank', taskId: 'a', taskStatus: 'not-started' }),
  item({ id: 'task:b', title: 'Draft MoA', taskId: 'b', taskStatus: 'in-progress' }),
  item({ id: 'task:c', title: 'Send invoice', taskId: 'c', taskStatus: 'completed', kind: 'done', completedAt: '2026-10-30T00:00:00Z' }),
  item({ id: 'step:s', title: 'Name approval', source: 'step', kind: 'in-progress', catalogId: 's1' }),
];

describe('WorkBoard', () => {
  it('puts each task in the column of its status', () => {
    render(<WorkBoard items={items} now={new Date('2026-10-30T06:00:00Z')} onOpen={vi.fn()} />);
    expect(within(screen.getByRole('region', { name: 'Needs action' })).getByText('Call bank')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'In progress' })).getByText('Draft MoA')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Done' })).getByText('Send invoice')).toBeInTheDocument();
  });

  it('lets task cards move by pointer or keyboard and keeps step cards still', () => {
    render(<WorkBoard items={items} now={new Date('2026-10-30T06:00:00Z')} onOpen={vi.fn()} />);
    const move = screen.getByRole('button', { name: 'Move Call bank' });
    expect(move).toHaveAttribute('aria-roledescription', 'sortable');
    expect(move).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('button', { name: 'Move Name approval' })).toBeNull();
  });

  it('shows a done card with a green tick and the Done chip, never a strikethrough', () => {
    render(<WorkBoard items={items} now={new Date('2026-10-30T06:00:00Z')} onOpen={vi.fn()} />);
    const done = screen.getByRole('region', { name: 'Done' });
    expect(within(done).getByLabelText('Done')).toBeInTheDocument();
    expect(within(done).getByText('Send invoice').className).not.toContain('line-through');
    expect(within(done).getAllByText('Done').length).toBeGreaterThan(0);
  });
});
