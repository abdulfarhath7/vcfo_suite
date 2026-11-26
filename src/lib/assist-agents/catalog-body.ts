import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getFirmSettings } from '@/db/repositories/firm-settings';
import {
  ASSIST_AGENTS,
  ASSIST_CATALOG_TREE,
  assistExtensionDisabled,
  assistFirmContactsFromEnv,
  assistLiveHosts,
  assistLivePortalsEnabled,
  assistMinExtensionVersion,
  assistMockHosts,
  assistPackStatus,
  splitContacts,
  type AssistCatalogNode,
} from './catalog';
import { getRecipe } from './registry';

const withVersion = <T extends { recipeId: string | null }>(sub: T) => ({ ...sub, recipeVersion: sub.recipeId ? (getRecipe(sub.recipeId)?.version ?? null) : null });

/** API-route tasks (GST returns through the GSP) are not browser work, so the extension never lists them. */
const forExtension = (node: AssistCatalogNode): boolean => node.type !== 'task' || node.kind !== 'api-file';

function treeWithVersions(node: AssistCatalogNode): unknown {
  return node.type === 'task' ? withVersion(node) : { ...node, children: node.children.filter(forExtension).map(treeWithVersions) };
}

/**
 * The body of `GET /api/assist/catalog`, for a staff member already through the guard. The live
 * browser sends the same body to its engine at the session start, so the kill switch (G18), the
 * live hosts (G11) and the firm's own contact details (G16) reach it exactly as they reach the
 * extension.
 */
export async function assistCatalogBody(ctx: AuthContext): Promise<Record<string, unknown>> {
  const agents = ASSIST_AGENTS.map((agent) => ({
    ...agent,
    subAgents: agent.subAgents.filter((sub) => sub.kind !== 'api-file').map(withVersion),
  }));
  let firm: { supportEmail: string | null; supportPhone: string | null } = { supportEmail: null, supportPhone: null };
  try {
    firm = await getFirmSettings(ctx);
  } catch (error) {
    // The catalog still answers; the env list and the user's own email still reach the guard.
    console.error('[assist-agents] firm settings unreadable for the catalog', error);
  }
  const fromEnv = assistFirmContactsFromEnv();
  const firmContacts = splitContacts([...fromEnv.emails, ...fromEnv.phones, firm.supportEmail, firm.supportPhone, ctx.email]);
  return {
    ok: true,
    agents,
    tree: ASSIST_CATALOG_TREE.map(treeWithVersions),
    packs: assistPackStatus(),
    liveEnabled: assistLivePortalsEnabled(),
    liveHosts: assistLiveHosts(),
    mockHosts: assistMockHosts(),
    extensionDisabled: assistExtensionDisabled(),
    minExtensionVersion: assistMinExtensionVersion(),
    firmContacts,
  };
}
