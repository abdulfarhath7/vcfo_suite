import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AskProvider } from '@/components/ask/AskProvider';
import { useAskOptional, type AskContextValue } from '@/components/ask/ask-context';

vi.mock('@/context/AppContext', () => ({ useApp: () => ({ user: { id: 'u1', role: 'admin' }, engagements: [] }) }));
vi.mock('@/hooks/ask/use-ask-status', () => ({ useAskStatus: () => ({ enabled: true, firmName: 'SBC' }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app/admin',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/hooks/ask/ask-api', () => ({
  fetchConversation: vi.fn(async () => null),
  fetchConversationList: vi.fn(async () => ({ conversations: [], hasMore: false })),
  recordTopicAnswer: vi.fn(),
  streamChat: async (_body: unknown, onEvent: (event: unknown) => void) => {
    onEvent({ type: 'answer', conversationId: 'c1', messageId: 'm1', answer: { line: 'Noted.', citations: [], actions: [], origin: 'generated', depth: 'normal' } });
  },
}));

describe('the chat list kept in the browser', () => {
  it('titles a chat with the identity number masked', async () => {
    let chat: AskContextValue | null = null;
    const Grab = () => {
      chat = useAskOptional();
      return null;
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AskProvider>
          <Grab />
        </AskProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(chat).not.toBeNull());
    await chat!.ask({ message: 'Update PAN ABCDE1234F for the director' });
    await waitFor(() => expect(window.localStorage.getItem('vcfo.ask.history.u1')).toContain('Update PAN'));
    expect(window.localStorage.getItem('vcfo.ask.history.u1')).not.toContain('ABCDE1234F');
  });
});
