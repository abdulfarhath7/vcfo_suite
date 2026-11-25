import 'server-only';

import { NextResponse } from 'next/server';
import { requireAnyRole, type AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { InputsForbiddenError, saveSubjectFields } from '@/db/repositories/compliance-inputs';
import { getGstProfile, signGstDocuments } from '@/db/repositories/gst-profile';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { canRecordRegistrationTracker } from './tracker-access';
import { GST_FORM_ID, type GstDocument, type GstMissing, type GstProfileResult } from './gst-profile';
import { GST_STEP_ID } from './gst-tracker';
import { changedOnly, gstinMatchesPan, gstResultSchema, gstTrackerPatch } from './gst-result';

/**
 * The VCFO Assist side of GST registration (`form: 'gst-reg-01'`): the profile the extension
 * fills the portal from, and the result it posts back. Contract:
 * `src/lib/registrations/gst-profile.ts` and `vcfo_assist/docs/gst-profile-contract.md`.
 */

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

export interface GstAssistPayload {
  ok: true;
  schemaVersion: GstProfileResult['schemaVersion'];
  form: typeof GST_FORM_ID;
  engagement: { id: string; slug: string | null; companyName: string };
  companyName: string;
  issuedAt: string;
  profile: GstProfileResult['profile'];
  fields: GstProfileResult['fields'];
  documents: GstDocument[];
  missing: GstMissing[];
  notes: GstProfileResult['notes'];
  readiness: GstProfileResult['readiness'];
}

/** The payload for a caller already through a staff guard; documents get signed URLs. */
export async function gstAssistPayload(
  ctx: AuthContext,
  engagementParam: string,
  now = new Date(),
): Promise<{ ok: true; payload: GstAssistPayload } | { ok: false; status: number; error: string }> {
  const loaded = await getGstProfile(ctx, engagementParam);
  if (loaded.ok === false) return { ok: false, status: loaded.status, error: loaded.error };
  const { result, inputs } = loaded;
  const signed = await signGstDocuments(result.documents, now);
  const unsigned = signed.unsigned;
  const appId = appEngagementId(inputs.dbId);
  const documents = signed.documents.map((d) => ({ ...d, attachmentPath: `/api/assist/engagements/${encodeURIComponent(appId)}/attachments/${encodeURIComponent(d.key)}` }));
  const missing = [
    ...result.missing,
    ...unsigned.map(
      (key): GstMissing => ({
        key,
        label: result.documents.find((d) => d.key === key)?.label ?? key,
        kind: 'document',
        source: 'tool',
        where: 'The file is listed in the tool but could not be read from storage; upload it again',
        stepId: GST_STEP_ID,
        required: true,
      }),
    ),
  ];
  const required = missing.filter((m) => m.required);
  return {
    ok: true,
    payload: {
      ok: true,
      schemaVersion: result.schemaVersion,
      form: GST_FORM_ID,
      engagement: { id: appEngagementId(inputs.dbId), slug: inputs.engagement.slug ?? null, companyName: inputs.engagement.companyName },
      companyName: result.companyName,
      issuedAt: now.toISOString(),
      profile: result.profile,
      fields: result.fields,
      documents,
      missing,
      notes: result.notes,
      readiness: {
        ready: required.length === 0,
        missingValues: required.filter((m) => m.kind === 'value').length,
        missingDocuments: required.filter((m) => m.kind === 'document').length,
      },
    },
  };
}

/** GET `?form=gst-reg-01` on the assist-profile route: staff only, as for SPICe+. */
export async function gstAssistProfileResponse(engagementParam: string): Promise<NextResponse> {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const built = await gstAssistPayload(auth.ctx, engagementParam);
  if (built.ok === false) return NextResponse.json({ ok: false, error: built.error }, { status: built.status });
  return NextResponse.json(built.payload, { headers: NO_STORE });
}

const todayIst = (now = new Date()) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);

export type GstResultOutcome =
  | { ok: true; status: 200; changed: string[]; tracker: Record<string, string> }
  | { ok: false; status: 400 | 403 | 404 | 409 | 422; error: string };

/**
 * Save a GST result into the reg-4 tracker. The project lead records the tracker (owner rule,
 * 12 Nov 2026), so a manager's or an admin's extension post is refused with `tracker_lead_only`.
 * A repeated post with the same values changes nothing and writes no audit row.
 */
export async function saveGstResult(ctx: AuthContext, engagementParam: string, json: unknown, now = new Date()): Promise<GstResultOutcome> {
  const parsed = gstResultSchema.safeParse(json);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'invalid_body' };
  if (!canRecordRegistrationTracker(ctx.role) || ctx.role === 'client') return { ok: false, status: 403, error: 'tracker_lead_only' };
  const loaded = await getGstProfile(ctx, engagementParam);
  if (loaded.ok === false) return { ok: false, status: loaded.status, error: loaded.error };
  const body = parsed.data;
  if (body.gstin && !gstinMatchesPan(body.gstin, loaded.result.profile.partA.pan)) {
    return { ok: false, status: 422, error: 'gstin_pan_mismatch' };
  }
  const current = loaded.values.sbc;
  if (body.arn && current.arn && current.arn.trim() && current.arn.trim() !== body.arn) {
    // A second application has its own ARN; replacing one silently would lose the first.
    return { ok: false, status: 409, error: 'arn_already_recorded' };
  }
  const patch = gstTrackerPatch(body, todayIst(now));
  // The filing day already recorded by the lead stays; only an ARN post sets it when it is empty.
  // The ARN date likewise, unless the post names the date itself.
  if (current['filed-on']?.trim()) delete patch['filed-on'];
  if (current['arn-date']?.trim() && !body.arnDate) delete patch['arn-date'];
  const changed = changedOnly(patch, current);
  const keys = Object.keys(changed);
  if (keys.length) {
    try {
      const saved = await saveSubjectFields(ctx, { engagementId: engagementParam, kind: 'registration', key: GST_STEP_ID, side: 'sbc', values: changed });
      if (!saved) return { ok: false, status: 404, error: 'not_found' };
    } catch (error) {
      if (error instanceof InputsForbiddenError) return { ok: false, status: 403, error: 'tracker_lead_only' };
      throw error;
    }
    const what = [body.arn && `ARN ${body.arn}`, body.srn && `SRN ${body.srn}`, body.gstin && `GSTIN ${body.gstin}`, body.aadhaar && `Aadhaar ${body.aadhaar}`].filter(Boolean).join(', ');
    await recordAuditEvent(ctx, {
      engagementId: loaded.inputs.dbId,
      action: 'registration.gst.assist_result',
      summary: `VCFO Assist recorded the GST registration: ${what}`,
      metadata: { form: GST_FORM_ID, keys, status: body.status ?? null, fieldsWritten: body.fieldsWritten ?? null, mismatches: body.mismatches?.length ?? 0, capturedAt: body.capturedAt ?? null },
    });
  }
  return { ok: true, status: 200, changed: keys, tracker: { ...Object.fromEntries(Object.entries(current).filter(([, v]) => v != null)) as Record<string, string>, ...changed } };
}

/** POST body with `form: 'gst-reg-01'` on the Assist result route. */
export async function gstAssistResultResponse(json: unknown, engagementParam: string): Promise<NextResponse> {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  try {
    const out = await saveGstResult(guard.ctx, engagementParam, json);
    if (out.ok === false) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
    return NextResponse.json({ ok: true, form: GST_FORM_ID, changed: out.changed, tracker: out.tracker }, { headers: NO_STORE });
  } catch (error) {
    console.error('[gst-assist] result failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
