import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, renderHook, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const portal = { after: true, toast: vi.fn(), go: vi.fn(), openChat: vi.fn(), shell: null };
vi.mock('../../PortalProvider', () => ({
  usePortal: () => portal,
  usePortalOptional: () => portal,
  usePortalCrumbs: () => undefined,
}));

import { CompliancesTask } from './TaskPage';
import { TaskList } from './TaskList';
import { useClientTasks, useStatExtras } from './task-api';
import type { ClientTask } from './tasks';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const TASK_ROW = {
  id: 'tk1',
  title: 'MIS report · Oct 2026',
  name: 'MIS report',
  activityName: 'MIS',
  startDate: '2026-10-05',
  dueDate: '2099-10-20',
  urgency: 'High',
  visibility: 'both',
  stage: 'waiting',
  stageLabel: 'Waiting for client',
  word: 'Waiting',
  hidden: false,
  owner: { id: 'u1', name: 'Bharath Rao' },
  reviewer: null,
  remindBefore: 5,
  deliverable: null,
  completedAt: null,
};

type Route = [RegExp, number, unknown];
function mockFetch(routes: Route[]) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) return new Response(JSON.stringify({ error: 'no mock' }), { status: 500 });
    const [, status, body] = hit;
    void init;
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  portal.toast.mockReset();
  portal.go.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('client task data (K-1, D-4)', () => {
  it('reads the task list route and drops not-applicable rows', async () => {
    const f = mockFetch([[/\/api\/compliances\/tasks$/, 200, { tasks: [TASK_ROW, { ...TASK_ROW, id: 'na', hidden: true }], today: '2026-10-14' }]]);
    const { result } = renderHook(() => useClientTasks(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f.mock.calls[0]![0]).toBe('/api/compliances/tasks');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]).toMatchObject({ name: 'MIS report · Oct 2026', endDate: '2099-10-20', stage: 'waiting', ownerName: 'Bharath Rao', notifyDays: 5 });
  });

  it('keeps escalations and the confirm note off the statutory detail', async () => {
    mockFetch([
      [
        /\/api\/compliances\/statutory\/i1$/,
        200,
        {
          detail: {
            stage: 'in-progress',
            stageLabel: 'In progress',
            daysToDue: 3,
            owner: { id: 'u1', name: 'Bharath' },
            rule: { dueRule: '20th of next month', applies: 'Every GST registrant', penalty: '₹50 a day', note: null, confirm: 'Check the date' },
            reminders: [
              { key: 'initial', label: 'First reminder', to: 'Owner', date: '2026-10-15', state: 'sent', internal: false },
              { key: 'escalate-admin', label: 'Escalation', to: 'Compliance admin', date: '2026-10-25', state: 'scheduled', internal: true },
            ],
            history: [{ at: '2026-10-10T10:00:00Z', who: 'Bharath', what: 'Started' }],
            steps: [{ key: 'data', label: 'Data from client', state: 'done', who: 'Northwind', when: '2026-10-09', evidence: null }],
            previous: [],
            can: { upload: true },
          },
        },
      ],
    ]);
    const { result } = renderHook(() => useStatExtras('i1'), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const d = result.current.data!;
    expect(d.reminders.map((r) => r.key)).toEqual(['initial']);
    expect(d.rule).not.toHaveProperty('confirm');
    expect(d.owner).toBe('Bharath');
    expect(d.steps[0]!.label).toBe('Data from client');
  });
});

describe('client task page (4.3, K-2)', () => {
  it('shows the task without internal parts and lets the client comment', async () => {
    const f = mockFetch([
      [
        /\/api\/compliances\/tasks\/tk1\/comments$/,
        201,
        { comment: { id: 'c9' } },
      ],
      [
        /\/api\/compliances\/tasks\/tk1$/,
        200,
        {
          task: {
            ...TASK_ROW,
            checklistItems: [{ id: 'a', label: 'Send the bank statement', done: true, doneBy: { id: 'u', name: 'Bharath' }, doneAt: '2026-10-08T00:00:00Z' }],
            attachments: [{ id: 'f1', fileName: 'bank.pdf', uploadedBy: { id: 'c', name: 'Rohan' }, uploadedAt: '2026-10-08T00:00:00Z' }],
            comments: [
              { id: 'x', author: { id: 'u', name: 'Bharath' }, body: 'Please send the statement', internal: false, at: '2026-10-07T00:00:00Z' },
              { id: 'y', author: { id: 'u', name: 'Pranay' }, body: 'Secret firm note', internal: true, at: '2026-10-07T00:00:00Z' },
            ],
            reminders: [
              { key: 'initial', label: 'First reminder', to: 'Owner', date: '2099-10-15', state: 'scheduled', internal: false },
              { key: 'escalate-reviewer', label: 'Escalation', to: 'Reviewer or manager', date: '2099-10-22', state: 'scheduled', internal: true },
            ],
            history: [],
            steps: [{ key: 'created', label: 'Created', state: 'done', who: 'Pranay', when: '2026-10-03', evidence: null }],
            can: { comment: true, upload: true },
          },
        },
      ],
    ]);
    render(<CompliancesTask id="tk1" />, { wrapper: wrap() });
    expect(await screen.findByRole('heading', { name: 'MIS report · Oct 2026' })).toBeInTheDocument();
    expect(screen.getByText('Send the bank statement')).toBeInTheDocument();
    expect(screen.getByText('bank.pdf')).toBeInTheDocument();
    expect(screen.getByText('Please send the statement')).toBeInTheDocument();
    expect(screen.queryByText('Secret firm note')).not.toBeInTheDocument();
    expect(screen.queryByText('Escalation')).not.toBeInTheDocument();
    expect(screen.queryByText(/reviewer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new task/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /upload/i }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Sent it today' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(f.mock.calls.some(([u, i]) => String(u).endsWith('/tk1/comments') && (i as RequestInit)?.method === 'POST')).toBe(true));
    const call = f.mock.calls.find(([u]) => String(u).endsWith('/tk1/comments'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ body: 'Sent it today' });
    await waitFor(() => expect(portal.toast).toHaveBeenCalledWith('Comment added · SBC is told'));
  });

  it('reads a firm-only task (404) as not shared', async () => {
    mockFetch([[/\/api\/compliances\/tasks\/firm1$/, 404, { error: 'not_found' }]]);
    render(<CompliancesTask id="firm1" />, { wrapper: wrap() });
    expect(await screen.findByText('This task is not shared with you')).toBeInTheDocument();
  });
});

describe('task table (S-3, K-1)', () => {
  it('groups by end week with no visibility or reviewer column', () => {
    const base: ClientTask = {
      id: 'a',
      name: 'Board pack',
      activityName: 'MIS',
      startDate: '2026-10-01',
      endDate: '2026-10-16',
      urgency: 'Critical',
      visibility: 'both',
      stage: 'in_progress',
      completedOn: null,
      ownerName: 'Bharath Rao',
      notifyDays: 5,
      deliverable: null,
    };
    render(<TaskList tasks={[base, { ...base, id: 'b', name: 'Stock count', endDate: '2026-11-30' }, { ...base, id: 'c', name: 'Old MIS', stage: 'completed' }]} today="2026-10-14" />, {
      wrapper: wrap(),
    });
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Done/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Visibility')).not.toBeInTheDocument();
    expect(screen.queryByText('Reviewer')).not.toBeInTheDocument();
    expect(screen.getAllByTitle('Urgency: Critical').length).toBe(3);
  });
});
