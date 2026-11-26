import { allSubAgents, type assistPackStatus } from '@/lib/assist-agents/catalog';
import { listRecipes } from '@/lib/assist-agents/registry';
import type { AgentRouteSetting, AgentSettingKey, AgentSettings } from './settings';

/**
 * Settings > Agents (MASTER-PLAN.md screen 10): the shape `GET /api/agent-settings` returns and
 * the pure helpers the page and the route share. The switches themselves are in `settings.ts`.
 */

export type AgentPackStatus = ReturnType<typeof assistPackStatus>[number];

export interface AgentStaffOption {
  id: string;
  name: string;
  role: string;
}

export interface AgentRecipeFacts {
  /** Recipes in the registry. */
  recipes: number;
  /** Catalog tasks with a recipe, by status (`beta` = checked against a capture or the mock). */
  beta: number;
  ready: number;
  /** Tasks whose pack the server lets run live now. */
  live: number;
}

export interface AgentSettingsResponse {
  ok: true;
  settings: AgentSettings;
  /** Deploy-time configuration: false means "Not configured on this deployment". */
  deployment: { gstzen: boolean; browser: boolean };
  packs: AgentPackStatus[];
  /** True for a firm-wide admin on a login that is not a demo login. */
  canEdit: boolean;
  /** Only for firm-wide admins. */
  admin: {
    staff: AgentStaffOption[];
    month: string;
    browserHoursUsed: number;
    browserSessions: number;
    recipes: AgentRecipeFacts;
    patchesWaiting: number;
  } | null;
}

export function recipeFacts(packs: ReadonlyArray<Pick<AgentPackStatus, 'id' | 'live'>>): AgentRecipeFacts {
  const livePacks = new Set(packs.filter((p) => p.live).map((p) => p.id));
  const withRecipe = allSubAgents().filter((t) => t.recipeId);
  return {
    recipes: listRecipes().length,
    beta: withRecipe.filter((t) => t.status === 'beta').length,
    ready: withRecipe.filter((t) => t.status === 'ready').length,
    live: withRecipe.filter((t) => t.pack && livePacks.has(t.pack)).length,
  };
}

/** A route setting with its pilot list kept to the given staff ids (unknown ids are dropped). */
export function keepKnownPilots(value: AgentRouteSetting, staffIds: ReadonlySet<string>): AgentRouteSetting {
  return { live: value.live, pilotUserIds: [...new Set(value.pilotUserIds.filter((id) => staffIds.has(id)))] };
}

/** The pilot list as the page words it: "All staff" when empty, else the names. */
export function pilotSummary(value: AgentRouteSetting, staff: ReadonlyArray<AgentStaffOption>): string {
  if (value.pilotUserIds.length === 0) return 'All staff';
  const byId = new Map(staff.map((s) => [s.id, s.name]));
  return value.pilotUserIds.map((id) => byId.get(id) ?? 'Unknown').join(', ');
}

/** The words for one setting's value in the confirm row ("On", "Off", "100 h", "15 min"). */
export function settingValueText(key: AgentSettingKey, value: unknown, staff: ReadonlyArray<AgentStaffOption> = []): string {
  if (key === 'gstzen' || key === 'browser') {
    const v = value as AgentRouteSetting;
    return `${v.live ? 'On' : 'Off'} · ${pilotSummary(v, staff)}`;
  }
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (key === 'browserHoursCap') return `${value} h`;
  return `${value} min`;
}
