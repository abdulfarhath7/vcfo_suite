import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A chat message that starts a background drop (a SharePoint fetch) shows the drop's progress bar. */

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

const RUN = '11111111-1111-4111-8111-111111111111';
const answer = { line: 'I am reading the SharePoint folder Bonterra India for Bonterra.', citations: [], actions: [], origin: 'work', depth: 'normal', runId: RUN };
const fetchMock = vi.fn();

function serve(chatLines: object[]) {
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/ask/chat') return Promise.resolve(new Response(chatLines.map((l) => JSON.stringify(l)).join('\n') + '\n', { status: 200 }));
    if (url.startsWith(`/api/ask/runs/${RUN}`)) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: RUN, status: 'running', progress: { done: 12, total: 50, label: 'Copying files from SharePoint' }, files: [], groups: [], unplaced: [], answerMessageId: null }), { status: 200 }),
      );
    }
    if (url.startsWith('/api/ask/conversations?')) return Promise.resolve(new Response(JSON.stringify({ conversations: [], hasMore: false }), { status: 200 }));
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function send(text: string) {
  render(wrap(<AskShellMount userRole="admin"><AskFullPage /></AskShellMount>));
  const box = await screen.findByPlaceholderText('Ask, paste details, or drop files or a folder…');
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText(answer.line);
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no layout, so the thread's scroll-to-end call needs a stand-in.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('a drop started from a chat message', () => {
  it('shows the progress bar while the run works', async () => {
    serve([{ type: 'answer', conversationId: 'c1', messageId: 'm1', answer }]);
    await send('take data of Bonterra from SharePoint');
    expect(await screen.findByTestId('ask-drop-progress')).toHaveTextContent('Copying files from SharePoint');
    expect(screen.getByTestId('ask-drop-progress')).toHaveTextContent('12 of 50');
  });

  it('does not start the bar for a run the same reply said had ended', async () => {
    serve([
      { type: 'run', runId: RUN, status: 'done' },
      { type: 'answer', conversationId: 'c1', messageId: 'm1', answer },
    ]);
    await send('take data of Bonterra from SharePoint');
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/ask/chat')).toBe(true));
    // The answer's own cards may still read the run; only the progress bar must stay off.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('ask-drop-progress')).toBeNull();
  });
});

describe('a fetch-then-fill whose fill answer arrives after the drop', () => {
  const FILL_RUN = '22222222-2222-4222-8222-222222222222';
  const fillAnswer = { line: 'The card is ready, so I am filling it (Manual).', citations: [], actions: [], origin: 'work', depth: 'normal', fill: { runId: FILL_RUN, mode: 'manual' } };

  function serveSettled() {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/ask/chat') {
        return Promise.resolve(new Response(JSON.stringify({ type: 'answer', conversationId: 'c1', messageId: 'm1', answer }) + '\n', { status: 200 }));
      }
      if (url.startsWith(`/api/ask/runs/${RUN}`)) {
        return Promise.resolve(new Response(JSON.stringify({ id: RUN, status: 'done', progress: { done: 50, total: 50, label: 'Done' }, files: [], groups: [], unplaced: [], answerMessageId: 'm2' }), { status: 200 }));
      }
      if (url === '/api/ask/conversations/c1') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              messages: [
                { id: 'u1', sender: 'user', text: 'fill Bonterra from SharePoint', answer: null },
                { id: 'm1', sender: 'assistant', text: answer.line, answer },
                { id: 'm2', sender: 'assistant', text: fillAnswer.line, answer: fillAnswer },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.startsWith('/api/ask/conversations?')) return Promise.resolve(new Response(JSON.stringify({ conversations: [], hasMore: false }), { status: 200 }));
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  }

  it('hands the new fill run to the live player once, with the remembered Auto and "Watch it fill"', async () => {
    window.localStorage.setItem('vcfo.ask.fillMode', 'auto');
    window.localStorage.setItem('vcfo.ask.fillSpeed', 'watch');
    const started: unknown[] = [];
    const onStart = (event: Event) => started.push((event as CustomEvent).detail);
    window.addEventListener('vcfo:ask-fill-start', onStart);
    try {
      serveSettled();
      await send('fill Bonterra from SharePoint');
      expect(await screen.findByText(fillAnswer.line)).toBeInTheDocument();
      await waitFor(() => expect(started).toHaveLength(1));
      // Auto with "Watch it fill" was asked of the server as Manual; the player saves each page itself.
      expect(started[0]).toEqual({ runId: FILL_RUN, mode: 'manual', autoAccept: true });
      const chat = fetchMock.mock.calls.find(([u]) => u === '/api/ask/chat');
      expect(JSON.parse(String((chat?.[1] as RequestInit).body)).fillMode).toBe('manual');
      await new Promise((r) => setTimeout(r, 50));
      expect(started).toHaveLength(1);
    } finally {
      window.removeEventListener('vcfo:ask-fill-start', onStart);
    }
  });
});
