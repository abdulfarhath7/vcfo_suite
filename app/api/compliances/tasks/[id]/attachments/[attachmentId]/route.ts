import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getTaskAttachmentUrl, removeTaskAttachment } from '@/db/repositories/compliance-tasks';
import { complianceError } from '../../../../_respond';

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

/** GET /api/compliances/tasks/:id/attachments/:attachmentId — a short-lived signed URL. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id, attachmentId } = await context.params;
  try {
    return NextResponse.json(await getTaskAttachmentUrl(guard.ctx, id, attachmentId));
  } catch (e) {
    return complianceError(e);
  }
}

/** DELETE — admin, super admin, manager, or the uploader. */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id, attachmentId } = await context.params;
  try {
    await removeTaskAttachment(guard.ctx, id, attachmentId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return complianceError(e);
  }
}
