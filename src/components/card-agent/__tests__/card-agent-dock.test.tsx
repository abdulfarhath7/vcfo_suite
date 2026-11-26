import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findSubAgent } from '@/lib/assist-agents/catalog';
import { toCardAgentInfo } from '@/lib/card-agents/card-agents';

let role = 'intern';
vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ user: { id: 'u1', role }, role, engagements: [{ id: 'eng-1', companyName: 'Kestrel Robotics' }] }),
}));
vi.mock('@/hooks/ask/use-ask-status', () => ({
  useAskStatus: (r: string) => ({ enabled: ['client', 'admin', 'super_admin', 'manager', 'intern'].includes(r), firmName: 'SBC' }),
}));
vi.mock('@/hooks/ask/use-ask-suggestions', () => ({
  useAskSuggestions: () => ({ data: { suggestions: [], snapshot: null }, isError: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app/lead/registrations/eng-1~reg-4',
  useSearchParams: () => new URLSearchParams(),
}));

const { AskShellMount } = await import('@/components/ask/AskShellMount');
const { useCardAgent } = await import('@/hooks/use-card-agent');

const gstAgent = toCardAgentInfo(findSubAgent('gst-reg-01')!, 'prepare');
const cardCalls: string[] = [];

function CardPage() {
  useCardAgent({ engagementId: 'eng-1', stepId: 'reg-4' });
  return <p>GST registration</p>;
}

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  role = 'intern';
  cardCalls.length = 0;
  window.sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/card-agents')) {
        cardCalls.push(url);
        return new Response(JSON.stringify({ ok: true, agents: [gstAgent], companyName: 'Kestrel Robotics' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      // The GST readiness the panel's intro reads; everything else is not needed here.
      if (url.includes('/gst-registration')) {
        return new Response(
          JSON.stringify({
            ok: true,
            engagementId: 'eng-1',
            projectKey: 'eng-1',
            view: { companyName: 'Kestrel Robotics', ready: false, line: '', gaps: [], gapCount: 1, confirm: [], actions: [] },
            missing: [{ key: 'goods.1.hsn', label: 'HSN codes', kind: 'value', source: 'client', where: 'GST step', stepId: 'reg-4', required: true }],
            fields: { 'partA.legalName': 'KESTREL ROBOTICS PVT LTD' },
            notes: [],
            documents: [],
            zoho: { linked: false },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404, headers: { 'content-type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the corner dock on a card page', () => {
  it('shows two robots, the card agent and Ask VCFO, and opens only one panel at a time', async () => {
    render(wrap(<AskShellMount userRole="intern"><CardPage /></AskShellMount>));

    const cardButton = await screen.findByRole('button', { name: 'Open GST Reg Agent, Prepares data' });
    const askButton = screen.getByRole('button', { name: 'Open Ask VCFO chat' });
    expect(document.getElementById('card-agent-dock')).not.toBeNull();
    expect(document.getElementById('ask-avatar')).not.toBeNull();
    expect(cardCalls[0]).toBe('/api/card-agents?engagementId=eng-1&stepId=reg-4');

    // Open the card panel: the robot's own panel, no Ask chat.
    fireEvent.click(cardButton);
    const panel = await screen.findByRole('complementary', { name: 'GST Reg Agent' });
    expect(panel).toHaveTextContent('Kestrel Robotics · GST REG-01');
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Ask VCFO' })).toBeNull();
    expect(await screen.findByText(/1 required item is missing/)).toBeInTheDocument();

    // Open the Ask chat: the card panel closes.
    fireEvent.click(askButton);
    expect(await screen.findByRole('complementary', { name: 'Ask VCFO' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'GST Reg Agent' })).toBeNull());

    // Open the card panel again: the Ask chat closes.
    fireEvent.click(screen.getByRole('button', { name: 'Open GST Reg Agent, Prepares data' }));
    expect(await screen.findByRole('complementary', { name: 'GST Reg Agent' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Ask VCFO' })).toBeNull());

    // Start opens "Before I fill"; Fill now stays locked while a required item is open.
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('region', { name: 'Missing, required' })).toHaveTextContent('HSN codes');
    expect(screen.getByRole('button', { name: 'Fill now' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('HSN codes'), { target: { value: 'portal' } });
    expect(screen.getByRole('button', { name: 'Fill now' })).toBeEnabled();

    // Esc closes it.
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'GST Reg Agent' })).toBeNull());
  });

  it('gives a client no card robot, only Ask VCFO', async () => {
    role = 'client';
    render(wrap(<AskShellMount userRole="client"><CardPage /></AskShellMount>));
    expect(await screen.findByRole('button', { name: 'Open Ask VCFO chat' })).toBeInTheDocument();
    expect(document.getElementById('card-agent-dock')).toBeNull();
    expect(cardCalls).toEqual([]);
  });

  it('shows no card robot on a page without a card', async () => {
    render(wrap(<AskShellMount userRole="admin"><p>Home</p></AskShellMount>));
    expect(await screen.findByRole('button', { name: 'Open Ask VCFO chat' })).toBeInTheDocument();
    expect(document.getElementById('card-agent-dock')).toBeNull();
    expect(cardCalls).toEqual([]);
  });
});
