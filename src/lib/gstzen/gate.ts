import 'server-only';

import { gstzenConfigured } from '@/lib/card-agents/config';
import { routeOpenFor, type AgentSettings } from '@/lib/card-agents/settings';
import { systemAgentSettings } from '@/db/repositories/agent-settings';

/**
 * Whether the GSTZen route is open for a person now (decision B4): the deployment is configured
 * (GSTZEN_USERNAME and GSTZEN_PASSWORD), the kill switch is off, and the admin switch in Settings >
 * Agents is on for them (pilot list empty, or they are on it). Routes answer 503 with the message
 * when it is closed; jobs skip their work.
 *
 * A client who answers an OTP is checked against the staff member who asked for it, since the pilot
 * list names staff.
 */

export type GstzenGate = { open: true } | { open: false; status: 503; message: string };

export function gateFrom(settings: AgentSettings, userId: string, env: Record<string, string | undefined> = process.env): GstzenGate {
  if (!gstzenConfigured(env)) return { open: false, status: 503, message: 'GSTZen is not set up for this deployment yet.' };
  if (settings.killSwitch) return { open: false, status: 503, message: 'The agents are stopped by the kill switch in Settings > Agents.' };
  if (!routeOpenFor(settings, 'gstzen', userId)) return { open: false, status: 503, message: 'The GSTZen route is switched off for you in Settings > Agents.' };
  return { open: true };
}

export async function gstzenGate(userId: string, env: Record<string, string | undefined> = process.env): Promise<GstzenGate> {
  if (!gstzenConfigured(env)) return gateFrom({ killSwitch: false } as AgentSettings, userId, env);
  return gateFrom(await systemAgentSettings(), userId, env);
}
