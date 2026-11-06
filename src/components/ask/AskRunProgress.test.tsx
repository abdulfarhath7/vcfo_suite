import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AskRunProgress } from './AskRunProgress';

/** The run's stream in the chat: steps, the card, the last word, and closing when it ends. */

vi.mock('./AskChangesetCard', () => ({ AskChangesetCard: ({ changesetId }: { changesetId: string }) => <div data-testid="card">{changesetId}</div> }));

class FakeSource {
  static last: FakeSource;
  onmessage: ((event: { data: string }) => void) | null = null;
  listeners = new Map<string, () => void>();
  closed = false;
  constructor(readonly url: string) {
    FakeSource.last = this;
  }
  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, listener);
  }
  close() {
    this.closed = true;
  }
}

const view = (patch: object) => ({ id: 'r', status: 'running', line: null, steps: [], ...patch });
const push = (data: object) => act(() => FakeSource.last.onmessage!({ data: JSON.stringify(data) }));
const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AskRunProgress runId="r" shownLine="Working on this." />
    </QueryClientProvider>,
  );

beforeEach(() => vi.stubGlobal('EventSource', FakeSource));
afterEach(() => vi.unstubAllGlobals());

describe('AskRunProgress', () => {
  it('subscribes to the run and shows each step while it works', () => {
    mount();
    expect(FakeSource.last.url).toBe('/api/ask/runs/r');
    push(view({ steps: [{ id: '1', label: 'Reading the tasks', status: 'done', changesetId: null, undoable: false }] }));
    expect(screen.getByText('Reading the tasks')).toBeTruthy();
    expect(screen.getByText('Working…')).toBeTruthy();
  });

  it('shows the card when the run waits on a decision', () => {
    mount();
    push(view({ status: 'waiting_approval', steps: [{ id: '2', label: 'Add a note', status: 'waiting', changesetId: 'cs-1', undoable: false }] }));
    expect(screen.getByTestId('card').textContent).toBe('cs-1');
    expect(screen.getByText(/Waiting for a decision/)).toBeTruthy();
  });

  it('shows the last word once, offers Undo on a private step, and closes at the end', () => {
    mount();
    push(view({ status: 'done', line: 'I added the line.', steps: [{ id: '3', label: 'Adding to your own list', status: 'done', changesetId: null, undoable: true }] }));
    expect(screen.getByText('I added the line.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.queryByText('Working…')).toBeNull();
    act(() => FakeSource.last.listeners.get('end')!());
    expect(FakeSource.last.closed).toBe(true);
  });

  it('does not repeat a last word the answer already shows', () => {
    mount();
    push(view({ status: 'done', line: 'Working on this.' }));
    expect(screen.queryAllByText('Working on this.')).toHaveLength(0);
  });
});
