import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminOrManager } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { AssignmentError, removeLead } from '@/db/repositories/work-assignments';
import { INTERN_TASKS_PATH } from '@/lib/intern/intern-work';

const bodySchema = z.object({
  fromLeadId: z.string().trim().min(1, 'Pick the lead').max(120),
  toLeadId: z.string().trim().min(1, 'Pick a project lead').max(120),
});

/**
 * POST /api/work/remove-lead — manager or admin (S-364). Removes a project lead from the
 * caller's clients and moves their open steps and tasks to `toLeadId` (`removeLead`, audited
 * per client). The new lead gets one bell row.
 */
export async function POST(request: Request) {
  const guard = await requireAdminOrManager();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, bodySchema);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const result = await removeLead(guard.ctx, parsed.data);
    await createNotificationsForUsers(
      result.clients.map((c) => ({
        userId: result.to.profileId,
        kind: 'team.assigned' as const,
        title: `${c.companyName}: ${result.from.name}'s work moved to you`,
        body: `Open steps and tasks from ${result.from.name}`,
        engagementId: c.engagementId,
        companyName: c.companyName,
        href: INTERN_TASKS_PATH,
      })),
    ).catch((err) => console.error('[work/remove-lead] bell failed', err));
    return NextResponse.json({
      clients: result.clients,
      steps: result.steps,
      tasks: result.tasks,
      to: { name: result.to.name },
    });
  } catch (err) {
    if (err instanceof AssignmentError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'remove_failed' }, { status: 500 });
  }
}
