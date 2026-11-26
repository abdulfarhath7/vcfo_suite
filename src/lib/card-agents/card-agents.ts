import { OBLIGATION_ACTIVITY } from '@/data/compliance-activities';
import {
  agentNameOf,
  allSubAgents,
  taskRoute,
  type AssistAgentId,
  type AssistSubAgent,
  type AssistTaskRoute,
} from '@/lib/assist-agents/catalog';

/**
 * CARD AGENTS — which robot a card shows, what it is called and what it can do today
 * (docs/specs/live-portal-browser/CARD-AGENTS.md and MASTER-PLAN.md). Pure and client-safe: the
 * level's live inputs (pack switch, env, admin switches) are passed in by the server route.
 *
 * A card is a checklist step (`stepId`, for example `reg-4` or `pre-4`) or a compliance obligation
 * (`obligationId`, for example `gst-gstr-3b`). One card can carry several tasks (SPICe+ Part B and
 * its linked forms sit on `pre-10`); the panel lists them and the first leads.
 */

/** ready: fills live now · practice: fills the mock only · prepare: checks and gathers data · coming: not built. */
export type CardAgentLevel = 'ready' | 'practice' | 'prepare' | 'coming';

export const CARD_AGENT_LEVEL_LABEL: Record<CardAgentLevel, string> = {
  ready: 'Ready',
  practice: 'Practice',
  prepare: 'Prepares data',
  coming: 'Coming',
};

/** Where "Check data" reads from for a task, or null when the task has no data check yet. */
export type CardDataSource = 'mca-profile' | 'gst-profile' | 'gst-return';

export function dataSourceOf(task: Pick<AssistSubAgent, 'id' | 'portal' | 'recipeId' | 'kind'>): CardDataSource | null {
  if (task.kind === 'api-file' && task.portal === 'gst') return 'gst-return';
  if (task.id === 'gst-reg-01') return 'gst-profile';
  if (task.portal === 'mca' && task.recipeId) return 'mca-profile';
  return null;
}

/** The robot's colour: one data token per top-level agent. */
export const CARD_AGENT_COLOUR: Record<AssistAgentId, string> = {
  incorporation: 'oklch(var(--data-1))',
  'post-incorporation': 'oklch(var(--data-2))',
  registration: 'oklch(var(--data-3))',
  compliance: 'oklch(var(--data-4))',
};

export interface CardAgentLiveInputs {
  /** The task's portal pack is cleared and switched on (`packLive`). */
  packLive: boolean;
  /** The live browser service is configured for this deployment and the admin route is open to the user. */
  browserOpen: boolean;
  /** GSTZen is configured and the admin route is open to the user. */
  gstzenOpen: boolean;
  /** The kill switch is on. */
  killed: boolean;
}

export function cardAgentLevel(task: AssistSubAgent, live: CardAgentLiveInputs): CardAgentLevel {
  if (task.status === 'later' && !dataSourceOf(task)) return 'coming';
  if (live.killed) return dataSourceOf(task) ? 'prepare' : 'coming';
  const route = taskRoute(task);
  if (route === 'api') return live.gstzenOpen ? 'ready' : 'prepare';
  if (route === 'browser' && task.recipeId) {
    if (live.browserOpen && live.packLive) return 'ready';
    return live.browserOpen ? 'practice' : 'prepare';
  }
  return dataSourceOf(task) ? 'prepare' : 'coming';
}

export interface CardAgentInfo {
  taskId: string;
  name: string;
  title: string;
  form: string;
  agent: AssistAgentId;
  route: AssistTaskRoute;
  kind: AssistSubAgent['kind'];
  gates: AssistSubAgent['gates'];
  note: string | null;
  recipeId: string | null;
  pack: string | null;
  portalHost: string | null;
  dataSource: CardDataSource | null;
  colour: string;
  level: CardAgentLevel;
  levelLabel: string;
}

export function toCardAgentInfo(task: AssistSubAgent, level: CardAgentLevel): CardAgentInfo {
  return {
    taskId: task.id,
    name: agentNameOf(task),
    title: task.title,
    form: task.form,
    agent: task.agent,
    route: taskRoute(task),
    kind: task.kind,
    gates: task.gates,
    note: task.note ?? null,
    recipeId: task.recipeId,
    pack: task.pack,
    portalHost: task.portalHost,
    dataSource: dataSourceOf(task),
    colour: CARD_AGENT_COLOUR[task.agent],
    level,
    levelLabel: CARD_AGENT_LEVEL_LABEL[level],
  };
}

export interface CardKey {
  stepId?: string | null;
  obligationId?: string | null;
}

/** The catalog tasks a card carries, in catalog order. */
export function cardTasksFor(card: CardKey): AssistSubAgent[] {
  const all = allSubAgents();
  if (card.stepId) return all.filter((t) => t.stepId === card.stepId);
  if (card.obligationId) {
    const activity = OBLIGATION_ACTIVITY[card.obligationId];
    return all.filter((t) => t.obligationIds?.includes(card.obligationId as string) || (!t.obligationIds && activity && t.activityId === activity));
  }
  return [];
}
