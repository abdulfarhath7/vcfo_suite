import 'server-only';

import { z } from 'zod';
import type { AuthContext } from '@/auth/guards';
import { getAgentSettings } from '@/db/repositories/agent-settings';
import {
  createLiveSession,
  systemApplySessionEvent,
  systemBrowserMinutesThisMonth,
  systemEndSession,
  systemOpenSessionForLogin,
  toLiveSessionView,
} from '@/db/repositories/live-browser-sessions';
import { assistProfileFor } from '@/lib/api/assist-profile';
import { assistCatalogBody } from '@/lib/assist-agents/catalog-body';
import { assistHostAllowed, findSubAgent, taskRoute } from '@/lib/assist-agents/catalog';
import { packLive } from '@/lib/assist-agents/pack';
import { getPack, getRecipe } from '@/lib/assist-agents/registry';
import { signRecipe } from '@/lib/assist-agents/signing';
import { browserConfigured } from '@/lib/card-agents/config';
import { routeOpenFor } from '@/lib/card-agents/settings';
import type { Recipe } from '@/lib/assist-agents/recipe';
import type { PortalPack } from '@/lib/assist-agents/pack';
import { brokerPost, BrokerUnavailable, liveBrowserEnv } from './broker-client';
import type { SessionStartBody } from './contract';

/**
 * START A LIVE SESSION (docs/specs/live-portal-browser/PLAN.md "How one run works", CARD-AGENTS.md
 * "one-click start"). The user's "Fill now" on "Before I fill" calls this. Every check runs here,
 * before any browser starts, in this order:
 *
 *   kill switch → deploy configured → route open for this user (admin switch and pilot list) →
 *   a browser task with a recipe → the portal host allowed (G11: the mock always; a live host
 *   only for a live pack) → one open session per portal login (G21) → the monthly hours cap →
 *   the engagement in the caller's scope (through the profile and the session repositories).
 *
 * Then Suite builds what the engine needs on its own side (the catalog with the kill switch, the
 * recipe signed with Suite's key, the profile) and sends it with the start. The broker never
 * calls a Suite API with a user's cookie, and it holds the profile in memory only.
 */

export const startLiveSessionSchema = z
  .object({
    engagementId: z.string().trim().min(1).max(80),
    taskId: z.string().trim().min(1).max(40),
    /** G14: "Which portal login are you using?" (a user id or email label, never a password). */
    portalLoginLabel: z.string().trim().min(1).max(120),
    /** G13: the fields approved with "Fill now"; omitted means every field "Before I fill" showed as ready. */
    approvedKeys: z.array(z.string().min(1).max(160)).max(500).optional(),
    /** "I will type it on the portal": the agent leaves these fields and marks them (G16). */
    typeOnPortal: z.array(z.string().min(1).max(160)).max(500).optional(),
    /** `mock` runs a live-cleared task against the mock portal for practice. */
    mode: z.enum(['live', 'mock']).optional(),
  })
  .strict();

export type StartLiveSessionInput = z.infer<typeof startLiveSessionSchema>;

export type StartResult = { status: number; body: Record<string, unknown> };

/** The first page of the recipe: the live portal page for a live pack, else the mock page. */
export function startUrlFor(recipe: Pick<Recipe, 'pages'>, pack: Pick<PortalPack, 'id' | 'legalStatus' | 'hosts'> | null, mode: 'live' | 'mock' | undefined, env: Record<string, string | undefined> = process.env): string | null {
  const page = recipe.pages[0];
  if (!page) return null;
  const live = pack && packLive(pack, env) && mode !== 'mock';
  if (live) {
    const host = pack.hosts.find((h) => !h.startsWith('*.'));
    return host && page.urlPattern && !page.urlPattern.includes('*') ? `https://${host}${page.urlPattern}` : null;
  }
  if (!page.mockUrlPattern) return null;
  return `${liveBrowserEnv(env).mockOrigin}${page.mockUrlPattern.replace(/\*/g, '')}`;
}

const fail = (status: number, error: string, extra: Record<string, unknown> = {}): StartResult => ({ status, body: { ok: false, error, ...extra } });

export async function startLiveSession(ctx: AuthContext, input: StartLiveSessionInput): Promise<StartResult> {
  const settings = await getAgentSettings(ctx);
  if (settings.killSwitch) return fail(423, 'kill_switch');
  if (!browserConfigured()) return fail(503, 'browser_not_configured');
  if (!routeOpenFor(settings, 'browser', ctx.userId)) return fail(403, 'route_closed');

  const task = findSubAgent(input.taskId);
  if (!task || taskRoute(task) !== 'browser' || !task.recipeId) return fail(400, 'no_recipe');
  const recipe = getRecipe(task.recipeId);
  if (!recipe) return fail(400, 'no_recipe');
  const pack = getPack(task.pack ?? recipe.pack ?? '') ?? null;
  const startUrl = startUrlFor(recipe, pack, input.mode);
  if (!startUrl) return fail(400, 'no_start_page');
  const host = new URL(startUrl).hostname;
  if (!assistHostAllowed(host, process.env, pack?.id ?? null)) return fail(403, 'live_portals_disabled');

  if (settings.onePerLogin && (await systemOpenSessionForLogin(input.portalLoginLabel))) return fail(409, 'login_in_use');
  const minutes = await systemBrowserMinutesThisMonth();
  if (minutes >= settings.browserHoursCap * 60) return fail(429, 'hours_cap', { hoursUsed: Math.round(minutes / 6) / 10 });

  const profile = await assistProfileFor(ctx, input.engagementId);
  if (profile.ok === false) return fail(profile.status, profile.error);
  const created = await createLiveSession(ctx, input.engagementId, { taskId: task.id, portalHost: host, portalLoginLabel: input.portalLoginLabel });
  if (!created) return fail(404, 'not_found');
  const { row, companyName } = created;

  const { schemaVersion, companyName: profileCompany, profile: values, missing, notes } = profile.result;
  const body: SessionStartBody = {
    sessionId: row.id,
    demo: Boolean(ctx.demo),
    userId: ctx.userId,
    engagementId: row.engagementId,
    engagementName: companyName,
    agentId: task.agent,
    taskId: task.id,
    recipeId: recipe.id,
    startUrl,
    portalLoginLabel: input.portalLoginLabel,
    catalog: await assistCatalogBody(ctx),
    signedRecipe: { ok: true, ...signRecipe(recipe) },
    profile: { ok: true, schemaVersion, companyName: profileCompany, profile: values, missing, notes },
    ...(input.approvedKeys ? { approvedKeys: input.approvedKeys } : {}),
    ...(input.typeOnPortal?.length ? { typeOnPortal: input.typeOnPortal } : {}),
    limits: { idleMinutes: settings.idleMinutes, maxMinutes: settings.maxMinutes },
  };

  let reply: { status: number; json: Record<string, unknown> };
  try {
    reply = await brokerPost('/sessions', body);
  } catch (error) {
    const reason = error instanceof BrokerUnavailable ? error.message : String(error);
    console.error('[live-browser] broker unreachable', reason);
    await systemEndSession(row.id, 'error', 'The live browser did not answer.');
    return fail(503, 'browser_unavailable');
  }
  if (reply.status !== 201 || reply.json.ok !== true) {
    const error = typeof reply.json.error === 'string' ? reply.json.error : `broker_${reply.status}`;
    await systemEndSession(row.id, 'error', error === 'pool_full' ? 'Every live browser is busy.' : 'The live browser could not start.');
    return fail(error === 'pool_full' ? 503 : 502, error === 'pool_full' ? 'pool_full' : 'browser_start_failed');
  }
  const saved = await systemApplySessionEvent(row.id, {
    node: typeof reply.json.node === 'string' ? reply.json.node : undefined,
    egressIp: typeof reply.json.egressIp === 'string' ? reply.json.egressIp : null,
  });
  return { status: 201, body: { ok: true, session: toLiveSessionView(saved ?? row, companyName) } };
}
