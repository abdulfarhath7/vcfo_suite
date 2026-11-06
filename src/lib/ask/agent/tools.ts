import 'server-only';

import { z } from 'zod';
import type { AppRole } from '@/auth/guards';
import type { AskShell } from '@/data/ask/schema';
import { actionsForRole } from '@/lib/actions/registry';
import { agentMayExecute, type AnyAction } from '@/lib/actions/types';
import { askFlags } from '@/lib/ask/config';
import type { LlmRequestTool, LlmTool } from '@/lib/ask/provider';

/**
 * What a model may be shown. The filter runs in code before any request: an action this role cannot
 * use, a T4 action or a switched-off tier is not in the tool list, so it cannot be asked for by
 * anything a document says. Common tools are loaded; the rest are found through tool search.
 */
const TOOL_SEARCH = { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' } as const;

/** The JSON schema words strict tools accept. Length and pattern rules run again in zod at execution. */
const STRICT_WORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'anyOf', 'description']);

function strictNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictNode);
  if (node === null || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([word]) => STRICT_WORDS.has(word))
      .map(([word, value]) => [word, word === 'properties' ? Object.fromEntries(Object.entries(value as object).map(([name, inner]) => [name, strictNode(inner)])) : strictNode(value)]),
  );
}

/** Tool names cannot hold a dot, so `tasks.create` travels as `tasks__create`. */
export const toolNameOf = (actionName: string): string => actionName.replace('.', '__');
export const actionNameOf = (toolName: string): string => toolName.replace('__', '.');

export function toolOf(action: AnyAction, strict = true): LlmTool {
  return {
    name: toolNameOf(action.name),
    description: action.description,
    ...(strict ? { strict: true } : {}),
    input_schema: strictNode(z.toJSONSchema(action.input)) as LlmTool['input_schema'],
    ...(action.examples?.length ? { input_examples: [...action.examples] as Array<Record<string, unknown>> } : {}),
  };
}

export async function actionsFor(role: AppRole, shell: AskShell): Promise<AnyAction[]> {
  const killed = askFlags().killedTiers;
  return (await actionsForRole(role)).filter(
    (action) => !action.routerOnly && agentMayExecute(action.tier) && !killed.has(action.tier) && action.name.startsWith('client-portal.') === (shell === 'client'),
  );
}

/**
 * The API takes at most 20 strict tools in one request, counting deferred ones, so only the loaded
 * tools are strict. Every input is parsed with zod again at execution, whichever tool it came from.
 */
export function agentTools(actions: readonly AnyAction[]): LlmRequestTool[] {
  return [TOOL_SEARCH, ...actions.map((action) => (action.common ? toolOf(action) : { ...toolOf(action, false), defer_loading: true }))];
}
