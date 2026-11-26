import 'server-only';

import { db } from '@/db/client';
import { agentSettings } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { cleanAgentSetting, readAgentSettings, type AgentSettingKey, type AgentSettings } from '@/lib/card-agents/settings';

/**
 * AGENT SETTINGS REPOSITORY — `agent_settings` (Settings > Agents).
 *
 * >>> ACCESS CONTROL <<<
 *   read  — every staff role (super admin, admin, manager, project lead): the card agents read the
 *           switches before they start. Clients and the developer role are refused.
 *   write — firm-wide admins only (`isFirmWideAdmin`). Each change writes an audit event.
 *   system — `systemAgentSettings` for Inngest jobs and the live browser broker (no user).
 */

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);

export class AgentSettingsForbiddenError extends Error {
  constructor(message = 'Not permitted to change agent settings') {
    super(message);
    this.name = 'AgentSettingsForbiddenError';
  }
}

export async function systemAgentSettings(): Promise<AgentSettings> {
  const rows = await db.select({ key: agentSettings.key, value: agentSettings.value }).from(agentSettings);
  return readAgentSettings(rows);
}

export async function getAgentSettings(ctx: AuthContext): Promise<AgentSettings> {
  if (!STAFF.has(ctx.role)) throw new AgentSettingsForbiddenError('Only staff may read agent settings');
  return systemAgentSettings();
}

export async function setAgentSetting(ctx: AuthContext, key: AgentSettingKey, value: unknown): Promise<AgentSettings> {
  if (!isFirmWideAdmin(ctx.role)) throw new AgentSettingsForbiddenError();
  if (ctx.demo) throw new AgentSettingsForbiddenError('Demo logins cannot change agent settings');
  const clean = cleanAgentSetting(key, value);
  if (clean === null) throw new AgentSettingsForbiddenError(`That is not a valid value for ${key}`);
  const before = await systemAgentSettings();
  await db
    .insert(agentSettings)
    .values({ key, value: clean, updatedBy: ctx.userId })
    .onConflictDoUpdate({ target: agentSettings.key, set: { value: clean, updatedBy: ctx.userId, updatedAt: new Date() } });
  await recordAuditEvent(ctx, {
    action: 'agent_settings.update',
    summary: `Agent setting ${key} changed`,
    metadata: { key, before: before[key], after: clean },
  });
  return systemAgentSettings();
}
