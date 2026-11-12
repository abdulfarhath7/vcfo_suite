import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * BR-04 / BR-05: the client edits the board resolution in the document itself. There is no
 * separate "Edit draft" form: typing in the preview marks the draft changed, and "Save changes"
 * stores the paragraphs through the client edit route.
 */

let emit: ((content: string) => void) | undefined;
vi.mock('@/components/board-resolution/BoardResolutionDocPreview', () => ({
  BoardResolutionDocPreview: (p: { editable?: boolean; onDocumentChange?: (c: string) => void }) => {
    emit = p.onDocumentChange;
    return <div data-testid="doc" data-editable={p.editable ? 'yes' : 'no'} />;
  },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { BoardResolutionDraftEditor } = await import('./BoardResolutionDraftEditor');

const view = (actions: string[]) => ({ stage: null, original: ['A', 'B'], edited: null, changes: [], actions, holder: null });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  emit = undefined;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('BoardResolutionDraftEditor', () => {
  it('shows the read-only fallback when the viewer may not edit', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ view: view([]) }) });
    render(<BoardResolutionDraftEditor engagementId="e1" fallback={<p>read only</p>} />);
    await screen.findByText('read only');
    expect(screen.queryByTestId('br-draft-editor')).toBeNull();
  });

  it('edits in the document and saves the paragraphs', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ view: view(['save']) }) });
    render(<BoardResolutionDraftEditor engagementId="e1" fallback={<p>read only</p>} />);
    const doc = await screen.findByTestId('doc');
    expect(doc.getAttribute('data-editable')).toBe('yes');
    expect(screen.queryByRole('button', { name: /Edit draft/ })).toBeNull();
    const saveBtn = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    act(() => emit?.('A changed\nB'));
    expect(saveBtn.disabled).toBe(false);

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ view: view(['save']) }) });
    fireEvent.click(saveBtn);
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')).toBe(true));
    const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')!;
    expect(JSON.parse((put[1] as RequestInit).body as string)).toEqual({ paragraphs: ['A changed', 'B'] });
  });
});
