import 'server-only';

import { and, asc, count, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db/client';
import {
  complianceInstanceDetails,
  complianceInstanceProofs,
  complianceInstances,
  complianceObligations,
  complianceReminders,
  engagements,
  profiles,
} from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { listScopedEngagementIds } from '@/db/repositories/engagements';
import { appEngagementId } from '@/lib/legacy-engagement-ids';
import { bucketKey, putObject, signedDownloadUrl, deleteObject } from '@/storage/s3';
import {
  addDays,
  areaOf,
  authorityName,
  daysBetween,
  displayName,
  displayPeriod,
  fmtDM,
  freqLabel,
  fyMonths,
  periodLong,
  todayIso,
  type PortalFiling,
} from '@/lib/client-portal/compliances';

/**
 * CLIENT COMPLIANCES REPOSITORY — the client portal's calendar / filings read,
 * proof files (rule 15), the per-filing detail facts and "Remind me".
 *
 * >>> ACCESS CONTROL (Path A, mirrors the compliance_* RLS rows in README) <<<
 *  - READ (filings, details, proofs, signed proof URLs): every role, limited to
 *    `listScopedEngagementIds(ctx)` — admin/super firm-wide, manager owned /
 *    co-managed, lead assigned, client OWN engagement only. A filing id outside
 *    that list reads as "not found" (no existence leak across tenants).
 *  - WRITE proofs / details: staff only (super_admin, admin, manager, intern)
 *    and only inside the same scope ("write via assigned engagement"). Clients
 *    are read-only on the register, exactly as compliance_instances RLS.
 *  - REMINDERS: any role inside scope, and only ever the caller's own row
 *    (`user_id = ctx.userId`). Nobody can read or change another user's reminder.
 *  - Filing windows stay manager-only (POST /api/filings/[id]/window) — the
 *    portal timeline is read-only for clients.
 */

export class ComplianceNotFoundError extends Error {
  constructor() {
    super('Filing not found');
  }
}
export class ComplianceForbiddenError extends Error {
  constructor(msg = 'Only SBC staff can change filings') {
    super(msg);
  }
}

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);

const owner = alias(profiles, 'owner_profile');
const filer = alias(profiles, 'filer_profile');

export interface PortalFilingsQuery {
  fyStartYear?: number;
  /** Only these instance ids (single-filing reads: .ics, detail). */
  ids?: string[];
}

export async function getPortalFilings(ctx: AuthContext, query: PortalFilingsQuery = {}): Promise<PortalFiling[]> {
  const scope = await listScopedEngagementIds(ctx);
  if (scope.length === 0) return [];
  const conditions = [inArray(complianceInstances.engagementId, scope)];
  if (query.fyStartYear !== undefined) {
    const months = fyMonths(query.fyStartYear);
    conditions.push(gte(complianceInstances.dueDate, `${months[0]}-01`));
    conditions.push(lte(complianceInstances.dueDate, `${months[11]}-31`));
  }
  if (query.ids) {
    if (query.ids.length === 0) return [];
    conditions.push(inArray(complianceInstances.id, query.ids));
  }

  const rows = await db
    .select({
      id: complianceInstances.id,
      engagementId: complianceInstances.engagementId,
      dueDate: complianceInstances.dueDate,
      filedOn: complianceInstances.filedOn,
      periodStart: complianceInstances.periodStart,
      periodEnd: complianceInstances.periodEnd,
      periodLabel: complianceInstances.periodLabel,
      fyLabel: complianceInstances.fyLabel,
      status: complianceInstances.status,
      windowFrom: complianceInstances.windowFrom,
      windowTo: complianceInstances.windowTo,
      evidenceUrl: complianceInstances.evidenceUrl,
      companyName: engagements.companyName,
      complianceArea: complianceObligations.complianceArea,
      particular: complianceObligations.particular,
      authority: complianceObligations.authority,
      frequency: complianceObligations.frequency,
      penaltyRisk: complianceObligations.penaltyRisk,
      ownerName: owner.name,
      ack: complianceInstanceDetails.acknowledgementNo,
      amountPaid: complianceInstanceDetails.amountPaid,
      filedByName: filer.name,
      dataReceivedOn: complianceInstanceDetails.dataReceivedOn,
      preparingSince: complianceInstanceDetails.preparingSince,
      draftDueOn: complianceInstanceDetails.draftDueOn,
      approvalDueOn: complianceInstanceDetails.approvalDueOn,
      approvedOn: complianceInstanceDetails.approvedOn,
    })
    .from(complianceInstances)
    .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
    .innerJoin(complianceObligations, eq(complianceObligations.id, complianceInstances.obligationId))
    .leftJoin(owner, eq(owner.id, complianceInstances.ownerId))
    .leftJoin(complianceInstanceDetails, eq(complianceInstanceDetails.instanceId, complianceInstances.id))
    .leftJoin(filer, eq(filer.id, complianceInstanceDetails.filedBy))
    .where(and(...conditions))
    .orderBy(asc(complianceInstances.dueDate));

  const ids = rows.map((r) => r.id);
  const proofCounts = new Map<string, number>();
  const reminders = new Map<string, string>();
  if (ids.length) {
    const pc = await db
      .select({ instanceId: complianceInstanceProofs.instanceId, n: count() })
      .from(complianceInstanceProofs)
      .where(inArray(complianceInstanceProofs.instanceId, ids))
      .groupBy(complianceInstanceProofs.instanceId);
    for (const p of pc) proofCounts.set(p.instanceId, Number(p.n));
    const rm = await db
      .select({ instanceId: complianceReminders.instanceId, remindOn: complianceReminders.remindOn })
      .from(complianceReminders)
      .where(and(eq(complianceReminders.userId, ctx.userId), inArray(complianceReminders.instanceId, ids)));
    for (const r of rm) reminders.set(r.instanceId, r.remindOn);
  }

  return rows.map((r) => {
    const name = displayName(r.particular);
    return {
      id: r.id,
      engagementId: appEngagementId(r.engagementId),
      companyName: r.companyName,
      particular: r.particular,
      name,
      area: areaOf(r.authority, r.complianceArea),
      authority: r.authority,
      authorityName: authorityName(r.authority),
      frequency: r.frequency,
      freqLabel: freqLabel(r.frequency),
      dueDate: r.dueDate,
      filedOn: r.filedOn ?? null,
      period: displayPeriod(r.periodStart, r.periodEnd, r.periodLabel, r.fyLabel),
      periodLong: periodLong(r.periodStart, r.periodEnd),
      fyLabel: r.fyLabel ?? null,
      rawStatus: r.status,
      windowFrom: r.windowFrom ?? null,
      windowTo: r.windowTo ?? null,
      penaltyRisk: r.penaltyRisk,
      ownerName: r.ownerName ?? null,
      acknowledgementNo: r.ack ?? null,
      amountPaid: r.amountPaid ?? null,
      filedByName: r.filedByName ?? null,
      dataReceivedOn: r.dataReceivedOn ?? null,
      preparingSince: r.preparingSince ?? null,
      draftDueOn: r.draftDueOn ?? null,
      approvalDueOn: r.approvalDueOn ?? null,
      approvedOn: r.approvedOn ?? null,
      proofCount: (proofCounts.get(r.id) ?? 0) + (r.evidenceUrl?.trim() ? 1 : 0),
      reminderOn: reminders.get(r.id) ?? null,
    } satisfies PortalFiling;
  });
}

/** The instance (with its engagement) if — and only if — it is inside the caller's scope. */
async function scopedInstance(ctx: AuthContext, instanceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(instanceId)) throw new ComplianceNotFoundError();
  const scope = await listScopedEngagementIds(ctx);
  if (scope.length === 0) throw new ComplianceNotFoundError();
  const [row] = await db
    .select({
      id: complianceInstances.id,
      engagementId: complianceInstances.engagementId,
      dueDate: complianceInstances.dueDate,
      filedOn: complianceInstances.filedOn,
      evidenceUrl: complianceInstances.evidenceUrl,
    })
    .from(complianceInstances)
    .where(and(eq(complianceInstances.id, instanceId), inArray(complianceInstances.engagementId, scope)))
    .limit(1);
  if (!row) throw new ComplianceNotFoundError();
  return row;
}

/* ------------------------------------------------------------------ proofs */

export interface FilingProof {
  id: string;
  fileName: string;
  mime: string | null;
  sizeBytes: number | null;
  kind: string;
  isPrimary: boolean;
  uploadedAt: string;
  uploadedBy: string | null;
  /** Legacy `compliance_instances.evidence_url` entry (external link or storage path). */
  legacy?: boolean;
}

const LEGACY_PROOF_ID = 'evidence';

export async function listFilingProofs(ctx: AuthContext, instanceId: string): Promise<FilingProof[]> {
  const inst = await scopedInstance(ctx, instanceId);
  const rows = await db
    .select({
      id: complianceInstanceProofs.id,
      fileName: complianceInstanceProofs.fileName,
      mime: complianceInstanceProofs.mime,
      sizeBytes: complianceInstanceProofs.sizeBytes,
      kind: complianceInstanceProofs.kind,
      isPrimary: complianceInstanceProofs.isPrimary,
      uploadedAt: complianceInstanceProofs.uploadedAt,
      uploadedBy: profiles.name,
    })
    .from(complianceInstanceProofs)
    .leftJoin(profiles, eq(profiles.id, complianceInstanceProofs.uploadedBy))
    .where(eq(complianceInstanceProofs.instanceId, inst.id))
    .orderBy(asc(complianceInstanceProofs.uploadedAt));
  const out: FilingProof[] = rows
    .map((r) => ({
      id: r.id,
      fileName: r.fileName,
      mime: r.mime ?? null,
      sizeBytes: r.sizeBytes ?? null,
      kind: r.kind,
      isPrimary: r.isPrimary,
      uploadedAt: r.uploadedAt.toISOString(),
      uploadedBy: r.uploadedBy ?? null,
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  if (inst.evidenceUrl?.trim()) {
    const path = inst.evidenceUrl.trim();
    out.push({
      id: LEGACY_PROOF_ID,
      fileName: decodeURIComponent(path.split('?')[0]!.split('/').pop() || 'Proof'),
      mime: /\.pdf$/i.test(path) ? 'application/pdf' : null,
      sizeBytes: null,
      kind: 'acknowledgement',
      isPrimary: out.length === 0,
      uploadedAt: inst.filedOn ? `${inst.filedOn}T00:00:00.000Z` : new Date().toISOString(),
      uploadedBy: null,
      legacy: true,
    });
  }
  return out;
}

/** Short-lived URL for one proof (preview / download). */
export async function getFilingProofUrl(
  ctx: AuthContext,
  instanceId: string,
  proofId: string,
  download = false,
): Promise<{ url: string; fileName: string }> {
  const inst = await scopedInstance(ctx, instanceId);
  if (proofId === LEGACY_PROOF_ID) {
    const path = inst.evidenceUrl?.trim();
    if (!path) throw new ComplianceNotFoundError();
    const fileName = decodeURIComponent(path.split('?')[0]!.split('/').pop() || 'Proof');
    if (/^https?:\/\//i.test(path)) return { url: path, fileName };
    return { url: await signedDownloadUrl(bucketKey('engagement-documents', path)), fileName };
  }
  const [p] = await db
    .select({ storagePath: complianceInstanceProofs.storagePath, fileName: complianceInstanceProofs.fileName })
    .from(complianceInstanceProofs)
    .where(and(eq(complianceInstanceProofs.id, proofId), eq(complianceInstanceProofs.instanceId, inst.id)))
    .limit(1);
  if (!p) throw new ComplianceNotFoundError();
  void download;
  return { url: await signedDownloadUrl(bucketKey('engagement-documents', p.storagePath)), fileName: p.fileName };
}

const MAX_PROOF_BYTES = 15 * 1024 * 1024;
const PROOF_KINDS = new Set(['acknowledgement', 'challan', 'certificate', 'other']);

export async function addFilingProof(
  ctx: AuthContext,
  instanceId: string,
  file: { name: string; type: string; bytes: Uint8Array },
  kind = 'acknowledgement',
): Promise<FilingProof> {
  if (!STAFF.has(ctx.role)) throw new ComplianceForbiddenError();
  const inst = await scopedInstance(ctx, instanceId);
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > MAX_PROOF_BYTES) throw new Error('File must be 1 byte – 15 MB');
  const safe = file.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'proof';
  const storagePath = `${inst.engagementId}/compliance-proofs/${inst.id}/${Date.now()}-${safe}`;
  await putObject(bucketKey('engagement-documents', storagePath), file.bytes, file.type || undefined);
  const [{ n }] = (await db
    .select({ n: count() })
    .from(complianceInstanceProofs)
    .where(eq(complianceInstanceProofs.instanceId, inst.id))) as [{ n: number }];
  const [row] = await db
    .insert(complianceInstanceProofs)
    .values({
      instanceId: inst.id,
      engagementId: inst.engagementId,
      storagePath,
      fileName: safe,
      mime: file.type || null,
      sizeBytes: file.bytes.byteLength,
      kind: PROOF_KINDS.has(kind) ? kind : 'other',
      isPrimary: Number(n) === 0,
      uploadedBy: ctx.userId,
    })
    .returning();
  return {
    id: row!.id,
    fileName: row!.fileName,
    mime: row!.mime,
    sizeBytes: row!.sizeBytes,
    kind: row!.kind,
    isPrimary: row!.isPrimary,
    uploadedAt: row!.uploadedAt.toISOString(),
    uploadedBy: ctx.name,
  };
}

export async function removeFilingProof(ctx: AuthContext, instanceId: string, proofId: string): Promise<void> {
  if (!STAFF.has(ctx.role)) throw new ComplianceForbiddenError();
  const inst = await scopedInstance(ctx, instanceId);
  const [p] = await db
    .delete(complianceInstanceProofs)
    .where(and(eq(complianceInstanceProofs.id, proofId), eq(complianceInstanceProofs.instanceId, inst.id)))
    .returning({ storagePath: complianceInstanceProofs.storagePath });
  if (!p) throw new ComplianceNotFoundError();
  await deleteObject(bucketKey('engagement-documents', p.storagePath)).catch(() => undefined);
}

/* ----------------------------------------------------------------- details */

export interface FilingDetailsPatch {
  acknowledgementNo?: string | null;
  amountPaid?: string | null;
  filedBy?: string | null;
  dataReceivedOn?: string | null;
  preparingSince?: string | null;
  draftDueOn?: string | null;
  approvalDueOn?: string | null;
  approvedOn?: string | null;
}

/** Staff write of the side-table facts (ARN, tax paid, filed by, focus-track dates). */
export async function upsertFilingDetails(ctx: AuthContext, instanceId: string, patch: FilingDetailsPatch): Promise<void> {
  if (!STAFF.has(ctx.role)) throw new ComplianceForbiddenError();
  const inst = await scopedInstance(ctx, instanceId);
  const values = { ...patch, updatedBy: ctx.userId, updatedAt: new Date() };
  await db
    .insert(complianceInstanceDetails)
    .values({ instanceId: inst.id, ...values })
    .onConflictDoUpdate({ target: complianceInstanceDetails.instanceId, set: values });
}

/* --------------------------------------------------------------- reminders */

export type ReminderChannel = 'email' | 'whatsapp';

/** The caller's own reminder: due − 3 days (today when the due date is closer). */
export async function setFilingReminder(
  ctx: AuthContext,
  instanceId: string,
  channels: ReminderChannel[] = ['email'],
): Promise<{ remindOn: string }> {
  const inst = await scopedInstance(ctx, instanceId);
  if (inst.filedOn) throw new Error('Already filed');
  const today = todayIso();
  const lead = addDays(inst.dueDate, -3);
  const remindOn = daysBetween(today, lead) > 0 ? lead : today;
  const ch = channels.filter((c) => c === 'email' || c === 'whatsapp');
  await db
    .insert(complianceReminders)
    .values({ instanceId: inst.id, userId: ctx.userId, remindOn, channels: ch.length ? ch : ['email'] })
    .onConflictDoUpdate({
      target: [complianceReminders.instanceId, complianceReminders.userId],
      set: { remindOn, channels: ch.length ? ch : ['email'], sentAt: null },
    });
  return { remindOn };
}

export async function clearFilingReminder(ctx: AuthContext, instanceId: string): Promise<void> {
  const inst = await scopedInstance(ctx, instanceId);
  await db
    .delete(complianceReminders)
    .where(and(eq(complianceReminders.instanceId, inst.id), eq(complianceReminders.userId, ctx.userId)));
}

/**
 * SYSTEM (Inngest only — no AuthContext): reminders whose day has come and
 * that were not sent yet, with what the email needs. Re-checks the filing is
 * still unfiled at send time.
 */
export async function systemListDueComplianceReminders(today: string) {
  return db
    .select({
      id: complianceReminders.id,
      channels: complianceReminders.channels,
      email: profiles.email,
      name: profiles.name,
      dueDate: complianceInstances.dueDate,
      periodLabel: complianceInstances.periodLabel,
      particular: complianceObligations.particular,
      companyName: engagements.companyName,
    })
    .from(complianceReminders)
    .innerJoin(profiles, eq(profiles.id, complianceReminders.userId))
    .innerJoin(complianceInstances, eq(complianceInstances.id, complianceReminders.instanceId))
    .innerJoin(complianceObligations, eq(complianceObligations.id, complianceInstances.obligationId))
    .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
    .where(
      and(
        lte(complianceReminders.remindOn, today),
        isNull(complianceReminders.sentAt),
        // removed people get no more reminders (security review L6)
        eq(profiles.status, 'active'),
        isNull(complianceInstances.filedOn),
        gte(complianceInstances.dueDate, addDays(today, -1)),
      ),
    );
}

export async function systemMarkComplianceReminderSent(id: string): Promise<void> {
  await db.update(complianceReminders).set({ sentAt: new Date() }).where(eq(complianceReminders.id, id));
}

/** "GSTR-3B · Sep 2026 is due Tue 20 Oct" — used by the reminder email. */
export function reminderLine(r: { particular: string; periodLabel: string | null; dueDate: string }): string {
  return `${displayName(r.particular)}${r.periodLabel ? ` · ${r.periodLabel}` : ''} is due ${fmtDM(r.dueDate)}`;
}

/** HTTP status for an error thrown above (routes map it; unknown errors rethrow). */
export function complianceErrorStatus(e: unknown): number | null {
  if (e instanceof ComplianceNotFoundError) return 404;
  if (e instanceof ComplianceForbiddenError) return 403;
  if (e instanceof Error && /Already filed|File must be/.test(e.message)) return 400;
  return null;
}
