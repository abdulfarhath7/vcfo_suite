import { publicErrorMessage } from '@/lib/api-error';
import { createAndNotifyDocumentRequest } from '@/lib/requests/create-document-request';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listDocumentRequests } from '@/db/repositories/document-requests';

/** GET /api/requests */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const requests = await listDocumentRequests(guard.ctx);
    return NextResponse.json({ requests });
  } catch (err) {
    const message = publicErrorMessage(err, 'list_failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/requests */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  let body: {
    engagementId?: string;
    taskId?: string;
    label?: string;
    message?: string;
    dueAt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.engagementId?.trim() || !body.label?.trim()) {
    return NextResponse.json({ error: 'engagementId_and_label_required' }, { status: 400 });
  }
  try {
    const { request: docRequest, email } = await createAndNotifyDocumentRequest(guard.ctx, {
      engagementId: body.engagementId,
      taskId: body.taskId,
      label: body.label,
      message: body.message,
      dueAt: body.dueAt,
    });
    return NextResponse.json({ request: docRequest, email }, { status: 201 });
  } catch (err) {
    const message = publicErrorMessage(err, 'create_failed');
    const status = message.includes('not permitted') || message.includes('may not') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
