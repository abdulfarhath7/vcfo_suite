import 'server-only';

import type { AnyAction } from '@/lib/actions/types';
import { actionNameOf, toolOf } from '@/lib/ask/agent/tools';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import type { LlmProvider, LlmTool, LlmUsage } from '@/lib/ask/provider';

/**
 * The cheap first look at work the router sent here: one small-model call with only the actions a
 * single message can fill. A request that needs a record looked up first, or several steps, says so
 * and goes to the agent run. Nothing here writes; the choice still goes through a person's card.
 */
export type WorkPick = { kind: 'action'; action: string; input: Record<string, unknown> } | { kind: 'data' } | { kind: 'agent'; firmWide?: boolean } | { kind: 'none' };

const noInput: LlmTool['input_schema'] = { type: 'object', properties: {}, additionalProperties: false };
const FILL_DETAILS: LlmTool = {
  name: 'fill_details',
  description: 'The message gives values for a project\'s checklist fields: a name, a number, an address, a date, a capital amount, a director\'s details.',
  strict: true,
  input_schema: noInput,
};
const OPEN_ENDED: LlmTool = {
  name: 'open_ended',
  description: 'Anything else the app can do on one project: it names an existing task, document request, filing, document, note, board meeting, resolution or labour register, needs records looked up first, or takes more than one step.',
  strict: true,
  input_schema: noInput,
};
const RECEIVABLES: LlmTool = {
  name: 'receivables_work',
  description: 'Anything else about the firm\'s receivables, which sit on no project: invoices and what is overdue, receipts, payment reminders, disputes, TDS, credit notes, bank credits, statements, partner replies, the summary.',
  strict: true,
  input_schema: noInput,
};

const SYSTEM = [
  'You sort a request in a compliance firm\'s app. Call exactly one tool, or answer in one plain sentence when no tool fits.',
  'No tool fits filing or submitting on a government portal, signing, payments, changing anyone\'s role, or making a decision for the firm.',
  'Today is given in the message. A date without a year is the next one to come.',
].join(' ');
const HANDOFF_LINE = ' Preparing a filing run in VCFO Assist only sets up the form for a person to finish, so it is open_ended.';

export async function pickWork(
  provider: LlmProvider,
  model: string,
  input: { message: string; onScreen: string | null; simple: readonly AnyAction[]; receivables: boolean; handoff: boolean; now: Date },
): Promise<{ pick: WorkPick; usage: LlmUsage }> {
  const tools = [...input.simple.map((action) => toolOf(action)), FILL_DETAILS, OPEN_ENDED, ...(input.receivables ? [RECEIVABLES] : [])];
  const text = [`Today: ${input.now.toISOString().slice(0, 10)}`, input.onScreen, `Request: ${maskIdentityNumbers(input.message)}`].filter(Boolean).join('\n');
  const result = await provider.complete({
    model,
    system: [{ type: 'text', text: input.handoff ? `${SYSTEM}${HANDOFF_LINE}` : SYSTEM }],
    messages: [{ role: 'user', content: text }],
    tools,
    maxTokens: 800,
    effort: 'low',
  });
  const use = result.content.find((block) => block.type === 'tool_use');
  if (!use || use.type !== 'tool_use') return { pick: { kind: 'none' }, usage: result.usage };
  if (use.name === FILL_DETAILS.name) return { pick: { kind: 'data' }, usage: result.usage };
  if (use.name === OPEN_ENDED.name) return { pick: { kind: 'agent' }, usage: result.usage };
  if (use.name === RECEIVABLES.name) return { pick: { kind: 'agent', firmWide: true }, usage: result.usage };
  return { pick: { kind: 'action', action: actionNameOf(use.name), input: use.input as Record<string, unknown> }, usage: result.usage };
}
