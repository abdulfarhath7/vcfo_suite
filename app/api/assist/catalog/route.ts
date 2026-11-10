import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import {
  ASSIST_AGENTS,
  assistExtensionDisabled,
  assistFirmContactsFromEnv,
  assistLivePortalsEnabled,
  assistMinExtensionVersion,
  assistMockHosts,
  splitContacts,
} from '@/lib/assist-agents/catalog';
import { getRecipe } from '@/lib/assist-agents/registry';
import { getFirmSettings } from '@/db/repositories/firm-settings';

/**
 * GET /api/assist/catalog — the agents and sub-agents, each with its recipe version. Staff only.
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
    subAgents: agent.subAgents.map((sub) => ({ ...sub, recipeVersion: sub.recipeId ? (getRecipe(sub.recipeId)?.version ?? null) : null })),
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
    liveEnabled: assistLivePortalsEnabled(),
    mockHosts: assistMockHosts(),
    extensionDisabled: assistExtensionDisabled(),
    minExtensionVersion: assistMinExtensionVersion(),
    firmContacts,
  });
}
