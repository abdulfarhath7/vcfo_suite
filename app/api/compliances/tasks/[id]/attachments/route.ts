import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { rejectLargeBody } from '@/lib/api/body-limit';
import { addTaskAttachment } from '@/db/repositories/compliance-tasks';
import { complianceError } from '../../../_respond';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/compliances/tasks/:id/attachments — multipart `file` (1 byte to 15 MB) and optional
 * `deliverable=1` (staff only). Staff and the client on a task it can see.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const tooLarge = rejectLargeBody(request, 20 * 1024 * 1024);
  if (tooLarge) return tooLarge;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'file_required' }, { status: 400 });
  try {
    const attachment = await addTaskAttachment(
      guard.ctx,
      id,
      { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
      { deliverable: form?.get('deliverable') === '1' },
    );
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (e) {
    return complianceError(e);
  }
}
