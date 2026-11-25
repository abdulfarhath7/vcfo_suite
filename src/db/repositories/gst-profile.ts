import 'server-only';
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceSubjectFields, documentRequestDetails, documentRequestFiles, documentRequests, documents } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { getDocPackInputs, type DocPackInputs } from '@/db/repositories/doc-pack';
import { documentStorageKey } from '@/db/repositories/documents';
import { signedDownloadUrl } from '@/storage/s3';
import { buildGstProfile, type GstRequestFile } from '@/lib/registrations/gst-profile-build';
import { GST_DOCUMENT_URL_SECONDS, type GstDocument, type GstDocumentRef, type GstProfileResult } from '@/lib/registrations/gst-profile';
import { GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import { engagementIdAliases } from '@/lib/projects/legacy-engagement-ids';

/**
 * GST REG-01 PROFILE REPOSITORY — reads what the GST application needs for one engagement and
 * hands it to the pure builder (`src/lib/registrations/gst-profile-build.ts`).
 *
 * >>> ACCESS CONTROL <<<
 *   The same rule as the VCFO Assist profile (`getDocPackInputs`): firm staff only, a lead or a
 *   manager only on engagements they are on, the admins on every engagement, a client never. An
 *   engagement out of reach answers 404 or 403 before anything else is read. Every later read is
 *   scoped by the approved engagement id. Nothing is written here.
 */

export type GstProfileLoad =
  | {
      ok: true;
      inputs: DocPackInputs;
      result: GstProfileResult;
      /** The reg-4 field values the profile was built from (the tracker is the SBC side). */
      values: { client: Record<string, string | null>; sbc: Record<string, string | null>; unconfirmed: string[] };
    }
  | { ok: false; status: 403 | 404; error: 'forbidden' | 'not_found' };

/**
 * The reg-4 values, and the client-side keys the client entered that staff have not confirmed: a
 * client's save stamps `submitted_at` and `updated_at` together and clears the confirmation, so a
 * row whose last write was the client's own and has no `confirmed_at` waits for the lead. A value
 * staff wrote (on the card or from Ask VCFO) is theirs and needs no confirmation.
 */
async function reg4Values(dbId: string): Promise<{ client: Record<string, string | null>; sbc: Record<string, string | null>; unconfirmed: string[] }> {
  const rows = await db
    .select({
      side: complianceSubjectFields.side,
      key: complianceSubjectFields.fieldKey,
      value: complianceSubjectFields.value,
      submittedAt: complianceSubjectFields.submittedAt,
      updatedAt: complianceSubjectFields.updatedAt,
      confirmedAt: complianceSubjectFields.confirmedAt,
    })
    .from(complianceSubjectFields)
    .where(
      and(
        eq(complianceSubjectFields.engagementId, dbId),
        eq(complianceSubjectFields.subjectKind, 'registration'),
        eq(complianceSubjectFields.subjectKey, GST_STEP_ID),
      ),
    );
  const client: Record<string, string | null> = {};
  const sbc: Record<string, string | null> = {};
  const unconfirmed: string[] = [];
  for (const r of rows) {
    (r.side === 'client' ? client : sbc)[r.key] = r.value;
    const byClient = r.submittedAt && r.updatedAt && r.submittedAt.getTime() === r.updatedAt.getTime();
    if (r.side === 'client' && r.value?.trim() && byClient && !r.confirmedAt) unconfirmed.push(r.key);
  }
  return { client, sbc, unconfirmed };
}

/** Current files on the GST step's document requests (asked on the subject or on the step). */
async function reg4RequestFiles(dbId: string): Promise<GstRequestFile[]> {
  const requests = await db
    .select({ id: documentRequests.id, title: documentRequests.title })
    .from(documentRequests)
    .innerJoin(documentRequestDetails, eq(documentRequestDetails.requestId, documentRequests.id))
    .where(
      and(
        eq(documentRequests.engagementId, dbId),
        ne(documentRequests.status, 'cancelled'),
        or(
          and(eq(documentRequestDetails.subjectKind, 'registration'), eq(documentRequestDetails.subjectKey, GST_STEP_ID)),
          and(isNull(documentRequestDetails.subjectKind), eq(documentRequestDetails.stepId, GST_STEP_ID)),
        ),
      ),
    );
  if (!requests.length) return [];
  const title = new Map(requests.map((r) => [r.id, r.title]));
  const files = await db
    .select({
      requestId: documentRequestFiles.requestId,
      objectKey: documentRequestFiles.objectKey,
      fileName: documentRequestFiles.fileName,
      contentType: documentRequestFiles.contentType,
      sizeBytes: documentRequestFiles.sizeBytes,
    })
    .from(documentRequestFiles)
    .where(
      and(
        inArray(documentRequestFiles.requestId, [...title.keys()]),
        eq(documentRequestFiles.engagementId, dbId),
        isNull(documentRequestFiles.replacedAt),
      ),
    )
    .orderBy(desc(documentRequestFiles.uploadedAt));
  return files.map((f) => ({
    source: 'request' as const,
    label: title.get(f.requestId) ?? f.fileName,
    fileName: f.fileName,
    contentType: f.contentType ?? null,
    sizeBytes: f.sizeBytes ?? null,
    objectKey: f.objectKey,
  }));
}

/** Vault folders that can hold a GST paper: rent deeds, bank letters, address proofs, NOCs. */
const VAULT_CATEGORIES = ['Contracts', 'Bank', 'Address proof', 'Letters', 'Registrations'];

/** Current files in the engagement's document vault, in the folders a GST paper is filed under. */
async function vaultFiles(dbId: string): Promise<GstRequestFile[]> {
  const rows = await db
    .select({ category: documents.category, fileName: documents.fileName, objectKey: documents.objectKey, contentType: documents.contentType, sizeBytes: documents.sizeBytes })
    .from(documents)
    .where(and(eq(documents.engagementId, dbId), isNull(documents.deletedAt), isNull(documents.replacedAt), inArray(documents.category, VAULT_CATEGORIES)))
    .orderBy(desc(documents.createdAt))
    .limit(200);
  return rows.map((r) => ({
    label: `${r.category ?? 'Documents'}: ${r.fileName}`,
    source: 'vault' as const,
    fileName: r.fileName,
    contentType: r.contentType ?? null,
    sizeBytes: r.sizeBytes ?? null,
    objectKey: r.objectKey,
  }));
}

/** The GST REG-01 profile and its readiness, for a caller already through a staff guard. */
export async function getGstProfile(ctx: AuthContext, engagementParam: string): Promise<GstProfileLoad> {
  const access = await getDocPackInputs(ctx, engagementParam);
  if (access.ok === false) return access;
  const { inputs } = access;
  const [values, requestFiles, vault] = await Promise.all([reg4Values(inputs.dbId), reg4RequestFiles(inputs.dbId), vaultFiles(inputs.dbId)]);
  const e = inputs.engagement;
  const result = buildGstProfile({
    engagement: { id: e.id, slug: e.slug ?? null, companyName: e.companyName, entityLegalForm: e.entityLegalForm ?? null, incorporationDate: e.incorporationDate ?? null },
    state: inputs.checklistState,
    client: values.client,
    sbc: values.sbc,
    requestFiles: [...requestFiles, ...vault],
    unconfirmed: values.unconfirmed,
  });
  return { ok: true, inputs, result, values };
}

/**
 * Short-lived signed URLs for the profile's documents, for the extension to upload on the portal.
 * A file that cannot be signed is left out (and the caller lists it as missing); the storage
 * key itself never leaves the server.
 */
export async function signGstDocuments(refs: GstDocumentRef[], now = new Date()): Promise<{ documents: GstDocument[]; unsigned: string[] }> {
  const expiresAt = new Date(now.getTime() + GST_DOCUMENT_URL_SECONDS * 1000).toISOString();
  const documents: GstDocument[] = [];
  const unsigned: string[] = [];
  for (const ref of refs) {
    const { storageKey, ...rest } = ref;
    try {
      documents.push({ ...rest, url: await signedDownloadUrl(documentStorageKey(storageKey), GST_DOCUMENT_URL_SECONDS), expiresAt });
    } catch (error) {
      console.error('[gst-profile] could not sign', ref.key, error instanceof Error ? error.message : error);
      unsigned.push(ref.key);
    }
  }
  return { documents, unsigned };
}

/**
 * The storage key of one GST document (`company.coi`, `promoter.2.photo`, `place.proof`, …) for
 * the VCFO Assist attachments route, under the same access rule as the profile. A checklist path
 * is typed text, so it must sit under this engagement's own id; request and vault files come from
 * rows already scoped to the engagement.
 */
export async function gstDocumentStorageKey(
  ctx: AuthContext,
  engagementParam: string,
  key: string,
): Promise<{ ok: true; dbId: string; label: string; storageKey: string } | { ok: false; status: 403 | 404; error: 'forbidden' | 'not_found' | 'no_file' }> {
  const loaded = await getGstProfile(ctx, engagementParam);
  if (loaded.ok === false) return loaded;
  const ref = loaded.result.documents.find((d) => d.key === key);
  if (!ref) return { ok: false, status: 404, error: 'no_file' };
  const storageKey = documentStorageKey(ref.storageKey);
  const dbId = loaded.inputs.dbId;
  const own = engagementIdAliases(dbId).some((id) => storageKey.includes(`/${id}/`));
  if (storageKey.includes('..') || (ref.source === 'checklist' && !own)) return { ok: false, status: 404, error: 'no_file' };
  return { ok: true, dbId, label: ref.label, storageKey };
}
