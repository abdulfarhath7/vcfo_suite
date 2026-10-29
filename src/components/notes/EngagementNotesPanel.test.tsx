import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EngagementNote } from '@/lib/notes/types';
import { EngagementNotesPanel } from '@/components/notes/EngagementNotesPanel';

/**
 * The staff notes card (G-19): lists the route's notes pinned first, adds a note through
 * POST, and shows Edit only on the caller's own note and Delete only where the route says
 * the caller may delete.
 */

vi.mock('@/lib/toast-errors', () => ({ toastError: vi.fn(), errorMessage: (e: unknown) => String(e) }));

function note(patch: Partial<EngagementNote>): EngagementNote {
  return {
    id: 'n1',
    engagementId: 'acme',
    body: 'Client prefers calls after 4 pm',
    pinned: false,
    authorId: 'u1',
    authorName: 'Asha',
    createdAt: '2026-10-14T10:00:00.000Z',
    updatedAt: '2026-10-14T10:00:00.000Z',
    mine: false,
    canDelete: false,
    ...patch,
  };
}

let notes: EngagementNote[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (init?.method === 'POST') {
    const body = JSON.parse(String(init.body)) as { body: string };
    const created = note({ id: 'n-new', body: body.body, mine: true, canDelete: true });
    notes = [created, ...notes];
    return new Response(JSON.stringify({ ok: true, note: created }), { status: 201 });
  }
  return new Response(JSON.stringify({ ok: true, notes }), { status: 200 });
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EngagementNotesPanel engagementId="acme" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  notes = [
    note({ id: 'n1', body: 'Pinned reminder', pinned: true }),
    note({ id: 'n2', body: 'My own note', mine: true, canDelete: true }),
  ];
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('EngagementNotesPanel', () => {
  it('lists the notes and offers edit and delete only where allowed', async () => {
    renderPanel();
    const pinned = (await screen.findByText('Pinned reminder')).closest('li')!;
    expect(within(pinned).getByText('Asha · Pinned')).toBeInTheDocument();
    expect(within(pinned).getByRole('button', { name: 'Unpin note' })).toBeInTheDocument();
    expect(within(pinned).queryByRole('button', { name: 'Edit note' })).toBeNull();
    expect(within(pinned).queryByRole('button', { name: 'Delete note' })).toBeNull();
    const mine = screen.getByText('My own note').closest('li')!;
    expect(within(mine).getByRole('button', { name: 'Edit note' })).toBeInTheDocument();
    expect(within(mine).getByRole('button', { name: 'Delete note' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/engagements/acme/notes', expect.anything());
  });

  it('adds a note through the route', async () => {
    renderPanel();
    await screen.findByText('My own note');
    fireEvent.change(screen.getByRole('textbox', { name: 'New note' }), { target: { value: 'Call on Friday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByText('Call on Friday')).toBeInTheDocument());
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!;
    expect(post[0]).toBe('/api/engagements/acme/notes');
    expect(JSON.parse(String(post[1]!.body))).toEqual({ body: 'Call on Friday' });
  });

  it('asks before it deletes', async () => {
    renderPanel();
    const mine = (await screen.findByText('My own note')).closest('li')!;
    fireEvent.click(within(mine).getByRole('button', { name: 'Delete note' }));
    expect(within(mine).getByText('Delete this note?')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false);
  });
});
