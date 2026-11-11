import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import {
  ASSIST_AGENTS,
  ASSIST_CATALOG_TREE,
  assistLiveHosts,
  assistPackStatus,
  type AssistCatalogNode,
  assistExtensionDisabled,
  assistFirmContactsFromEnv,
  assistLivePortalsEnabled,
  assistMinExtensionVersion,
  assistMockHosts,
  splitContacts,
} from '@/lib/assist-agents/catalog';
import { getRecipe } from '@/lib/assist-agents/registry';
import { getFirmSettings } from '@/db/repositories/firm-settings';

const withVersion = <T extends { recipeId: string | null }>(sub: T) => ({ ...sub, recipeVersion: sub.recipeId ? (getRecipe(sub.recipeId)?.version ?? null) : null });

function treeWithVersions(node: AssistCatalogNode): unknown {
  return node.type === 'task' ? withVersion(node) : { ...node, children: node.children.map(treeWithVersions) };
}

/**
 * GET /api/assist/catalog — the agents and their tasks (flat, `agents`, as older extensions read
 * it) and the same as a tree of any depth (`tree`), each task with its recipe version, plus each
 * portal pack's legal status and live switch (`packs`). Staff only.
 *
 * The extension reads it at every run start, so it also carries the remote kill switch
 * (`extensionDisabled`, `minExtensionVersion`; SAFETY.md G18) and the firm's own contact details
 * (`firmContacts`), which the no-placeholder guard (G16) never types into a client's field.
 */
export async function GET() {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const agents = ASSIST_AGENTS.map((agent) => ({
    ...agent,
    subAgents: agent.subAgents.map(withVersion),
  }));
  let firm: { supportEmail: string | null; supportPhone: string | null } = { supportEmail: null, supportPhone: null };
  try {
    firm = await getFirmSettings(guard.ctx);
  } catch (error) {
    // The catalog still answers; the env list and the user's own email still reach the guard.
    console.error('[assist-agents] firm settings unreadable for the catalog', error);
  }
  const fromEnv = assistFirmContactsFromEnv();
  const firmContacts = splitContacts([...fromEnv.emails, ...fromEnv.phones, firm.supportEmail, firm.supportPhone, guard.ctx.email]);
  return json({
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
  });
}
