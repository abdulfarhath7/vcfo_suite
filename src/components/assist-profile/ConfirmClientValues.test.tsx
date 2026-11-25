import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmClientValues } from './ConfirmClientValues';

vi.mock('@/components/ui/toast-saved', () => ({ toastSaved: vi.fn() }));
vi.mock('@/lib/toast-errors', () => ({ toastError: vi.fn(), errorMessage: (e: unknown) => String(e) }));

const wrap = (node: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

afterEach(() => vi.unstubAllGlobals());

describe('ConfirmClientValues', () => {
  it('lists the client’s unconfirmed GST values and confirms them with the GST step’s own confirm', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    wrap(<ConfirmClientValues engagementId="eng-1" items={[{ key: 'sac', label: 'SAC codes of the main services (up to five)' }]} />);
    expect(screen.getByText(/Needs your confirmation/)).toBeTruthy();
    expect(screen.getByText('SAC codes of the main services (up to five)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByText(/Confirmed the client/)).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/compliance-inputs');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'confirm', engagementId: 'eng-1', kind: 'registration', key: 'reg-4' });
  });

  it('shows nothing when every value is confirmed', () => {
    const { container } = wrap(<ConfirmClientValues engagementId="eng-1" items={[]} />);
    expect(container.textContent).toBe('');
  });
});
