import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The full page's chat list comes from the server; localStorage is the offline fallback (owner item F4). */

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ user: { id: 'u1', role: 'admin' }, engagements: [] }),
}));
vi.mock('@/hooks/ask/use-ask-status', () => ({
  useAskStatus: () => ({ enabled: true, firmName: 'SBC' }),
}));
vi.mock('@/hooks/ask/use-ask-suggestions', () => ({
  useAskSuggestions: () => ({ data: { suggestions: [], snapshot: null }, isError: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app/admin/ask',
  useSearchParams: () => new URLSearchParams(),
}));

const { AskShellMount } = await import('@/components/ask/AskShellMount');
const { AskFullPage } = await import('@/components/ask/AskFullPage');

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const fetchMock = vi.fn();

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('full Ask page chat list', () => {
  it('reads the list from GET /api/ask/conversations', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            conversations: [{ id: 'c1', title: 'Server chat about TDS', updatedAt: '2026-10-30T10:00:00Z', messageCount: 2 }],
            hasMore: false,
          }),
          { status: url.startsWith('/api/ask/conversations?') ? 200 : 404 },
        ),
      ),
    );
    window.localStorage.setItem(
      'vcfo.ask.history.u1',
      JSON.stringify([{ id: 'l1', title: 'Local only chat', at: '2026-10-29T10:00:00Z', scope: 'vcfo.ask.conv.admin.firm' }]),
    );
    render(wrap(<AskShellMount userRole="admin"><AskFullPage /></AskShellMount>));
    expect(await screen.findByText('Server chat about TDS')).toBeInTheDocument();
    expect(screen.queryByText('Local only chat')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ask/conversations?shell=admin');
  });

  it('falls back to localStorage when the server list fails', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    window.localStorage.setItem(
      'vcfo.ask.history.u1',
      JSON.stringify([{ id: 'l1', title: 'Local only chat', at: '2026-10-29T10:00:00Z', scope: 'vcfo.ask.conv.admin.firm' }]),
    );
    render(wrap(<AskShellMount userRole="admin"><AskFullPage /></AskShellMount>));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText('Local only chat')).toBeInTheDocument();
  });
});
