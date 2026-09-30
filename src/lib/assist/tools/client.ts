import { getActiveCatalogItems, getItem } from '@/data/checklist';
import type { ProjectSnapshot } from '@/data/assist/schema';
import { gateActiveCatalog, getStepGate } from '@/lib/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { filingStatus } from '@/lib/filings';
import { topicsForStep } from '@/lib/assist/topics';
import { numberArg, type AssistTool } from './types';

/**
 * CLIENT TOOLS — read-only, scoped to the one engagement the snapshot was
 * loaded for (already access-checked, client-redacted state). None of them
 * reads board resolutions, identity numbers, addresses or people.
 */
export interface ClientToolContext {
  snapshot: ProjectSnapshot;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  filings: ReadonlyArray<{ particular: string; dueDate: string; filedOn: string | null }>;
  now: Date;
}

export function stepExplainerContext(ctx: ClientToolContext, stepId: string) {
  const item = getActiveCatalogItems().find((i) => i.id === stepId);
  if (!item) return { error: 'unknown_step' as const, stepId };
  const gate = getStepGate(gateActiveCatalog(ctx.state, 'client'), item.id);
  const topic = topicsForStep(item.id)[0];
  return {
    stepId: item.id,
    title: item.title,
    owner: item.responsibleRole === 'client' ? 'client' : 'lead',
    status: gate.kind,
    locked: gate.kind === 'locked',
    unlocks: gate.kind === 'locked' ? (gate.message ?? null) : null,
    description: item.description ?? null,
    forms: item.forms,
    topicSlug: topic?.slug ?? null,
  };
}

export function upcomingCompliances(ctx: ClientToolContext, days: number) {
  const today = ctx.now.toISOString().slice(0, 10);
  const horizon = new Date(ctx.now);
  horizon.setDate(horizon.getDate() + days);
  const end = horizon.toISOString().slice(0, 10);
  return ctx.filings
    .filter((f) => f.dueDate <= end && (f.dueDate >= today || !f.filedOn))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 20)
    .map((f) => ({ name: f.particular, dueDate: f.dueDate, status: filingStatus(f, ctx.now) }));
}

export const CLIENT_TOOLS: Record<string, AssistTool<ClientToolContext>> = {
  getProjectSnapshot: {
    definition: {
      name: 'getProjectSnapshot',
      description: "The client's own project: company, legal form, phase, current step and progress.",
      strict: true,
      input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
    run: async (ctx) => ctx.snapshot,
  },
  getStepExplainerContext: {
    definition: {
      name: 'getStepExplainerContext',
      description:
        'One checklist step of this project: title, who owns it, its status, whether it is locked and what unlocks it.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { stepId: { type: 'string', description: 'Checklist step id, e.g. pre-14' } },
        required: ['stepId'],
        additionalProperties: false,
      },
    },
    run: async (ctx, input) => stepExplainerContext(ctx, String(input.stepId ?? '')),
  },
  getUpcomingCompliances: {
    definition: {
      name: 'getUpcomingCompliances',
      description: "This company's compliance calendar: filings due in the next N days (max 90) and any overdue.",
      strict: true,
      input_schema: {
        type: 'object',
        properties: { days: { type: 'integer', description: 'Look-ahead in days, 1 to 90' } },
        required: ['days'],
        additionalProperties: false,
      },
    },
    run: async (ctx, input) => upcomingCompliances(ctx, numberArg(input, 'days', 30, 90)),
  },
};

/** Step title lookup for the "next step" deterministic answer. */
export function stepTitle(stepId: string): string | null {
  return getItem(stepId)?.title ?? null;
}
