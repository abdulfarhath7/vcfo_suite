import 'server-only';
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  complianceInstances,
  complianceObligations,
  complianceSubjectFields,
  documentRequestDetails,
  documentRequestFiles,
  documentRequests,
  profiles,
} from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { subjectInputs, type InputField } from '@/data/compliance-inputs';
import { requestClosedPatch } from '@/lib/metrics/trend-stamps';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { isStaff, scopeEngagement, subjectInEngagement } from '@/db/repositories/compliance-subject-scope';
import { assertEngagementAccess } from '@/db/repositories/engagements';

/**
 * COMPLIANCE INPUTS (migration 0029; C-415, C-416, C-417, C-491, C-492, C-493, S-774, S-811)
 * — what the client gives and what SBC records on one obligation period or one registration.
 *
 *  - Documents: the document requests linked to the subject (`document_request_details`
 *    subject_kind and subject_key; a registration also matches requests whose step is the
 *    registration step). The status words: Asked (open, nothing sent), To review (the client
 *    uploaded), Accepted (staff accepted), Sent back (staff asked again with a reason).
 *  - Fields: the static lists of `src/data/compliance-inputs.ts` with the values stored in
 *    `compliance_subject_fields`; side 'client' is "From the client", side 'sbc' is "Filled
 *    by SBC".
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   Reads: staff on engagements `assertEngagementAccess` allows; a client on its own
 *   engagement. Client writes: only its own client-side fields (submit details). Staff
 *   writes: SBC fields, confirming the client's details, asking for a document, and
 *   accepting or sending back an upload. A subject key of another engagement reads as not
 *   found and writes nothing; writes use the approved engagement id.
 */

export type InputsKind = 'obligation' | 'registration';
export type DocWord = 'Asked' | 'To review' | 'Accepted' | 'Sent back';

export interface SubjectDoc {
  id: string;
  label: string;
  status: DocWord;
  /** SBC's reason when the document was sent back. */
  note: string | null;
  askedOn: string;
  askedBy: string | null;
  dueOn: string | null;
  /** The current files (replaced ones left out), newest first. */
  files: Array<{ id: string; name: string; sizeBytes: number | null; uploadedAt: string }>;
}

export interface SubjectField extends InputField {
  value: string | null;
}

export interface SubjectInputsDto {
  engagementId: string;
  kind: InputsKind;
  key: string;
  docs: SubjectDoc[];
  /** Registration only: what the checklist step needs that SBC has not asked for yet. */
  needs: string[];
  client: SubjectField[];
  sbc: SubjectField[];
  submittedAt: string | null;
  submittedBy: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

export class InputsForbiddenError extends Error {
  readonly status = 403;
}

const iso = (d: Date | string | null | undefined): string | null => (d ? (d instanceof Date ? d.toISOString() : String(d)) : null);

function docWord(status: string, hasFiles: boolean, note: string | null): DocWord {
  if (status === 'approved') return 'Accepted';
  if (status === 'fulfilled' || status === 'uploaded') return 'To review';
  if (note || hasFiles) return 'Sent back';
  return 'Asked';
}

/** The static field lists of a subject, or null when the key is not a subject of the engagement. */
async function definitions(dbId: string, kind: InputsKind, key: string) {
  if (!(await subjectInEngagement(dbId, kind, key))) return null;
  if (kind === 'registration') return subjectInputs('registration', { stepId: key });
  const [row] = await db
    .select({ obligationId: complianceInstances.obligationId, area: complianceObligations.complianceArea })
    .from(complianceInstances)
    .leftJoin(complianceObligations, eq(complianceObligations.id, complianceInstances.obligationId))
    .where(and(eq(complianceInstances.id, key), eq(complianceInstances.engagementId, dbId)))
    .limit(1);
  if (!row) return null;
  return subjectInputs('obligation', { obligationId: row.obligationId, complianceArea: row.area });
}

function subjectMatch(dbId: string, kind: InputsKind, key: string) {
  const own = and(eq(documentRequestDetails.subjectKind, kind), eq(documentRequestDetails.subjectKey, key));
  return and(
    eq(documentRequests.engagementId, dbId),
    ne(documentRequests.status, 'cancelled'),
    kind === 'registration' ? or(own, and(isNull(documentRequestDetails.subjectKind), eq(documentRequestDetails.stepId, key))) : own,
  );
}

/** Documents and fields of one subject; null when out of scope or not a subject of the engagement. */
export async function getSubjectInputs(
  ctx: AuthContext,
  input: { engagementId?: string | null; kind: InputsKind; key: string },
): Promise<SubjectInputsDto | null> {
  const scope = await scopeEngagement(ctx, input.engagementId);
  if (!scope) return null;
  const defs = await definitions(scope.dbId, input.kind, input.key);
  if (!defs) return null;

  const reqRows = await db
    .select({
      id: documentRequests.id,
      title: documentRequests.title,
      status: documentRequests.status,
      createdAt: documentRequests.createdAt,
      askedBy: profiles.name,
      dueOn: documentRequestDetails.dueOn,
      note: documentRequestDetails.reviewNote,
    })
    .from(documentRequests)
    .innerJoin(documentRequestDetails, eq(documentRequestDetails.requestId, documentRequests.id))
    .leftJoin(profiles, eq(profiles.id, documentRequests.requestedBy))
    .where(subjectMatch(scope.dbId, input.kind, input.key))
    .orderBy(documentRequests.createdAt);
  const ids = reqRows.map((r) => r.id);
  const files = ids.length
    ? await db
        .select({
          id: documentRequestFiles.id,
          requestId: documentRequestFiles.requestId,
          name: documentRequestFiles.fileName,
          sizeBytes: documentRequestFiles.sizeBytes,
          uploadedAt: documentRequestFiles.uploadedAt,
          replacedAt: documentRequestFiles.replacedAt,
        })
        .from(documentRequestFiles)
        .where(and(inArray(documentRequestFiles.requestId, ids), eq(documentRequestFiles.engagementId, scope.dbId)))
        .orderBy(desc(documentRequestFiles.uploadedAt))
    : [];
  const docs: SubjectDoc[] = reqRows.map((r) => {
    const mine = files.filter((f) => f.requestId === r.id);
    const current = mine.filter((f) => !f.replacedAt);
    const note = r.note?.trim() || null;
    const status = docWord(r.status, mine.length > 0, note);
    return {
      id: r.id,
      label: r.title,
      status,
      note: status === 'Sent back' ? note : null,
      askedOn: iso(r.createdAt)!,
      askedBy: r.askedBy ?? null,
      dueOn: r.dueOn ?? null,
      files: (status === 'Sent back' ? [] : current).map((f) => ({ id: f.id, name: f.name, sizeBytes: f.sizeBytes ?? null, uploadedAt: iso(f.uploadedAt)! })),
    };
  });

  const values = await db
    .select({
      fieldKey: complianceSubjectFields.fieldKey,
      side: complianceSubjectFields.side,
      value: complianceSubjectFields.value,
      submittedAt: complianceSubjectFields.submittedAt,
      confirmedAt: complianceSubjectFields.confirmedAt,
      updatedBy: complianceSubjectFields.updatedBy,
      confirmedBy: complianceSubjectFields.confirmedBy,
    })
    .from(complianceSubjectFields)
    .where(
      and(
        eq(complianceSubjectFields.engagementId, scope.dbId),
        eq(complianceSubjectFields.subjectKind, input.kind),
        eq(complianceSubjectFields.subjectKey, input.key),
      ),
    );
  const byKey = new Map(values.map((v) => [`${v.side}:${v.fieldKey}`, v]));
  const fill = (side: 'client' | 'sbc', list: InputField[]): SubjectField[] => list.map((d) => ({ ...d, value: byKey.get(`${side}:${d.key}`)?.value ?? null }));
  const clientRows = values.filter((v) => v.side === 'client');
  const submitted = clientRows.map((v) => v.submittedAt).filter(Boolean).sort().at(-1) ?? null;
  const confirmedRow = clientRows.filter((v) => v.confirmedAt).sort((a, b) => String(a.confirmedAt).localeCompare(String(b.confirmedAt))).at(-1);
  const submitter = clientRows.find((v) => v.submittedAt && iso(v.submittedAt) === iso(submitted))?.updatedBy ?? null;
  const people = [submitter, confirmedRow?.confirmedBy].filter((x): x is string => Boolean(x));
  const names = people.length ? await db.select({ id: profiles.id, name: profiles.name }).from(profiles).where(inArray(profiles.id, people)) : [];
  const nameOf = (id: string | null | undefined) => (id ? names.find((n) => n.id === id)?.name ?? null : null);

  const asked = new Set(docs.map((d) => d.label.trim().toLowerCase()));
  const needs = input.kind === 'registration' ? (getItem(input.key)?.infoRequired ?? []).filter((n) => !asked.has(n.trim().toLowerCase())) : [];

  return {
    engagementId: appEngagementId(scope.dbId),
    kind: input.kind,
    key: input.key,
    docs,
    needs,
    client: fill('client', defs.client),
    sbc: fill('sbc', defs.sbc),
    submittedAt: iso(submitted),
    submittedBy: nameOf(submitter),
    confirmedAt: iso(confirmedRow?.confirmedAt),
    confirmedBy: nameOf(confirmedRow?.confirmedBy),
  };
}

/**
 * Save field values. A client saves only its own client-side fields and each save is a
 * submit (it also clears an earlier confirmation); staff save either side. Unknown keys are
 * refused. Returns false when out of scope.
 */
export async function saveSubjectFields(
  ctx: AuthContext,
  input: { engagementId?: string | null; kind: InputsKind; key: string; side: 'client' | 'sbc'; values: Record<string, string | null> },
): Promise<boolean> {
  if (ctx.role === 'client' && input.side !== 'client') throw new InputsForbiddenError('Clients fill only their own details');
  if (ctx.role !== 'client' && !isStaff(ctx)) throw new InputsForbiddenError('Not allowed');
  const scope = await scopeEngagement(ctx, input.engagementId);
  if (!scope) return false;
  const defs = await definitions(scope.dbId, input.kind, input.key);
  if (!defs) return false;
  const allowed = new Set((input.side === 'client' ? defs.client : defs.sbc).map((d) => d.key));
  const entries = Object.entries(input.values).filter(([k]) => allowed.has(k));
  if (!entries.length) return false;
  const now = new Date();
  const byClient = ctx.role === 'client';
  for (const [fieldKey, raw] of entries) {
    const value = typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 500) : null;
    const set = {
      value,
      updatedBy: ctx.userId,
      updatedAt: now,
      ...(byClient ? { submittedAt: now, confirmedAt: null, confirmedBy: null } : {}),
    };
    await db
      .insert(complianceSubjectFields)
      .values({ engagementId: scope.dbId, subjectKind: input.kind, subjectKey: input.key, fieldKey, side: input.side, ...set })
      .onConflictDoUpdate({
        target: [complianceSubjectFields.engagementId, complianceSubjectFields.subjectKind, complianceSubjectFields.subjectKey, complianceSubjectFields.fieldKey],
        set,
      });
  }
  return true;
}

/** Staff confirm the client's submitted details ("Confirmed by"). */
export async function confirmSubjectFields(ctx: AuthContext, input: { engagementId: string; kind: InputsKind; key: string }): Promise<boolean> {
  if (!isStaff(ctx)) throw new InputsForbiddenError('Only firm staff confirm details');
  const scope = await scopeEngagement(ctx, input.engagementId);
  if (!scope) return false;
  if (!(await subjectInEngagement(scope.dbId, input.kind, input.key))) return false;
  await db
    .update(complianceSubjectFields)
    .set({ confirmedBy: ctx.userId, confirmedAt: new Date() })
    .where(
      and(
        eq(complianceSubjectFields.engagementId, scope.dbId),
        eq(complianceSubjectFields.subjectKind, input.kind),
        eq(complianceSubjectFields.subjectKey, input.key),
        eq(complianceSubjectFields.side, 'client'),
      ),
    );
  return true;
}

/** Staff ask the client for a document on the subject. Returns the new request id. */
export async function askSubjectDocument(
  ctx: AuthContext,
  input: { engagementId: string; kind: InputsKind; key: string; label: string; dueOn?: string | null },
): Promise<string | null> {
  if (!isStaff(ctx)) throw new InputsForbiddenError('Only firm staff ask for documents');
  const scope = await scopeEngagement(ctx, input.engagementId);
  if (!scope) return null;
  if (!(await subjectInEngagement(scope.dbId, input.kind, input.key))) return null;
  const label = input.label.trim().slice(0, 200);
  if (!label) return null;
  const dueOn = input.dueOn && /^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) ? input.dueOn : null;
  const stepId = input.kind === 'registration' && getItem(input.key) ? input.key : null;
  return db.transaction(async (tx) => {
    const [req] = await tx
      .insert(documentRequests)
      .values({ engagementId: scope.dbId, requestedBy: ctx.userId, title: label, status: 'pending' })
      .returning({ id: documentRequests.id });
    await tx.insert(documentRequestDetails).values({
      requestId: req!.id,
      engagementId: scope.dbId,
      dueOn,
      stepId,
      subjectKind: input.kind,
      subjectKey: input.key,
    });
    return req!.id;
  });
}

/** Staff accept an upload, or send it back with a reason. False when out of scope or not reviewable. */
export async function reviewSubjectDocument(
  ctx: AuthContext,
  input: { requestId: string; action: 'accept' | 'send-back'; reason?: string | null },
): Promise<boolean> {
  if (!isStaff(ctx)) throw new InputsForbiddenError('Only firm staff review documents');
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId)) return false;
  const [req] = await db.select().from(documentRequests).where(eq(documentRequests.id, input.requestId)).limit(1);
  if (!req) return false;
  const access = await assertEngagementAccess(ctx, req.engagementId);
  if (!access.ok) return false;
  if (input.action === 'accept') {
    if (req.status !== 'fulfilled') return false;
    await db
      .update(documentRequests)
      .set({ status: 'approved', ...requestClosedPatch(req.status, 'approved') })
      .where(and(eq(documentRequests.id, req.id), eq(documentRequests.engagementId, access.dbId)));
    return true;
  }
  const reason = input.reason?.trim().slice(0, 500);
  if (!reason) return false;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(documentRequests)
      .set({ status: 'pending', ...requestClosedPatch(req.status, 'pending') })
      .where(and(eq(documentRequests.id, req.id), eq(documentRequests.engagementId, access.dbId)));
    await tx
      .insert(documentRequestDetails)
      .values({ requestId: req.id, engagementId: access.dbId, reviewNote: reason, reviewNoteBy: ctx.userId, updatedAt: now })
      .onConflictDoUpdate({ target: documentRequestDetails.requestId, set: { reviewNote: reason, reviewNoteBy: ctx.userId, updatedAt: now } });
  });
  return true;
}
