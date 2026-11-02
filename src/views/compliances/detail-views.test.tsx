import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * The staff detail pages of the statutory and non-statutory split (COMPLIANCE-MODEL.md 4.2
 * and 4.3), rendered against mocked fetches of the routes in docs/ui-port/COMPLIANCE-API.md.
 * The existing record cards (From the client, Filled by SBC, thread, Assist, Before filing,
 * window and proof) have their own tests and are stubbed here.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/app/manager/compliances/obligations',
}));
vi.mock('@/components/SEO', () => ({ SEO: () => null }));
vi.mock('@/components/shell/PageTransition', () => ({ PageTransition: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/toast-saved', () => ({ toastSaved: vi.fn() }));
vi.mock('@/lib/toast-errors', () => ({ toastError: vi.fn(), errorMessage: (_e: unknown, f: string) => f }));
vi.mock('@/views/compliances/input-cards', () => ({
  StaffFromClientCard: () => <section aria-label="From the client" />,
  StaffSbcFieldsCard: ({ facts }: { facts: Array<{ label: string; value: string | null }> }) => (
    <section aria-label="Filled by SBC">{facts.map((f) => `${f.label}: ${f.value ?? '-'}`).join(' | ')}</section>
  ),
}));
vi.mock('@/views/compliances/record-cards', () => ({
  FilingThreadCard: () => null,
  BeforeFilingCard: () => <section aria-label="Before filing" />,
}));
vi.mock('@/components/compliances/AssistParts', () => ({ AssistCard: () => <section aria-label="VCFO Assist" /> }));
vi.mock('@/views/compliances/filing-actions', () => ({ FilingWindowCell: () => null, FilingProofCell: () => null }));
vi.mock('@/views/compliances/use-register', () => ({
  useRegister: () => ({ rows: [], details: new Map(), fyStartYear: 2026, isPending: false, isError: false }),
  useMayWriteFilings: () => true,
}));

const appState = { user: { id: 'u-manager', role: 'manager' } };
vi.mock('@/context/AppContext', () => ({ useApp: () => appState }));

const { TaskDetailView } = await import('@/views/compliances/TaskDetailView');
const { StatDetailView } = await import('@/views/compliances/StatDetailView');

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
let routes: Record<string, () => { status: number; body: unknown }> = {};

// Radix Checkbox measures itself.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body ? 'form' : undefined;
      calls.push({ url: input, method, body });
      const hit = routes[`${method} ${input.split('?')[0]}`];
      const res = hit ? hit() : { status: 404, body: { error: 'not_found' } };
      return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  appState.user = { id: 'u-manager', role: 'manager' };
});

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const person = (id: string, name: string) => ({ id, name });
const reminders = [
  { key: 'initial', label: 'First reminder', to: 'Owner', offsetDays: -5, date: '2099-10-15', enabled: true, overridden: false, state: 'sent', sentAt: null, internal: false },
  { key: 'due-date', label: 'Due today', to: 'Owner and reviewer', offsetDays: 0, date: '2099-10-20', enabled: true, overridden: false, state: 'scheduled', sentAt: null, internal: false },
  { key: 'escalate-admin', label: 'Escalation', to: 'Compliance admin', offsetDays: 5, date: '2099-10-25', enabled: true, overridden: false, state: 'scheduled', sentAt: null, internal: true },
];
const steps = [
  { key: 'created', label: 'Created', state: 'done', who: 'Pranay', when: '2099-10-01', evidence: null },
  { key: 'inputs', label: 'Inputs ready', state: 'done', who: 'Bharath', when: '2099-10-05', evidence: null },
  { key: 'work', label: 'Work done', state: 'now', who: 'Bharath', when: null, evidence: null },
  { key: 'review', label: 'Submitted for review', state: 'next', who: null, when: null, evidence: null },
  { key: 'approved', label: 'Approved', state: 'next', who: 'Pranay', when: null, evidence: null },
];

function task(patch: Record<string, unknown> = {}) {
  return {
    id: 't1',
    engagementId: 'acme',
    companyName: 'Acme Pvt Ltd',
    activityId: 'ACT-004',
    activityName: 'MIS report',
    name: 'MIS report',
    periodLabel: 'Oct 2099',
    title: 'MIS report · Oct 2099',
    startDate: '2099-10-12',
    dueDate: '2099-10-20',
    urgency: 'Critical',
    urgencyBars: 4,
    visibility: 'firm',
    stage: 'in-progress',
    stageLabel: 'In progress',
    word: 'In progress',
    hidden: false,
    week: 'Later',
    daysToStart: -2,
    daysToDue: 6,
    owner: person('lead-1', 'Bharath Rao'),
    reviewer: person('u-manager', 'Pranay'),
    repeats: 'monthly',
    remindBefore: 5,
    checklist: { done: 1, total: 2 },
    attachmentCount: 1,
    deliverable: null,
    completedAt: null,
    createdBy: person('u-manager', 'Pranay'),
    createdAt: '2099-10-01T00:00:00Z',
    activity: null,
    checklistItems: [
      { id: 'c1', label: 'Collect trial balance', done: true, doneBy: person('lead-1', 'Bharath Rao'), doneAt: '2099-10-05T10:00:00Z' },
      { id: 'c2', label: 'Draft the report', done: false, doneBy: null, doneAt: null },
    ],
    attachments: [
      { id: 'f1', fileName: 'tb.xlsx', mime: null, sizeBytes: 10, uploadedBy: person('x', 'Rohan'), uploadedAt: '2099-10-04T00:00:00Z', deliverable: false, byClient: true },
    ],
    comments: [{ id: 'm1', author: person('u-manager', 'Pranay'), authorRole: 'manager', body: 'Check the margins', internal: true, at: '2099-10-06T00:00:00Z' }],
    reminders,
    history: [{ at: '2099-10-01T00:00:00Z', who: 'Pranay', what: 'Created the task · Critical' }],
    steps,
    reviewNote: null,
    can: { edit: true, changeStage: true, submit: true, review: false, tick: true, comment: true, upload: true },
    ...patch,
  };
}

describe('Non-statutory task page (4.3)', () => {
  it('shows the head marks and the left and right columns', async () => {
    routes = { 'GET /api/compliances/tasks/t1': () => ({ status: 200, body: { task: task() } }) };
    wrap(<TaskDetailView basePath="/app/manager/compliances" taskId="t1" />);
    const head = await screen.findByRole('region', { name: 'Header' });
    expect(within(head).getByRole('heading', { name: 'MIS report · Oct 2099' })).toBeInTheDocument();
    expect(within(head).getByText('Critical')).toBeInTheDocument();
    expect(within(head).getByText('Firm')).toBeInTheDocument();
    expect(within(head).getByText('Non-statutory')).toBeInTheDocument();
    expect(head).toHaveTextContent('Start 12 Oct 2099 · End 20 Oct 2099');
    for (const t of ['Checklist', 'Attachments', 'Comments', 'Reminders', 'Activity', 'Progress']) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    }
    expect(screen.getByText('Collect trial balance')).toBeInTheDocument();
    expect(screen.getByText('tb.xlsx')).toBeInTheDocument();
    expect(screen.getByText('Check the margins')).toBeInTheDocument();
    expect(screen.getByText('Created the task · Critical')).toBeInTheDocument();
    const progress = screen.getByRole('region', { name: 'Progress' });
    expect(progress).toHaveTextContent('2 of 5');
    expect(progress).toHaveTextContent('Bharath Rao');
  });

  it('lets a lead submit for review through the stage route', async () => {
    appState.user = { id: 'lead-1', role: 'intern' };
    // The route sends a lead's rights: no edit.
    const leadCan = { ...task().can, edit: false };
    let current = task({ can: leadCan });
    routes = {
      'GET /api/compliances/tasks/t1': () => ({ status: 200, body: { task: current } }),
      'PATCH /api/compliances/tasks/t1': () => {
        current = task({ stage: 'review', stageLabel: 'Submitted for review', can: { ...leadCan, submit: false } });
        return { status: 200, body: { task: current } };
      },
    };
    wrap(<TaskDetailView basePath="/app/intern/compliances" taskId="t1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ action: 'stage', stage: 'review' }));
    expect(await screen.findByRole('button', { name: 'Submitted' })).toBeDisabled();
    // A lead cannot change the reminder days.
    expect(screen.queryByRole('button', { name: 'Edit schedule' })).toBeNull();
  });

  it('lets a manager approve or send back a task in review', async () => {
    routes = {
      'GET /api/compliances/tasks/t1': () => ({ status: 200, body: { task: task({ stage: 'review', can: { ...task().can, review: true } }) } }),
      'POST /api/compliances/tasks/t1/review': () => ({ status: 200, body: { task: task({ stage: 'rework' }) } }),
    };
    wrap(<TaskDetailView basePath="/app/manager/compliances" taskId="t1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send back' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Add the notes' } });
    fireEvent.submit(screen.getByLabelText('Reason').closest('form')!);
    await waitFor(() => expect(calls.find((c) => c.url.endsWith('/review'))?.body).toEqual({ decision: 'send-back', note: 'Add the notes' }));
  });

  it('ticks the checklist, comments and changes the reminder days', async () => {
    routes = {
      'GET /api/compliances/tasks/t1': () => ({ status: 200, body: { task: task() } }),
      'PATCH /api/compliances/tasks/t1/checklist/c2': () => ({ status: 200, body: { item: {} } }),
      'POST /api/compliances/tasks/t1/comments': () => ({ status: 201, body: { comment: {} } }),
      'PUT /api/compliances/reminders': () => ({ status: 200, body: { notifyDays: 7, rows: [], blockedBy: [], editable: true } }),
    };
    wrap(<TaskDetailView basePath="/app/manager/compliances" taskId="t1" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Draft the report' }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith('/checklist/c2'))?.body).toEqual({ done: true }));

    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Looks fine' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Internal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith('/comments'))?.body).toEqual({ body: 'Looks fine', internal: true }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit schedule' }));
    fireEvent.change(screen.getByLabelText('First reminder'), { target: { value: '7' } });
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ kind: 'task', id: 't1', notifyDays: 7 }));
  });

  it('edits a task, deletes an item and a file, and overrides one reminder', async () => {
    const defaults = { owner: null, reviewer: null, owners: [person('lead-1', 'Bharath Rao'), person('lead-2', 'Asha')], reviewers: [person('u-manager', 'Pranay')], activities: [] };
    const overridden = reminders.map((r) => (r.key === 'initial' ? { ...r, overridden: true } : r));
    routes = {
      'GET /api/compliances/tasks/t1': () => ({ status: 200, body: { task: task({ reminders: overridden }) } }),
      'GET /api/compliances/tasks/defaults': () => ({ status: 200, body: defaults }),
      'PATCH /api/compliances/tasks/t1': () => ({ status: 200, body: { task: task({ urgency: 'Low' }) } }),
      'DELETE /api/compliances/tasks/t1/checklist/c2': () => ({ status: 200, body: { ok: true } }),
      'DELETE /api/compliances/tasks/t1/attachments/f1': () => ({ status: 200, body: { ok: true } }),
      'PUT /api/compliances/reminders': () => ({ status: 200, body: { notifyDays: 5, rows: [], blockedBy: [], editable: true } }),
    };
    wrap(<TaskDetailView basePath="/app/manager/compliances" taskId="t1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
    fireEvent.change(within(dialog).getByLabelText('Urgency'), { target: { value: 'Low' } });
    fireEvent.change(within(dialog).getByLabelText('Owner'), { target: { value: 'lead-2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ action: 'edit', urgency: 'Low', ownerId: 'lead-2' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete Draft the report' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/checklist/c2'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Delete tb.xlsx' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/attachments/f1'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Edit schedule' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send escalation to compliance admin' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ kind: 'task', id: 't1', rows: [{ key: 'escalate-admin', enabled: false }] }),
    );
    const offset = screen.getByLabelText('First reminder to owner, days from the due date');
    fireEvent.change(offset, { target: { value: '-7' } });
    fireEvent.blur(offset);
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'PUT').at(-1)?.body).toEqual({ kind: 'task', id: 't1', rows: [{ key: 'initial', offsetDays: -7 }] }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT').at(-1)?.body).toEqual({ kind: 'task', id: 't1', reset: true }));
  });

  it('hides edit and delete from a lead who did not upload the file', async () => {
    appState.user = { id: 'lead-1', role: 'intern' };
    routes = { 'GET /api/compliances/tasks/t1': () => ({ status: 200, body: { task: task({ can: { ...task().can, edit: false } }) } }) };
    wrap(<TaskDetailView basePath="/app/intern/compliances" taskId="t1" />);
    await screen.findByRole('region', { name: 'Header' });
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });

  it('reads a task outside the scope as not found', async () => {
    routes = {};
    wrap(<TaskDetailView basePath="/app/manager/compliances" taskId="t9" />);
    expect(await screen.findByText('This task is not in your clients')).toBeInTheDocument();
  });
});

function stat(patch: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    engagementId: 'acme',
    companyName: 'Acme Pvt Ltd',
    obligationId: 'gst-3b',
    name: 'GSTR-3B',
    periodLabel: 'Sep 2099',
    fyLabel: 'FY 2099-00',
    title: 'GSTR-3B · Sep 2099',
    area: 'GST',
    authority: 'GST',
    frequency: 'monthly',
    periodStart: '2099-09-01',
    periodEnd: '2099-09-30',
    dueDate: '2099-10-20',
    filedOn: null,
    window: null,
    visibility: 'both',
    stage: 'in-progress',
    stageLabel: 'In progress',
    word: 'In progress',
    daysToDue: 4,
    owner: person('lead-1', 'Bharath Rao'),
    reviewer: person('u-manager', 'Pranay'),
    primaryAction: 'approve',
    activity: null,
    clientInputs: null,
    filledBySbc: {
      fields: [],
      acknowledgementNo: null,
      amountPaid: '12,400',
      filedBy: null,
      dataReceivedOn: '2099-10-05',
      preparingSince: '2099-10-06',
      approvedOn: null,
      locked: false,
    },
    proofs: [],
    reminders,
    remindersBlockedBy: ['activity not confirmed'],
    rule: { dueRule: '20th of the next month', applies: 'Regular GST taxpayers', penalty: '₹50 a day', note: null, confirm: 'Q4 date to confirm' },
    history: [{ at: '2099-10-06T00:00:00Z', who: 'Bharath Rao', what: 'Started preparing' }],
    steps: [
      { key: 'data', label: 'Data from client', state: 'done', who: 'Acme', when: '2099-10-05', evidence: null },
      { key: 'prep', label: 'Prepared', state: 'now', who: 'Bharath Rao', when: null, evidence: null },
      { key: 'review', label: 'Submitted for review', state: 'next', who: null, when: null, evidence: null },
      { key: 'approved', label: 'Approved', state: 'next', who: null, when: null, evidence: null },
      { key: 'filed', label: 'Filed or paid', state: 'next', who: null, when: null, evidence: null },
      { key: 'ack', label: 'Acknowledged', state: 'next', who: null, when: null, evidence: null },
    ],
    checklist: [],
    assistRuns: [],
    previous: [
      { id: 'i0', periodLabel: 'Aug 2099', dueDate: '2099-09-20', filedOn: '2099-09-22', late: true },
      { id: 'i-1', periodLabel: 'Jul 2099', dueDate: '2099-08-20', filedOn: '2099-08-18', late: false },
    ],
    reviewNote: null,
    can: { submit: true, approve: true, sendBack: true, assign: true, editReminders: true, upload: false },
    ...patch,
  };
}

describe('Statutory detail page (4.2)', () => {
  it('shows the head, the left cards in order and the progress with previous periods', async () => {
    routes = { 'GET /api/compliances/statutory/i1': () => ({ status: 200, body: { detail: stat() } }) };
    wrap(<StatDetailView basePath="/app/manager/compliances" obligationId="gst-3b" instanceId="i1" />);
    const head = await screen.findByRole('region', { name: 'Header' });
    expect(within(head).getByRole('heading', { name: 'GSTR-3B · Sep 2099' })).toBeInTheDocument();
    expect(within(head).getByText('Statutory')).toBeInTheDocument();
    expect(within(head).getByText('GST')).toBeInTheDocument();
    // Approve waits for the item to be in review.
    expect(within(head).getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(within(head).getByRole('link', { name: /All clients/ }).getAttribute('href')).toBe('/app/manager/compliances/obligations/gst-3b');

    const order = ['From the client', 'Filled by SBC', 'Reminders', 'Rule', 'Activity'].map((n) => screen.getByRole('region', { name: n }));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByRole('region', { name: 'Filled by SBC' })).toHaveTextContent('Amount paid: 12,400');
    expect(screen.getByRole('region', { name: 'Reminders' })).toHaveTextContent('Reminders are on hold until these are set: activity not confirmed.');
    // A manager does not see the open point the owner must confirm.
    expect(screen.queryByText(/To confirm/)).toBeNull();

    const progress = screen.getByRole('region', { name: 'Progress' });
    expect(progress).toHaveTextContent('1 of 6');
    expect(progress).toHaveTextContent('Pranay');
    const previous = screen.getByRole('region', { name: 'Previous periods' });
    expect(within(previous).getByText('Late')).toBeInTheDocument();
    expect(within(previous).getByText('On time')).toBeInTheDocument();
    expect(within(previous).getAllByRole('link')[0]!.getAttribute('href')).toBe('/app/manager/compliances/obligations/gst-3b/i0');
  });

  it('shows the confirm note to an admin and approves an item in review', async () => {
    appState.user = { id: 'u-admin', role: 'admin' };
    routes = {
      'GET /api/compliances/statutory/i1': () => ({ status: 200, body: { detail: stat({ stage: 'review' }) } }),
      'PATCH /api/compliances/statutory/i1': () => ({ status: 200, body: { detail: stat({ stage: 'in-progress', filledBySbc: { ...stat().filledBySbc, approvedOn: '2099-10-16' } }) } }),
    };
    wrap(<StatDetailView basePath="/app/admin/compliances" obligationId="gst-3b" instanceId="i1" />);
    expect(await screen.findByText('Q4 date to confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ action: 'approve' }));
  });

  it('assigns the owner and the reviewer', async () => {
    routes = {
      'GET /api/compliances/statutory/i1': () => ({ status: 200, body: { detail: stat() } }),
      'GET /api/compliances/tasks/defaults': () => ({
        status: 200,
        body: { owner: null, reviewer: null, owners: [person('lead-1', 'Bharath Rao'), person('lead-2', 'Asha')], reviewers: [person('u-manager', 'Pranay')], activities: [] },
      }),
      'PATCH /api/compliances/statutory/i1': () => ({ status: 200, body: { detail: stat({ owner: person('lead-2', 'Asha') }) } }),
    };
    wrap(<StatDetailView basePath="/app/manager/compliances" obligationId="gst-3b" instanceId="i1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Assign' }));
    const form = screen.getByRole('form', { name: 'Assign' });
    await within(form).findByRole('option', { name: 'Asha' });
    fireEvent.change(within(form).getByLabelText('Owner'), { target: { value: 'lead-2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ action: 'assign', ownerId: 'lead-2', reviewerId: 'u-manager' }),
    );
  });

  it('lets a lead submit for review', async () => {
    appState.user = { id: 'lead-1', role: 'intern' };
    routes = {
      'GET /api/compliances/statutory/i1': () => ({
        status: 200,
        body: { detail: stat({ primaryAction: 'submit', rule: { ...stat().rule, confirm: null }, can: { ...stat().can, editReminders: false } }) },
      }),
      'PATCH /api/compliances/statutory/i1': () => ({ status: 200, body: { detail: stat({ primaryAction: 'submit', stage: 'review' }) } }),
    };
    wrap(<StatDetailView basePath="/app/intern/compliances" obligationId="gst-3b" instanceId="i1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ action: 'submit' }));
    expect(screen.queryByRole('button', { name: 'Edit schedule' })).toBeNull();
  });
});
