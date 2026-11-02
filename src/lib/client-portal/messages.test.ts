import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_MAX, messageToSend, threadOrder, type ClientMessage } from './messages';

const m = (id: string, createdAt: string): ClientMessage => ({
  id,
  engagementId: 'e',
  companyName: 'Northwind',
  senderSide: 'client',
  senderName: 'Asha',
  body: id,
  itemKey: null,
  readAt: null,
  triage: 'new',
  createdAt,
});

describe('client messages', () => {
  it('sends trimmed text and nothing for blanks', () => {
    expect(messageToSend('  hello \r\n')).toBe('hello');
    expect(messageToSend('   ')).toBeNull();
    expect(messageToSend('x'.repeat(CLIENT_MESSAGE_MAX + 10))!.length).toBe(CLIENT_MESSAGE_MAX);
  });

  it('orders the thread oldest first without repeats', () => {
    const out = threadOrder([m('b', '2026-10-02T00:00:00Z'), m('a', '2026-10-01T00:00:00Z'), m('b', '2026-10-02T00:00:00Z')]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
