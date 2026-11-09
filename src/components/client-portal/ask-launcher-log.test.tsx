import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

/**
 * The chat log lives in the browser's session storage, where it outlives the chat on a shared office
 * machine. A question typed with an identity number in it is kept there only masked.
 */
const PAN = 'ABCDE1234F';
const QUESTION = `Is my PAN ${PAN} on the form?`;

let ask: Record<string, unknown> | null = null;
let pending: { n: number; q: string } | null = null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/AppContext', () => ({ useApp: () => ({ user: { id: 'client-1' } }) }));
vi.mock('@/components/ask/ask-context', () => ({ useAskOptional: () => ask }));
vi.mock('@/components/ask/use-avatar-yield', () => ({ useAvatarYield: () => ({ yieldOn: false, lift: 0 }) }));
vi.mock('./PortalProvider', () => ({
  usePortal: () => ({ chatOpen: true, openChat: vi.fn(), closeChat: vi.fn(), pendingQuestion: pending, after: false, shell: null, toast: vi.fn(), prefs: null, savePrefs: vi.fn() }),
}));

const { AskLauncher } = await import('./AskLauncher');

const stored = () => sessionStorage.getItem('vcfo.chat') ?? '';

beforeEach(() => {
  sessionStorage.clear();
  ask = null;
  pending = { n: 1, q: QUESTION };
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('the client chat log in the browser', () => {
  it('keeps an overview answer\'s question masked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ answer: { text: 'Yes, it is.', kind: 'ok' } }))));
    render(<AskLauncher />);
    await waitFor(() => expect(stored()).toContain('Yes, it is.'), { timeout: 3000 });
    expect(stored()).not.toContain(PAN);
    expect(stored()).toContain('XXXXXX234F');
  });

  it('keeps an Ask VCFO answer\'s question masked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ answer: null }))));
    const thread: unknown[] = [];
    ask = { enabled: true, engagementId: 'eng-1', preview: false, busy: false, thread, ask: vi.fn(async () => undefined) };
    const view = render(<AskLauncher />);
    await waitFor(() => expect((ask!.ask as ReturnType<typeof vi.fn>)).toHaveBeenCalled());
    ask = { ...ask, thread: [{ id: 'u1', kind: 'user', text: QUESTION }, { kind: 'assistant', messageId: 'm1', answer: { line: 'It is on the form.', origin: 'generated' } }] };
    view.rerender(<AskLauncher />);
    await waitFor(() => expect(stored()).toContain('It is on the form.'));
    expect(stored()).not.toContain(PAN);
  });
});
