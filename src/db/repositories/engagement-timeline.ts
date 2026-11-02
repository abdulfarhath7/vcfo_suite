import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager } from '@/lib/auth';
import { setEngagementWindow } from '@/db/repositories/schedule';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { timelinePartProblems, timelineWindows, type TimelinePart } from '@/lib/incorporation/timeline-phase-windows';

/**
 * ENGAGEMENT TIMELINE (F-259) — a manager saves the incorporation timeline at once, from the
 * staff timeline editor, instead of approving a client request. The four parts become schedule
 * windows by the same rule as an approved client request (`timeline-phase-windows.ts`).
 *
 * >>> ACCESS CONTROL <<<
 *   Managers, admins and super admins only (`isAdminOrManager`); project leads, clients and
 *   developers are refused before any read. Each window goes through `setEngagementWindow`,
 *   which checks the engagement scope again (a manager writes only their own engagements).
 */
export class TimelineSaveError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

export async function saveEngagementTimeline(ctx: AuthContext, engagementId: string, parts: TimelinePart[]): Promise<number> {
  if (!isAdminOrManager(ctx.role)) throw new TimelineSaveError('Only a project manager or admin may change the timeline', 403);
  const problems = timelinePartProblems(parts);
  if (problems.length > 0) throw new TimelineSaveError(problems[0]!, 400);
  const writes = timelineWindows(parts);
  for (const w of writes) await setEngagementWindow(ctx, engagementId, w.target, w.window);
  void recordAuditEvent(ctx, {
    engagementId: engagementDbId(engagementId),
    action: 'schedule.timeline.saved',
    summary: parts.map((p) => `${p.id} ${p.from} → ${p.to}`).join(', '),
    metadata: { parts },
  });
  return writes.length;
}
