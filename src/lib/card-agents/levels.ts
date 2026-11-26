import 'server-only';

import type { AssistSubAgent } from '@/lib/assist-agents/catalog';
import { packLive } from '@/lib/assist-agents/pack';
import { getPack, getRecipe } from '@/lib/assist-agents/registry';
import { profileSection } from './before-fill';
import { cardAgentLevel, toCardAgentInfo, type CardAgentInfo } from './card-agents';
import { browserConfigured, gstzenConfigured } from './config';
import { routeOpenFor, type AgentSettings } from './settings';

type Env = Record<string, string | undefined>;

/**
 * The card agents of a set of catalog tasks, each with its true level for this user now. The
 * level's live inputs are read here on the server: the task's portal pack switch (`packLive`),
 * the live browser and GSTZen routes (configured for this deployment AND open to this user in
 * Settings > Agents), and the kill switch.
 */
export function cardAgentInfosFor(tasks: readonly AssistSubAgent[], settings: AgentSettings, userId: string, env: Env = process.env): CardAgentInfo[] {
  const browserOpen = browserConfigured(env) && routeOpenFor(settings, 'browser', userId);
  const gstzenOpen = gstzenConfigured(env) && routeOpenFor(settings, 'gstzen', userId);
  return tasks.map((task) => {
    const pack = task.pack ? getPack(task.pack) : null;
    const level = cardAgentLevel(task, {
      packLive: pack ? packLive(pack, env) : false,
      browserOpen,
      gstzenOpen,
      killed: settings.killSwitch,
    });
    return toCardAgentInfo(task, level);
  });
}

/**
 * The Assist profile sections a task's recipe fills (`company`, `director`, ...), so "Before I
 * fill" lists only what that form needs. Empty for a task without a recipe.
 */
export function recipeSections(task: Pick<AssistSubAgent, 'recipeId'>): string[] {
  const recipe = task.recipeId ? getRecipe(task.recipeId) : null;
  if (!recipe) return [];
  return [...new Set(recipe.fields.map((f) => profileSection(f.key)))].filter(Boolean).sort();
}
