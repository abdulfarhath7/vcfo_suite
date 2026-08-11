import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertEngagementBoardResolutionAccess } from '@/lib/api/board-resolution-access';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requireRole } from '@/lib/api/require-role';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { normalizeChecklistItemSlice } from '@/lib/checklist-state-key';
import {
  allIncorpDraftSlotsGenerated,
  generatedIncorpDraftRowKeys,
  isIncorpDraftRowKey,
} from '@/lib/incorporation-docs/share';
import { incorpDocRowKey } from '@/lib/incorporation-docs/paths';
import { incorpDraftDocSlotsFromResponses } from '@/lib/incorporation-docs/paths';
import { draftUrlFieldFor, INCORP_DOC_KINDS } from '@/lib/incorporation-docs/types';
import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import type { IncorpDocKind } from '@/lib/incorporation-docs/types';
import {
  checklistStateFromRow,
  patchChecklistItem,
  toAppEngagement,
} from '@/db/repositories/engagements';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';
import { emptyEmailDispatch } from '@/lib/email/email-dispatch';

type RouteContext = { params: Promise<{ id: string }> };

const shareOneSchema = z.object({
  doc: z.enum(INCORP_DOC_KINDS),
  director: z.enum(['non-resident', 'resident', 'company']),
});

const shareAllSchema = z.object({
  all: z.literal(true),
});

const shareBodySchema = z.union([shareAllSchema, shareOneSchema]);

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const [{ id: engagementParam }, parsedBody] = await Promise.all([
    context.params,
    parseJsonBody(request, shareBodySchema),
  ]);

  if (parsedBody.ok === false) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request.', code: 'validation_error' },
      { status: parsedBody.status },
    );
  }

  const access = await assertEngagementBoardResolutionAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden || !access.row) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const engagement = toAppEngagement(access.row);
  const checklistState = checklistStateFromRow(access.row);
  const pre7Item = checklist.find((c) => c.id === 'pre-7');
  const pre7State = normalizeChecklistItemSlice(checklistState['pre-7'], 'pre-7');
  const pre7Responses = pre7Item ? extractItemResponses(pre7Item, pre7State) : {};
  const sharedAt = new Date().toISOString();

  if ('all' in parsedBody.data) {
    const slots = incorpDraftDocSlotsFromResponses(pre7Responses);
    if (!allIncorpDraftSlotsGenerated(slots)) {
      const missing = slots.filter((s) => !s.path.trim()).length;
      return NextResponse.json(
        {
          ok: false,
          error: `Generate all ${slots.length} incorporation drafts before sharing with the client.`,
          code: 'incomplete',
          missingCount: missing,
        },
        { status: 400 },
      );
    }

    const rowKeys = generatedIncorpDraftRowKeys(slots);
    const patch: Partial<ChecklistItemStateSlice> = {
      sharedIncorpDraftDocs: rowKeys,
      incorpDraftsSharedAt: sharedAt,
    };

    await patchChecklistItem(auth.ctx, engagement.id, 'pre-7', patch, checklistState);

    await recordAuditEvent(auth.ctx, {
      engagementId: engagement.id,
      action: 'incorporation_docs.share_all',
      summary: `Shared ${rowKeys.length} incorporation drafts with client`,
      actorEmail: auth.ctx.email,
      actorName: auth.ctx.name,
      metadata: { rowKeys, bulk: true },
    });

    const email = await notifyEngagementEvent({
      engagementId: engagement.id,
      itemId: 'pre-7',
      event: 'docs_shared',
      actorUserId: auth.ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      sharedAt,
      sharedIncorpDraftDocs: rowKeys,
      bulk: true,
      email,
    });
  }

  const { doc, director } = parsedBody.data;
  const fieldId = draftUrlFieldFor(doc as IncorpDocKind, director as IncorpDocAudience);
  if (!fieldId) {
    return NextResponse.json(
      { ok: false, error: 'This document is not applicable for the selected director.' },
      { status: 400 },
    );
  }

  const storagePath = (pre7Responses[fieldId] ?? '').trim();
  if (!storagePath) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Generate and save this draft before sharing with the client.',
        code: 'not_found',
      },
      { status: 404 },
    );
  }

  const rowKey = incorpDocRowKey(doc, director);
  const existing = Array.isArray(pre7State.sharedIncorpDraftDocs)
    ? pre7State.sharedIncorpDraftDocs.filter(isIncorpDraftRowKey)
    : [];
  const sharedIncorpDraftDocs = existing.includes(rowKey) ? existing : [...existing, rowKey];

  const patch: Partial<ChecklistItemStateSlice> = {
    sharedIncorpDraftDocs,
  };

  await patchChecklistItem(auth.ctx, engagement.id, 'pre-7', patch, checklistState);

  await recordAuditEvent(auth.ctx, {
    engagementId: engagement.id,
    action: 'incorporation_docs.share',
    summary: `Shared ${doc} (${director}) with client`,
    actorEmail: auth.ctx.email,
    actorName: auth.ctx.name,
    metadata: { doc, director, rowKey },
  });

  // Only email when this is the first share of a new draft (avoid spam on re-share).
  const email = !existing.includes(rowKey)
    ? await notifyEngagementEvent({
        engagementId: engagement.id,
        itemId: 'pre-7',
        event: 'docs_shared',
        actorUserId: auth.ctx.userId,
      })
    : emptyEmailDispatch();

  return NextResponse.json({
    ok: true,
    rowKey,
    sharedAt,
    sharedIncorpDraftDocs,
    email,
  });
}
