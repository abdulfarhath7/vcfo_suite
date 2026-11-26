import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, gstNotices } from '@/db/schema';
import type { EngagementDbRow } from '@/db/repositories/engagements';
import type { AuthContext } from '@/auth/guards';
import { staffEngagement } from '@/db/repositories/gst-agent-scope';
import { noticeDocumentNames } from '@/lib/gstzen/mappers';
import type { GstNoticeView } from '@/lib/gstzen/types';

/**
 * GST NOTICES REPOSITORY — `gst_notices`: notices and orders the GST portal issued to a client's
 * GSTIN, read daily through the GSP notice API (read only; replies stay with the person). The detail
 * keeps ids, names, dates and the period only, never a document body.
 *
 * >>> ACCESS CONTROL <<<
 *   read — staff on the engagement (admins all, a manager owned or co-managed, a lead assigned).
 *          Clients do not read notices here.
 *   system — the daily notice job writes (`systemKnownNoticeRefs`, `systemUpsertNotices`).
 */

type Row = typeof gstNotices.$inferSelect;

export function toNoticeView(r: Row): GstNoticeView {
  return {
    id: r.id,
    gstin: r.gstin,
    refId: r.refId,
    arn: r.arn,
    noticeType: r.noticeType,
    issuedOn: r.issuedOn ? String(r.issuedOn) : null,
    dueOn: r.dueOn ? String(r.dueOn) : null,
    period: r.period,
    state: r.state === 'replied' || r.state === 'closed' ? r.state : 'open',
    documents: noticeDocumentNames(r.detail),
    fetchedAt: r.fetchedAt.toISOString(),
  };
}

/** The engagement's GST notices, open first, newest first. */
export async function listGstNotices(ctx: AuthContext, engagementId: string): Promise<GstNoticeView[]> {
  const { dbId } = await staffEngagement(ctx, engagementId);
  const rows = await db.select().from(gstNotices).where(eq(gstNotices.engagementId, dbId)).orderBy(desc(gstNotices.issuedOn), desc(gstNotices.fetchedAt)).limit(100);
  return rows.map(toNoticeView).sort((a, b) => Number(b.state === 'open') - Number(a.state === 'open'));
}

/** Reference ids already stored for a GSTIN, with their state. Jobs only. */
export async function systemKnownNoticeRefs(gstin: string): Promise<Map<string, string>> {
  const rows = await db.select({ refId: gstNotices.refId, state: gstNotices.state }).from(gstNotices).where(eq(gstNotices.gstin, gstin));
  return new Map(rows.map((r) => [r.refId, r.state]));
}

export interface NoticeUpsert {
  refId: string;
  arn: string | null;
  noticeType: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  period: string | null;
  state: 'open' | 'replied' | 'closed';
  /** Ids, names, dates and the period only. */
  detail?: Record<string, unknown>;
}

/** Inserts new notices and updates the state of known ones. Answers the notices that were new. Jobs only. */
export async function systemUpsertNotices(engagementId: string, gstin: string, items: NoticeUpsert[], now = new Date()): Promise<NoticeUpsert[]> {
  if (!items.length) return [];
  const known = await systemKnownNoticeRefs(gstin);
  const fresh: NoticeUpsert[] = [];
  for (const n of items) {
    if (known.has(n.refId)) {
      await db
        .update(gstNotices)
        .set({ state: n.state, fetchedAt: now, ...(n.dueOn ? { dueOn: n.dueOn } : {}), ...(n.detail ? { detail: n.detail } : {}) })
        .where(and(eq(gstNotices.gstin, gstin), eq(gstNotices.refId, n.refId)));
      continue;
    }
    await db
      .insert(gstNotices)
      .values({ engagementId, gstin, refId: n.refId, arn: n.arn, noticeType: n.noticeType, issuedOn: n.issuedOn, dueOn: n.dueOn, period: n.period, state: n.state, detail: n.detail ?? {}, fetchedAt: now })
      .onConflictDoNothing();
    fresh.push(n);
  }
  return fresh;
}

/** The engagement a notice belongs to, for the job's lead lookup (not soft-deleted). Jobs only. */
export async function systemNoticeEngagement(engagementId: string): Promise<EngagementDbRow | null> {
  const [row] = await db.select().from(engagements).where(and(eq(engagements.id, engagementId), isNull(engagements.deletedAt))).limit(1);
  return row ?? null;
}
