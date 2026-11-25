import type { AnswerEnvelope } from '@/data/ask/schema';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { dropSummaryLine } from './summary';
import { emptyDropState, fetchSourceWords, type DropState } from './types';

/**
 * "Show me the progress" while a drop (an upload or a SharePoint fetch) works in the background. The
 * chat answers it from the run row itself, with no model, so it can never claim that nothing was
 * fetched while the job is reading files. The same facts go into the model's context as one line,
 * so a free answer in that conversation stays honest too. Identity numbers are masked throughout.
 */

/** What the chat needs of a drop run: its status and its stored (masked) state. */
export interface DropRunFacts {
  status: string;
  state: unknown;
}

const LINE_MAX = 1200;

/** Words that ask how a piece of work is going. */
const PROGRESS_WORDS =
  /\b(?:progress|status|update|updates|done|finished|finish|ready|complete|completed|eta|still (?:working|running|going|fetching|reading)|how (?:far|long|much longer|is it going)|what happened|any news|where (?:is|are)|where's)\b/i;

/** Words that point at the drop rather than at some other piece of work. */
const DROP_REFERENCE = /\b(?:it|that|this|fetch|fetching|pull|pulling|sharepoint|folder|files?|card|cards|drop|upload|uploads|import|run|job|documents?)\b/i;

/** A bare "status?" or "show me the progress" needs no reference; a longer question must point at the drop. */
const BARE_MAX_WORDS = 4;
const QUESTION_MAX_WORDS = 14;

/**
 * True for a short question about the drop's progress: "show me the progress", "is it done", "where
 * is the card", "what happened to the fetch". The pipeline only asks this when the conversation has a
 * recent drop, so "is the GST return done for Acme?" still reaches the normal answer path.
 */
export function isDropProgressQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const words = text.split(/\s+/).length;
  if (words > QUESTION_MAX_WORDS || !PROGRESS_WORDS.test(text)) return false;
  return words <= BARE_MAX_WORDS || DROP_REFERENCE.test(text);
}

function stateOf(run: DropRunFacts): DropState {
  const raw = (run.state && typeof run.state === 'object' ? run.state : {}) as Partial<DropState>;
  return { ...emptyDropState(), ...raw };
}

/** "the SharePoint folder Bonterra India" or "your 12 files", for the sentences below. */
function subjectOf(state: DropState): string {
  if (state.source?.kind === 'sharepoint') return fetchSourceWords(state.source);
  const count = state.files.length;
  return count > 0 ? `your ${count} file${count === 1 ? '' : 's'}` : 'your files';
}

/** "Reading, 23 of 50 files" from the stored progress, without the label's trailing dots. */
function progressText(state: DropState): string {
  const label = state.progress.label.replace(/[.…\s]+$/u, '').trim() || 'Working';
  const { done, total } = state.progress;
  return total > 0 ? `${label}, ${Math.min(done, total)} of ${total} files` : label;
}

function truncate(text: string): string {
  return text.length <= LINE_MAX ? text : `${text.slice(0, LINE_MAX - 1).trimEnd()}…`;
}

/** The sentence the chat gives for the drop's current state. */
export function dropProgressLine(run: DropRunFacts, opts: { role?: string } = {}): string {
  const state = stateOf(run);
  const subject = subjectOf(state);
  let text: string;
  switch (run.status) {
    case 'queued':
      text = `I have not started on ${subject} yet. The progress shows here once I do; nothing is saved until you accept the card.`;
      break;
    case 'running':
      text = `I am still working on ${subject}: ${progressText(state)}. The card appears in this chat when I finish; nothing is saved until you accept it.`;
      break;
    case 'waiting_approval':
    case 'done':
      text = `It finished. ${dropSummaryLine(state, opts)}${state.groups.length > 0 ? ' The card is in the chat above.' : ''}`;
      break;
    case 'waiting_reply':
      text = `I finished reading ${subject} and need your answer on some files. ${dropSummaryLine(state, opts)}`;
      break;
    case 'over_budget':
      text = `I stopped early on ${subject}. ${dropSummaryLine(state, opts)}`;
      break;
    case 'failed':
      text = `The work on ${subject} stopped with an error, so nothing was saved. Please try again.`;
      break;
    default:
      text = `The work on ${subject} is ${run.status.replace(/_/g, ' ')}.`;
  }
  return truncate(maskIdentityNumbers(text));
}

/** The deterministic answer to a progress question. */
export function dropProgressAnswer(run: DropRunFacts, opts: { role?: string } = {}): AnswerEnvelope {
  return { line: dropProgressLine(run, opts), citations: [], actions: [], origin: 'work', depth: 'normal' };
}

/**
 * One line for the model's context, so a free answer in this conversation knows the drop exists and
 * never says that nothing was fetched or that the chat cannot read SharePoint.
 */
export function dropContextLine(run: DropRunFacts): string {
  const state = stateOf(run);
  const source = state.source?.kind === 'sharepoint' ? `a fetch of ${fetchSourceWords(state.source)}` : 'a drop of files';
  const where = run.status === 'running' || run.status === 'queued' ? `is ${run.status} (${progressText(state)})` : `ended as ${run.status.replace(/_/g, ' ')}`;
  const cards = state.groups.length > 0 ? `, with review cards for ${state.groups.map((g) => g.companyName).join(', ')}` : '';
  return maskIdentityNumbers(
    `In this conversation, ${source} ${where}${cards}. This chat can fetch SharePoint folders and read dropped files in the background. Never say nothing was fetched or that you cannot read SharePoint; for its progress, give the facts above.`,
  );
}
