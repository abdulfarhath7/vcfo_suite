/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProgressList } from './progress-list';
import { AssistSteps } from './assist-steps';
import { StageTrack } from './stage-track';
import { Thread, threadDate } from './thread';
import { WeekStrip } from './week-strip';
import { PhaseRows } from './phase-rows';
import { EditableFacts, factChangeNote } from './editable-facts';
import { cascadeEdit, type EditPhase } from './timeline-editor';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));

describe('shared cards', () => {
  it('ProgressList shows the value text, the sub line and an empty state', () => {
    const { rerender } = render(<ProgressList items={[{ id: 'a', name: 'Asha', sub: '2 clients', pct: 50, value: '12 h' }]} />);
    expect(screen.getByText('12 h')).toBeTruthy();
    expect(screen.getByText('2 clients')).toBeTruthy();
    rerender(<ProgressList items={[]} empty="No leads" />);
    expect(screen.getByText('No leads')).toBeTruthy();
  });

  it('AssistSteps draws the screenshot tag and an empty state', () => {
    const { rerender } = render(<AssistSteps steps={[{ title: 'Open GSTR-3B', state: 'done', note: 'Done · 10:02 AM', shot: 'GST · p1' }]} />);
    expect(screen.getByText('GST · p1')).toBeTruthy();
    rerender(<AssistSteps steps={[]} />);
    expect(screen.getByText('VCFO Assist has not worked on this filing yet')).toBeTruthy();
  });

  it('StageTrack shows the kicker on the current stage', () => {
    render(
      <StageTrack
        stages={[{ label: 'Started', state: 'done' }, { label: 'Submitted', state: 'now' }, { label: 'Completed', state: 'todo' }]}
        now={{ kicker: 'Step 2 of 3', title: 'Submitted' }}
      />,
    );
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });

  it('Thread shows dates on done steps and none on upcoming ones', () => {
    render(
      <Thread
        steps={[
          { id: '1', title: 'Name approval', state: 'done', date: '2026-10-14' },
          { id: '2', title: 'Filing', state: 'upcoming', date: '2026-11-01' },
        ]}
      />,
    );
    expect(screen.getByText('14 Oct 2026')).toBeTruthy();
    expect(screen.queryByText('1 Nov 2026')).toBeNull();
    expect(threadDate('2026-10-29T20:00:00Z')).toBe('30 Oct 2026');
  });

  it('WeekStrip picks and clears a day', () => {
    const onChange = vi.fn();
    const days = [{ key: 'm', dow: 'Mon', day: '5', items: [{ id: 'x', text: 'GSTR-1', tone: 'warn' as const }] }];
    const { rerender } = render(<WeekStrip days={days} value={-1} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mon 5 · 1 item' }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    rerender(<WeekStrip days={days} value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mon 5 · 1 item' }));
    expect(onChange).toHaveBeenLastCalledWith(-1);
  });

  it('PhaseRows opens the step table with the typical time', () => {
    render(
      <PhaseRows
        phases={[
          { id: 'p1', name: 'Phase 1', done: 1, total: 2, status: 'In progress', steps: [{ n: 1, title: 'DSC', owner: 'sbc', status: 'Done', time: '2–3 days' }] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Typical time')).toBeTruthy();
    expect(screen.getByText('2–3 days')).toBeTruthy();
  });

  it('EditableFacts edits, sends only the changed rows, and writes a change note', async () => {
    const onSave = vi.fn();
    render(<EditableFacts title="GST" editable rows={[{ k: 'GSTIN', v: '29AAA', mono: true }, { k: 'State', v: 'KA' }]} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(screen.getByDisplayValue('KA'), { target: { value: 'TN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await Promise.resolve();
    expect(onSave.mock.calls[0]?.[0]).toEqual([{ k: 'State', before: 'KA', after: 'TN' }]);
    expect(factChangeNote('GST', [{ k: 'State', before: 'KA', after: 'TN' }])).toBe('Please update GST:\nState: KA → TN');
  });

  it('cascadeEdit pushes later parts on and keeps their length; done parts stay', () => {
    const parts: EditPhase[] = [
      { id: 'p1', name: 'P1', from: '2026-11-01', to: '2026-11-05' },
      { id: 'p2', name: 'P2', from: '2026-11-05', to: '2026-11-15' },
      { id: 'coi', name: 'COI', from: '2026-11-20', to: '2026-11-20', milestone: true },
    ];
    const next = cascadeEdit(parts, 0, 'to', '2026-11-08');
    expect(next[1]).toMatchObject({ from: '2026-11-08', to: '2026-11-18' });
    expect(next[2]).toMatchObject({ from: '2026-11-20', to: '2026-11-20' });
    expect(cascadeEdit([{ ...parts[0]!, done: true }], 0, 'to', '2026-12-01')[0]?.to).toBe('2026-11-05');
  });
});
