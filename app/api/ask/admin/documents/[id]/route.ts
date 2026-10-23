import { NextResponse } from 'next/server';
import { getAskDocument, setAskDocumentStatus } from '@/db/repositories/ask-documents';
import { isFirmWideAdmin } from '@/lib/auth';
import { queueAskIngestion } from '@/lib/ask/ingest/run';
import { requireAsk } from '@/lib/ask/route-guard';

/** POST /api/ask/admin/documents/[id] — { action: "retry" | "archive" }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { id } = await params;
  let action: string;
  try {
    action = String(((await request.json()) as { action?: unknown }).action ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    const doc = await getAskDocument(gate.ctx, id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (action === 'archive') {
      await setAskDocumentStatus(gate.ctx, id, 'archived');
      return NextResponse.json({ ok: true });
    }
    if (action === 'retry') {
      await setAskDocumentStatus(gate.ctx, id, 'processing');
      const mode = await queueAskIngestion(id);
      return NextResponse.json({ ok: true, indexing: mode });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[ask-vcfo] source action failed', error);
    return NextResponse.json({ error: 'Could not update the source' }, { status: 500 });
  }
}
