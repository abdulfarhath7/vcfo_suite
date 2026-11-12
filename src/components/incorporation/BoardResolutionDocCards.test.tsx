import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';

/**
 * BR-02: the signed step shows the draft and the signed copy side by side. Each panel has Open
 * (the shared document viewer) and Download, the signed panel says who uploaded it, and while
 * no signed copy exists the right panel is the upload area itself.
 */

const viewerOpen = vi.fn();
vi.mock('@/components/client-portal/pages/documents/DocViewer', () => ({
  useDocViewer: () => ({ open: viewerOpen, close: vi.fn(), node: null, isOpen: false }),
}));
vi.mock('@/components/board-resolution/BoardResolutionDocPreview', () => ({ BoardResolutionDocPreview: () => null }));
vi.mock('@/components/client-portal/PortalProvider', () => ({ usePortal: () => ({}) }));

const upload = vi.fn();
vi.mock('@/lib/board-resolution/board-resolution-storage', async (orig) => ({
  ...(await orig<typeof import('@/lib/board-resolution/board-resolution-storage')>()),
  uploadSignedBoardResolution: (...a: unknown[]) => upload(...a),
}));
const refetch = vi.fn();
vi.mock('@/lib/projects/engagements-db', () => ({ fetchBoardResolutionInDb: (...a: unknown[]) => refetch(...a) }));

const { BoardResolutionDocCards } = await import('./BoardResolutionDocCards');

const engagement = { id: 'eng-1', slug: 'acme', companyName: 'Acme Pvt Ltd' };
const finalized: BoardResolutionDoc = {
  content: 'x',
  status: 'finalized',
  storagePath: 'br/eng-1.docx',
  updatedAt: '2026-11-11T10:00:00.000Z',
};
const signedDoc: BoardResolutionDoc = {
  ...finalized,
  signedStoragePath: 'br/eng-1-signed.pdf',
  signedUploadedAt: '2026-11-12T10:00:00.000Z',
  signedUploadedBy: 'u-1',
  signedUploadedByName: 'Anil Mehta',
};

beforeEach(() => {
  viewerOpen.mockReset();
  upload.mockReset();
  refetch.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ versions: [{ version: 2, createdAt: '2026-11-11T10:00:00.000Z' }] }) })),
  );
});

describe('BoardResolutionDocCards (signed step)', () => {
  it('shows both panels with version, uploader, Open and Download', async () => {
    render(<BoardResolutionDocCards engagement={engagement} doc={signedDoc} step="signed" viewerRole="manager" />);
    await screen.findByText('Draft v2');
    expect(screen.getByText('Signed copy · v2')).toBeTruthy();
    expect(screen.getByText(/by Anil Mehta/)).toBeTruthy();

    const opens = screen.getAllByRole('button', { name: /Open/ });
    expect(opens).toHaveLength(2);
    fireEvent.click(opens[0]!);
    const [docs, index] = viewerOpen.mock.calls[0]!;
    expect(index).toBe(0);
    expect(docs.map((d: { id: string }) => d.id)).toEqual(['br-draft', 'br-signed']);
    expect(await docs[0].url()).toContain('/api/engagements/eng-1/board-resolution/download');
    expect(await docs[1].url()).toContain('/api/engagements/eng-1/board-resolution/download-signed');
    expect(docs[1].uploadedBy).toBe('Anil Mehta');

    fireEvent.click(opens[1]!);
    expect(viewerOpen.mock.calls[1]![1]).toBe(1);
    expect(screen.getAllByRole('link', { name: /Download/ })).toHaveLength(2);
  });

  it('puts the upload area in the signed panel and reloads the record after an upload', async () => {
    const onDocChange = vi.fn();
    upload.mockResolvedValue({ path: 'br/eng-1-signed.pdf' });
    refetch.mockResolvedValue(signedDoc);
    render(<BoardResolutionDocCards engagement={engagement} doc={finalized} step="signed" viewerRole="client" onDocChange={onDocChange} />);
    expect(screen.queryByRole('link', { name: /Upload the signed copy/ })).toBeNull();

    const input = screen.getByLabelText('Choose Upload the signed copy') as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'signed.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onDocChange).toHaveBeenCalledWith(signedDoc));
    expect(upload).toHaveBeenCalledWith('eng-1', file);
    expect(await screen.findByText(/by Anil Mehta/)).toBeTruthy();
  });

  it('offers no upload before the draft is finalized', async () => {
    render(<BoardResolutionDocCards engagement={engagement} doc={{ ...finalized, status: 'draft' }} step="signed" viewerRole="intern" />);
    await screen.findByText('Draft v2');
    expect(screen.queryByLabelText('Choose Upload the signed copy')).toBeNull();
    expect(screen.getByText(/once the draft is finalized/)).toBeTruthy();
  });
});

describe('BoardResolutionDocCards (draft step)', () => {
  it('opens the draft in the document viewer next to Download', async () => {
    render(<BoardResolutionDocCards engagement={engagement} doc={finalized} step="draft" viewerRole="intern" />);
    fireEvent.click(await screen.findByRole('button', { name: /^Open$/ }));
    expect(viewerOpen.mock.calls[0]![0].map((d: { id: string }) => d.id)).toEqual(['br-draft']);
    expect(screen.getByRole('link', { name: /Download/ })).toBeTruthy();
  });

  it('shows Generate draft to the lead when there is no draft', () => {
    render(<BoardResolutionDocCards engagement={engagement} doc={null} step="draft" viewerRole="intern" />);
    expect(screen.getByRole('link', { name: /Generate draft/ })).toBeTruthy();
  });
});
