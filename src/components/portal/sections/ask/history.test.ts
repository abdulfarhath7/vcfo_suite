import { describe, expect, it } from 'vitest';
import type { AnswerEnvelope } from '@/data/ask/schema';
import type { ThreadItem } from '@/components/ask/ask-context';
import { answerToLog, chatDate, destToAct, threadToLog } from './history';

const base: AnswerEnvelope = {
  line: 'Your next step is the director KYC.',
  citations: [],
  actions: ['save', 'openStep'],
  origin: 'deterministic',
  depth: 'normal',
  target: { stepId: 'pre-15' },
};

describe('threadToLog (past chats in the portal panel)', () => {
  it('turns a stored conversation into the panel log, in order, with each answer remembering its question', () => {
    const thread: ThreadItem[] = [
      { id: 't1', kind: 'user', text: 'What is my next step?' },
      { id: 't2', kind: 'assistant', messageId: 'm2', answer: base },
      { id: 't3', kind: 'user', text: 'And after that?' },
      { id: 't4', kind: 'error', text: 'Ask VCFO is unavailable right now.' },
    ];
    const log = threadToLog(thread, false);
    expect(log).toHaveLength(4);
    expect(log[0]).toEqual({ r: 'u', t: 'What is my next step?' });
    expect(log[1]).toMatchObject({ r: 'a', t: base.line, k: 'ok', h: false, q: 'What is my next step?', mid: 'm2' });
    expect(log[2]).toEqual({ r: 'u', t: 'And after that?' });
    expect(log[3]).toMatchObject({ r: 'a', t: 'Ask VCFO is unavailable right now.', k: 'nan' });
  });

  it('offers "Open the step" from the target when the answer has no links', () => {
    const [item] = threadToLog([{ id: 't', kind: 'assistant', messageId: 'm', answer: base }], false);
    expect(item).toMatchObject({ r: 'a', acts: [{ label: 'Open the step', stepId: 'pre-15' }] });
  });

  it('maps go-there links and keeps "Save answer" by message id, but never in a preview', () => {
    const a: AnswerEnvelope = { ...base, links: [{ dest: { to: 'documents' }, label: 'Open Documents' }] };
    const saved = answerToLog(a, 'm9', 'q', false);
    expect(saved).toMatchObject({ acts: [{ label: 'Open Documents', intent: { kind: 'section', key: 'documents' } }], save: { messageId: 'm9' } });
    expect(answerToLog(a, 'm9', 'q', true).save).toBeUndefined();
    expect(answerToLog({ ...a, topicSlug: 'gst-basics' }, null, 'q', false).save).toEqual({ topicSlug: 'gst-basics', answer: { ...a, topicSlug: 'gst-basics' } });
  });

  it('a refusal reads as "cannot answer" with the hand-off offer and the why line', () => {
    const r = answerToLog({ ...base, origin: 'refusal', actions: ['askLead'], why: 'That needs your lead.' }, null, undefined, false);
    expect(r).toMatchObject({ k: 'nan', h: true, t: 'Your next step is the director KYC.\nThat needs your lead.' });
  });
});

describe('destToAct', () => {
  it('a compliance link opens the filing only with a real id, else the calendar', () => {
    expect(destToAct('Open', { to: 'compliances', itemId: '2b1f4b6e-3f2a-4c1d-9e8f-123456789abc' })).toEqual({ label: 'Open', intent: { kind: 'filing', id: '2b1f4b6e-3f2a-4c1d-9e8f-123456789abc' } });
    expect(destToAct('Open', { to: 'compliances', itemId: 'gstr-3b' })).toEqual({ label: 'Open', intent: { kind: 'section', key: 'calendar' } });
  });
});

describe('chatDate', () => {
  it('shows the day and month this year, and the year otherwise', () => {
    expect(chatDate('2026-10-30T10:00:00Z', '2026-11-02')).toBe('30 Oct');
    expect(chatDate('2025-10-30T10:00:00Z', '2026-11-02')).toBe('30 Oct 2025');
    expect(chatDate('not a date')).toBe('');
  });
});
