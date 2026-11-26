import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { staffEngagement, engagementGstin, GstAgentError } from '@/db/repositories/gst-agent-scope';
import { systemKnownNoticeRefs, systemUpsertNotices, type NoticeUpsert } from '@/db/repositories/gst-notices';
import { GstzenError, gstzen, type GstzenClient } from './client';
import { gstzenGate } from './gate';
import { gstinCheckOf, noticeFromDetail, noticesFromList } from './mappers';
import type { GstinCheckResult } from './types';

/**
 * GST NOTICES AND THE GSTIN CHECK.
 *
 * `syncNoticesForGstin` is the daily notice watcher's work for one GSTIN with an active GSTN
 * session: list the notices of the last 60 days, read the detail of each new one (names, dates and
 * the period; no document body) and store them. A notice with no reply date is open. The job tells
 * the lead about each new open notice.
 *
 * `checkGstinOnGstn` reads the GSTIN validator for the registration tracker (staff only): legal
 * name, status and jurisdiction, for the person to confirm before anything is saved.
 */

export async function syncNoticesForGstin(engagementId: string, gstin: string, api: GstzenClient = gstzen(), now = new Date()): Promise<NoticeUpsert[]> {
  const list = noticesFromList(await api.noticeList(gstin));
  if (!list.length) return [];
  const known = await systemKnownNoticeRefs(gstin);
  const items: NoticeUpsert[] = [];
  for (const n of list.slice(0, 50)) {
    const state: NoticeUpsert['state'] = n.respondedOn ? 'replied' : 'open';
    if (known.has(n.refId)) {
      items.push({ refId: n.refId, arn: n.arn, noticeType: null, issuedOn: n.issuedOn, dueOn: null, period: null, state });
      continue;
    }
    let d: ReturnType<typeof noticeFromDetail> | null;
    try {
      d = noticeFromDetail(await api.noticeDetail(gstin, n.refId), n);
    } catch {
      d = null;
    }
    items.push({
      refId: n.refId,
      arn: n.arn,
      noticeType: d?.noticeType ?? n.alertCd ?? n.moduleCd,
      issuedOn: d?.issuedOn ?? n.issuedOn,
      dueOn: d?.dueOn ?? null,
      period: d?.period ?? null,
      state,
      detail: d?.detail ?? { refId: n.refId, arn: n.arn, moduleCd: n.moduleCd, alertCd: n.alertCd, dateOfIssue: n.issuedOn, respondedOn: n.respondedOn },
    });
  }
  return systemUpsertNotices(engagementId, gstin, items, now);
}

export async function checkGstinOnGstn(ctx: AuthContext, engagementId: string): Promise<GstinCheckResult> {
  const { dbId, row } = await staffEngagement(ctx, engagementId);
  const gate = await gstzenGate(ctx.userId);
  if (gate.open === false) throw new GstAgentError(gate.message, 503);
  const gstin = await engagementGstin(dbId, row);
  if (!gstin) throw new GstAgentError('Record a valid GSTIN first.', 409);
  let body: unknown;
  try {
    body = await gstzen().validateGstin(gstin);
  } catch (e) {
    if (e instanceof GstzenError) throw new GstAgentError(e.message, 422);
    throw e;
  }
  const result = gstinCheckOf(body, gstin);
  await recordAuditEvent(ctx, {
    engagementId: dbId,
    action: 'gstzen.gstin.checked',
    summary: `GSTIN ${gstin} checked on GSTN: ${result.valid ? (result.status ?? 'found') : 'not valid'}`,
    metadata: { gstin, valid: result.valid, status: result.status },
  });
  return result;
}
