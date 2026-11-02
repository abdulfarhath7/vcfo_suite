import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminOrManager } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { AssignmentError, reassignWork } from '@/db/repositories/work-assignments';
import { itemKeySchema } from '@/lib/messages/schemas';
import { INTERN_TASKS_PATH } from '@/lib/intern/intern-work';

const leadIdSchema = z.string().trim().min(1, 'Pick a project lead').max(120);
const noteSchema = z.string().trim().max(500, 'Note is too long').nullish();

const reassignSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('item'),
    engagementId: z.string().trim().min(1).max(120),
    itemKey: itemKeySchema,
    toLeadId: leadIdSchema,
    note: noteSchema,
  }),
  z.object({
    kind: z.literal('lead'),
    engagementId: z.string().trim().min(1).max(120),
    fromLeadId: leadIdSchema,
    toLeadId: leadIdSchema,
    note: noteSchema,
  }),
]);

/**
 * POST /api/work/reassign — admin, super admin or manager (G-18).
 *   `{ kind: 'item', engagementId, itemKey, toLeadId }` moves one step (`step:…`) or task
 *   (`task:…`) to another lead;
 *   `{ kind: 'lead', engagementId, fromLeadId, toLeadId }` moves the whole client.
 * Lead ids are the `intern_id` key or the profile id. An optional `note` goes on the audit
 * event and the new lead's bell row.
 */
export async function POST(request: Request) {
  const guard = await requireAdminOrManager();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = await parseJsonBody(request, reassignSchema);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const note = parsed.data.note?.trim() || null;
    const result = await reassignWork(guard.ctx, parsed.data);
    const what = result.kind === 'lead' ? 'client' : result.kind;

    await recordAuditEvent(guard.ctx, {
      engagementId: result.engagementDbId,
      action: 'work.reassigned',
      summary: `Reassigned ${what} to ${result.to.name}: ${result.label}`,
      metadata: {
        kind: result.kind,
        itemKey: parsed.data.kind === 'item' ? parsed.data.itemKey : null,
        fromLeadId: parsed.data.kind === 'lead' ? parsed.data.fromLeadId : null,
        toLeadProfileId: result.to.profileId,
        note,
      },
    });
    await createNotificationsForUsers([
      {
        userId: result.to.profileId,
        kind: 'team.assigned',
        title: `${result.companyName}: ${what} reassigned to you`,
        body: note ? `${result.label} · ${note}` : result.label,
        engagementId: result.engagementId,
        companyName: result.companyName,
        href: INTERN_TASKS_PATH,
      },
    ]).catch((err) => console.error('[work/reassign] bell failed', err));

    return NextResponse.json({ ok: true, kind: result.kind, toLeadId: result.to.leadKey });
  } catch (err) {
    if (err instanceof AssignmentError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[work/reassign] failed', err);
    return NextResponse.json({ error: 'Could not reassign' }, { status: 500 });
  }
}
