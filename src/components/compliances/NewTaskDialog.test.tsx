import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewTaskDialog, type NewTaskPayload } from '@/components/compliances/NewTaskDialog';
import { newTaskErrors, parsePlain } from '@/components/compliances/new-task-form';
import { UrgencyPill, VisibilityTag } from '@/components/compliances/TaskMarks';

const NOW = new Date(Date.UTC(2026, 9, 16, 12));

const activities = [
  { id: 'ACT-004', name: 'MIS report', kind: 'Non-statutory', repeats: 'monthly' as const, notifyDays: 5, visibility: 'both' as const },
  { id: 'ACT-013', name: 'Board pack', kind: 'Configurable', notifyDays: 10, visibility: 'firm' as const },
];
const clients = [
  { id: 'acme', name: 'Acme Pvt Ltd', ownerId: 'u-lead', reviewerId: 'u-mgr' },
  { id: 'birch', name: 'Birch LLP', ownerId: null, reviewerId: null },
];
const owners = [
  { id: 'u-lead', name: 'Bharath' },
  { id: 'u-mgr', name: 'Pranay' },
];

function open(onCreate = vi.fn().mockResolvedValue(true), onOpenChange = vi.fn()) {
  render(
    <NewTaskDialog
      open
      onOpenChange={onOpenChange}
      now={NOW}
      activities={activities}
      clients={clients}
      owners={owners}
      reviewers={owners}
      onCreate={onCreate}
    />,
  );
  return { onCreate, onOpenChange };
}

describe('TaskMarks', () => {
  it('draws the urgency bars and the visibility word', () => {
    const { container, rerender } = render(<UrgencyPill urgency="High" />);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(container.querySelector('[data-bars="3"]')).not.toBeNull();
    rerender(<VisibilityTag visibility="firm" />);
    expect(screen.getByText('Firm')).toBeInTheDocument();
  });
});

describe('newTaskErrors', () => {
  const base = { act: 'ACT-004', name: '', client: 'acme', start: '2026-10-16', end: '2026-10-20', owner: 'u-lead', notify: '5' };
  it('passes a full form', () => {
    expect(Object.values(newTaskErrors(base)).filter(Boolean)).toEqual([]);
  });
  it('asks for a name on Other and an end on or after the start', () => {
    expect(newTaskErrors({ ...base, act: 'other' }).name).toBe('Give the task a name');
    expect(newTaskErrors({ ...base, end: '2026-10-10' }).end).toBe('End on or after the start');
    expect(newTaskErrors({ ...base, notify: '99' }).notify).toBe('Use 0 to 90 days');
  });
  it('reads plain dates', () => {
    expect(parsePlain('20 Oct 2026', 2026)).toBe('2026-10-20');
    expect(parsePlain('5 november', 2026)).toBe('2026-11-05');
    expect(parsePlain('31/02/2026', 2026)).toBeUndefined();
  });
});

describe('NewTaskDialog', () => {
  it('shows the errors on an empty save and does not post', async () => {
    const { onCreate } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    const alerts = (await screen.findAllByRole('alert')).map((a) => a.textContent);
    expect(alerts).toEqual(expect.arrayContaining(['Pick an activity', 'Pick a client', 'Pick an end date', 'Pick an owner']));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('fills defaults from the activity and the client, then posts a clean payload', async () => {
    const { onCreate, onOpenChange } = open();
    fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'ACT-004' } });
    expect((screen.getByLabelText('Repeats') as HTMLSelectElement).value).toBe('monthly');
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'acme' } });
    expect((screen.getByLabelText('Owner') as HTMLSelectElement).value).toBe('u-lead');
    expect((screen.getByLabelText('Reviewer') as HTMLSelectElement).value).toBe('u-mgr');
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '23 Oct 2026' } });
    fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: 'Critical' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const payload = onCreate.mock.calls[0]![0] as NewTaskPayload;
    expect(payload).toEqual({
      activityId: 'ACT-004',
      name: 'MIS report',
      engagementId: 'acme',
      startDate: '2026-10-16',
      endDate: '2026-10-23',
      urgency: 'Critical',
      visibility: 'both',
      ownerId: 'u-lead',
      reviewerId: 'u-mgr',
      repeats: 'monthly',
      notifyDays: 5,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('needs a name for Other', async () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Give the task a name')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
