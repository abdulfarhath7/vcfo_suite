import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getRegulatoryUpdate } from '@/db/repositories/ask-documents';
import { signedDownloadUrl } from '@/storage/s3';

/** GET /api/regulatory-updates/[id]/review-pdf — opens the manager's review document (short-lived link). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAnyRole('manager', 'admin', 'super_admin');
  if (gate.ok === false) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  const row = await getRegulatoryUpdate(gate.ctx, id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!row.reviewPdfKey) return NextResponse.json({ error: 'The review document is not ready yet.' }, { status: 409 });
  return NextResponse.redirect(await signedDownloadUrl(row.reviewPdfKey, 300));
}
