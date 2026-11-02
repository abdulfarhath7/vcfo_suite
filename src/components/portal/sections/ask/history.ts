/**
 * Past chats in the portal's Ask VCFO panel (owner item F4): pure helpers that turn an Ask VCFO
 * thread (the provider's `ThreadItem`s, as stored on the server) into the panel's own chat log,
 * and the date label of a past chat. No React, no fetch, so they are unit-tested.
 */
import type { AnswerEnvelope, Destination } from '@/data/ask/schema';
import type { ThreadItem } from '@/components/ask/ask-context';
import { fmt, fmtY, todayIso } from '../../dates';
import type { Intent } from '../../runtime';

export type Act = { label: string; intent?: Intent; stepId?: string };
export type LogItem =
  | { r: 'u'; t: string }
  | {
      r: 'a';
      t: string;
      k?: 'ok' | 'nan';
      h?: boolean;
      acts?: Act[];
      q?: string;
      mid?: string | null;
      fb?: 'up' | 'down';
      save?: { topicSlug?: string; answer?: AnswerEnvelope; messageId?: string };
      saved?: boolean;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An Ask VCFO go-there link → what the portal does with it. */
export function destToAct(label: string, dest: Destination): Act {
  switch (dest.to) {
    case 'step':
      return { label, stepId: dest.stepId };
    case 'incorporation':
      return dest.focusStepId ? { label, stepId: dest.focusStepId } : { label, intent: { kind: 'section', key: 'incorporation' } };
    case 'inbox':
      return { label, intent: { kind: 'notes' } };
    case 'compliances':
      return { label, intent: dest.itemId && UUID.test(dest.itemId) ? { kind: 'filing', id: dest.itemId } : { kind: 'section', key: 'calendar' } };
    case 'documents':
      return { label, intent: { kind: 'section', key: 'documents' } };
    case 'library':
      return { label, intent: dest.itemId ? { kind: 'reader', mode: 'saved', id: dest.itemId } : { kind: 'section', key: 'library' } };
    case 'learn':
      return { label, intent: { kind: 'reader', mode: 'learn', id: dest.slug } };
    default:
      return { label, intent: { kind: 'section', key: 'home' } };
  }
}

/**
 * One Ask VCFO answer as a chat-log line: the text, its go-there buttons, the hand-off offer on a
 * refusal, and "Save answer" when the answer allows it (never in the super admin's preview).
 */
export function answerToLog(a: AnswerEnvelope, messageId: string | null, q: string | undefined, preview: boolean): LogItem {
  const refusal = a.origin === 'refusal';
  const canSave = a.actions.includes('save') && !preview && Boolean(a.topicSlug || messageId);
  return {
    r: 'a',
    t: a.line + (a.why ? `\n${a.why}` : ''),
    k: refusal ? 'nan' : 'ok',
    h: refusal || a.actions.includes('askLead'),
    acts: (a.links ?? [])
      .map((l) => destToAct(l.label, l.dest))
      .concat(!a.links?.length && a.actions.includes('openStep') && a.target?.stepId ? [{ label: 'Open the step', stepId: a.target.stepId }] : []),
    mid: messageId,
    q,
    save: canSave ? (a.topicSlug ? { topicSlug: a.topicSlug, answer: a } : { messageId: messageId! }) : undefined,
  };
}

/**
 * A whole past conversation as the panel's chat log, in order. Each answer remembers the question
 * before it (for feedback); error lines are shown as plain text.
 */
export function threadToLog(thread: ThreadItem[], preview: boolean): LogItem[] {
  const out: LogItem[] = [];
  let lastQ: string | undefined;
  for (const item of thread) {
    if (item.kind === 'user') {
      lastQ = item.text;
      out.push({ r: 'u', t: item.text });
    } else if (item.kind === 'assistant') {
      out.push(answerToLog(item.answer, item.messageId, lastQ, preview));
    } else {
      out.push({ r: 'a', t: item.text, k: 'nan' });
    }
  }
  return out;
}

/** "16 Oct" this year, "16 Oct 2025" otherwise, from the chat's ISO time; '' when unreadable. */
export function chatDate(at: string, today: string = todayIso()): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const ymd = d.toISOString().slice(0, 10);
  return ymd.slice(0, 4) === today.slice(0, 4) ? fmt(ymd) : fmtY(ymd);
}
