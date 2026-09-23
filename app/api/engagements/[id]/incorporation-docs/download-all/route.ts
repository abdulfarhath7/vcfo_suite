import { NextResponse } from 'next/server';

import { assertEngagementBoardResolutionAccess } from '@/lib/api/board-resolution-access';
import { requireAnyRole } from '@/auth/guards';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import { normalizeChecklistItemSlice } from '@/lib/checklist-state-key';
import { sanitizeIncorpDocxBufferWithReport } from '@/lib/incorporation-docs/docx-sanitize';
import { incorpDraftDocLinksFromResponses } from '@/lib/incorporation-docs/paths';
import { filterClientVisibleIncorpDrafts } from '@/lib/incorporation-docs/share';
import { downloadIncorpDocx } from '@/lib/incorporation-docs/storage';
import {
  buildIncorpDraftsZip,
  incorpDraftsZipRoot,
  incorpDraftZipEntries,
} from '@/lib/incorporation-docs/zip';
import { checklistStateFromRow, toAppEngagement } from '@/db/repositories/engagements';
import { directorResponsesFromState } from '@/lib/proposed-directors';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * All incorporation drafts in one zip. Authorisation mirrors the single-file
 * download route exactly: the same roles, the same engagement access check,
 * a client only ever gets rows shared with them, and no audit event.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager', 'intern', 'client');
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: engagementParam } = await context.params;
  const access = await assertEngagementBoardResolutionAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden || !access.row) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const engagement = toAppEngagement(access.row);
  const checklistState = checklistStateFromRow(access.row);
  const pre7State = normalizeChecklistItemSlice(checklistState['pre-7'], 'pre-7');
  const pre7Item = checklist.find((c) => c.id === 'pre-7');
  const pre7 = pre7Item ? extractItemResponses(pre7Item, pre7State) : {};
  const { pre6 } = directorResponsesFromState(checklistState);

  const links =
    auth.ctx.role === 'client'
      ? filterClientVisibleIncorpDrafts(pre7, pre7State, { pre6 })
      : incorpDraftDocLinksFromResponses(pre7, { pre6 });

  if (links.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          auth.ctx.role === 'client'
            ? 'Draft documents are not available until your project lead shares them.'
            : 'No incorporation draft has been generated yet.',
        code: 'none_available',
      },
      { status: auth.ctx.role === 'client' ? 403 : 404 },
    );
  }

  const root = incorpDraftsZipRoot(engagement.companyName, engagement.slug);
  const { buffer, included } = await buildIncorpDraftsZip(
    incorpDraftZipEntries(links, root, pre6),
    async (storagePath) => {
      const bytes = await downloadIncorpDocx(storagePath);
      // Read-only: a repaired copy goes in the zip, storage is left as is.
      return bytes ? sanitizeIncorpDocxBufferWithReport(Buffer.from(bytes)).buffer : null;
    },
  );

  if (included.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'The document files could not be downloaded.', code: 'download_failed' },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${root}.zip"`,
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
