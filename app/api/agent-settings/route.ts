import { z } from 'zod';
import { requireAdmin } from '@/auth/guards';
import type { AuthContext } from '@/auth/guards';
import { AgentSettingsForbiddenError, getAgentSettings, setAgentSetting } from '@/db/repositories/agent-settings';
import { browserHoursThisMonth } from '@/db/repositories/agent-runs-overview';
import { listPatches } from '@/db/repositories/assist-patches';
import { listStaffPeople } from '@/db/repositories/profiles';
import { parseJsonBody } from '@/lib/api/parse-body';
import { assistPackStatus } from '@/lib/assist-agents/catalog';
import { assistStaffGuard, guardFailure, json } from '@/lib/assist-agents/http';
import { isFirmWideAdmin } from '@/lib/auth';
import { browserConfigured, gstzenConfigured } from '@/lib/card-agents/config';
import { currentMonth } from '@/lib/card-agents/overview';
import { keepKnownPilots, recipeFacts, type AgentSettingsResponse, type AgentStaffOption } from '@/lib/card-agents/settings-page';
import { AGENT_SETTING_KEYS, type AgentRouteSetting } from '@/lib/card-agents/settings';
import { DEMO_BLOCKED_MESSAGE } from '@/lib/demo-logins';

/**
 * Settings > Agents (MASTER-PLAN.md screen 10).
 *
 *   GET — every staff role: the switches, whether each route is configured on this deployment and
 *         the portal packs' legal status (the card agents read these). Firm-wide admins also get
 *         the staff list for the pilot picker, this month's live browser hours, the recipe counts
 *         and the patch proposals waiting for review. Clients and developers get 403.
 *   PUT — firm-wide admins only, never a demo login: `{ key, value }` for one setting, through
 *         `setAgentSetting`, which validates the value and writes an audit event. A route's live
 *         switch cannot be turned on while the deployment is not configured for it (409
 *         `not_configured`), and the pilot list keeps active staff only.
 */

const STAFF_ROLES = new Set(['super_admin', 'admin', 'manager', 'intern']);

async function staffOptions(ctx: AuthContext): Promise<AgentStaffOption[]> {
  const people = await listStaffPeople(ctx);
  return people
    .filter((p) => STAFF_ROLES.has(p.role) && p.status === 'active')
    .map((p) => ({ id: p.id, name: p.name, role: p.role }));
}

export async function GET() {
  const guard = await assistStaffGuard();
  if (guard.ok === false) return guardFailure(guard);
  const { ctx } = guard;
  try {
    const settings = await getAgentSettings(ctx);
    const packs = assistPackStatus();
    const firmAdmin = isFirmWideAdmin(ctx.role);
    let admin: AgentSettingsResponse['admin'] = null;
    if (firmAdmin) {
      const month = currentMonth(new Date());
      const [staff, usage, patches] = await Promise.all([staffOptions(ctx), browserHoursThisMonth(ctx, month), listPatches(ctx, { status: 'proposed', limit: 200 })]);
      admin = { staff, month, browserHoursUsed: usage.hours, browserSessions: usage.sessions, recipes: recipeFacts(packs), patchesWaiting: patches.length };
    }
    const body: AgentSettingsResponse = {
      ok: true,
      settings,
      deployment: { gstzen: gstzenConfigured(), browser: browserConfigured() },
      packs,
      canEdit: firmAdmin && !ctx.demo,
      admin,
    };
    return json(body);
  } catch (error) {
    if (error instanceof AgentSettingsForbiddenError) return json({ ok: false, error: 'forbidden' }, 403);
    console.error('[agent-settings] read failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}

const putSchema = z.object({ key: z.enum(AGENT_SETTING_KEYS), value: z.unknown() }).strict();

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (guard.ok === false) return guardFailure(guard);
  if (guard.ctx.demo) return json({ ok: false, error: DEMO_BLOCKED_MESSAGE }, 403);
  const parsed = await parseJsonBody(request, putSchema);
  if (parsed.ok === false) return json({ ok: false, error: parsed.error }, parsed.status);
  const { key } = parsed.data;
  let { value } = parsed.data;
  try {
    if ((key === 'gstzen' || key === 'browser') && value && typeof value === 'object') {
      // The pilot list holds staff only: an id that is not a staff member is dropped.
      const staffIds = new Set((await staffOptions(guard.ctx)).map((s) => s.id));
      const v = value as Partial<AgentRouteSetting>;
      // A route this deployment cannot serve cannot be switched on (it can always be switched off).
      const configured = key === 'gstzen' ? gstzenConfigured() : browserConfigured();
      if (v.live === true && !configured) return json({ ok: false, error: 'not_configured' }, 409);
      value = keepKnownPilots({ live: v.live === true, pilotUserIds: Array.isArray(v.pilotUserIds) ? v.pilotUserIds.filter((x) => typeof x === 'string') : [] }, staffIds);
    }
    const settings = await setAgentSetting(guard.ctx, key, value);
    return json({ ok: true, settings });
  } catch (error) {
    if (error instanceof AgentSettingsForbiddenError) {
      const status = error.message.startsWith('That is not a valid value') ? 400 : 403;
      return json({ ok: false, error: error.message }, status);
    }
    console.error('[agent-settings] write failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
