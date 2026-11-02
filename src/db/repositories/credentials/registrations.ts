import 'server-only';
import { and, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { documents, engagementCredentials, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { checklistStateForViewer, listScopedEngagementIds } from '@/db/repositories/engagements';
import { normalizeEngagementChecklistState } from '@/lib/checklist/checklist-state-key';
import { checklistViewerForRole, isStepReleasedTo } from '@/lib/checklist/checklist-visibility';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { ENGAGEMENT_DOCUMENTS_BUCKET } from '@/lib/board-resolution/board-resolution-storage';
import { MILESTONE_DOCUMENTS_BUCKET, isMilestoneStoragePath } from '@/lib/documents/milestone-document-storage';
import {
  REGISTRATION_ANSWER_FIELDS,
  RENEWAL_FIELDS,
  buildRegistrationFacts,
  isRegistrationStep,
  rowKeyForStep,
  type CertificateSource,
  type RegistrationDocument,
  type RegistrationFactsMap,
} from '@/lib/registrations/registration-facts';
import { getRegistrationPhases } from '@/data/checklist';
import { bucketKey, signedDownloadUrl, type StorageBucket } from '@/storage/s3';
import { CredentialsError, resolveAccess } from './access';

/**
 * REGISTRATIONS (G-05, G-06) — the registration numbers, dates, certificates and renewal
 * dates of the registration-phase steps, read from the credentials workbook's "reg" rows
 * and the registration steps' answers.
 *
 * >>> ACCESS CONTROL (Path A, as the rest of the credentials repository) <<<
 *   client — its own engagement only (`resolveAccess`); reads, never writes. Step answers
 *            are redacted for the client viewer and documents must be shared with it.
 *   intern / manager — engagements in `listScopedEngagementIds(ctx)` for the list, and
 *            `assertEngagementAccess` (through `resolveAccess`) for one engagement.
 *   admin / super_admin — firm-wide.
 *   any other role (developer) — nothing, before the first query.
 * Only `fields` of the reg rows are read; the secret ciphertext never is, so these reads
 * work without the credentials encryption key. Every write and every certificate download
 * records an audit event.
 *
 * The cross-engagement read does not load whole checklist states: the SQL keeps only the
 * `reg-*` step slices, drops their notes, and keeps only the answer fields that hold a
 * number, a date, a certificate or an expiry.
 */

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);
const READERS = new Set([...STAFF, 'client']);

const SAFE_FIELD = /^[A-Za-z0-9_]+$/;
const ANSWER_FIELDS = sql.raw(
  `ARRAY[${REGISTRATION_ANSWER_FIELDS.filter((f) => SAFE_FIELD.test(f))
    .map((f) => `'${f}'`)
    .join(',')}]::text[]`,
);

/** The `reg-*` slices of `checklist_state`, minus notes and every answer but the facts. */
const registrationStateSql = sql<Record<string, unknown>>`
  CASE WHEN jsonb_typeof(${engagements.checklistState}) = 'object' THEN COALESCE(
    (
      SELECT jsonb_object_agg(
        kv.key,
        (kv.value - 'responses' - 'notes') || jsonb_build_object(
          'responses',
          COALESCE(
            (
              SELECT jsonb_object_agg(r.key, r.value)
              FROM jsonb_each(
                CASE WHEN jsonb_typeof(kv.value -> 'responses') = 'object' THEN kv.value -> 'responses' ELSE '{}'::jsonb END
              ) AS r
              WHERE r.key = ANY(${ANSWER_FIELDS})
            ),
            '{}'::jsonb
          )
        )
      )
      FROM jsonb_each(${engagements.checklistState}) AS kv
      WHERE kv.key LIKE 'reg-%' AND jsonb_typeof(kv.value) = 'object'
    ),
    '{}'::jsonb
  ) ELSE '{}'::jsonb END
`;

interface Built {
  facts: RegistrationFactsMap;
  certificates: Record<string, CertificateSource>;
}

/** Load and build the facts for the given engagement db ids (already scoped by the caller). */
async function buildFor(ctx: AuthContext, dbIds: string[]): Promise<Map<string, Built>> {
  const out = new Map<string, Built>();
  if (dbIds.length === 0) return out;
  const viewer = checklistViewerForRole(ctx.role);

  const states = await db
    .select({ id: engagements.id, reg: registrationStateSql })
    .from(engagements)
    .where(inArray(engagements.id, dbIds));
  const stored = await db
    .select({ engagementId: engagementCredentials.engagementId, rowKey: engagementCredentials.rowKey, fields: engagementCredentials.fields })
    .from(engagementCredentials)
    .where(and(inArray(engagementCredentials.engagementId, dbIds), eq(engagementCredentials.sheet, 'reg')));
  // Deleted documents (documents.deleted_at) are left out of the registration facts.
  const docConds = [inArray(documents.engagementId, dbIds), like(documents.stepId, 'reg-%'), isNull(documents.deletedAt)];
  if (ctx.role === 'client') docConds.push(eq(documents.sharedWithClient, true));
  const docs = await db
    .select({
      engagementId: documents.engagementId,
      stepId: documents.stepId,
      fileName: documents.fileName,
      objectKey: documents.objectKey,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(...docConds))
    .orderBy(desc(documents.createdAt));

  for (const row of states) {
    const raw = row.reg && typeof row.reg === 'object' && !Array.isArray(row.reg) ? row.reg : {};
    const state = checklistStateForViewer(ctx, normalizeEngagementChecklistState(raw as Record<string, unknown>));
    const storedByRow: Record<string, Record<string, string>> = {};
    for (const s of stored) if (s.engagementId === row.id) storedByRow[s.rowKey] = s.fields ?? {};
    const docsHere: RegistrationDocument[] = docs
      .filter((d) => d.engagementId === row.id && d.stepId && isStepReleasedTo(viewer, state[d.stepId], d.stepId))
      .map((d) => ({ stepId: d.stepId!, fileName: d.fileName, objectKey: d.objectKey, createdAt: d.createdAt }));
    const built = buildRegistrationFacts({ state, stored: storedByRow, documents: docsHere });
    // A step upload must sit under this engagement's own folder; anything else is ignored.
    for (const [stepId, src] of Object.entries(built.certificates)) {
      if (src.kind !== 'step') continue;
      const owner = src.path.split('/')[0] ?? '';
      if (!isMilestoneStoragePath(src.path) || (owner !== row.id && owner !== appEngagementId(row.id))) {
        delete built.certificates[stepId];
        const f = built.facts[stepId];
        if (f?.certificate) f.certificate = { ...f.certificate, downloadable: false };
      }
    }
    out.set(row.id, built);
  }
  return out;
}

/**
 * Registration facts by app engagement id, then by step id. A client always gets its own
 * engagement; staff get one engagement with `engagementId`, or every engagement in their
 * scope without it (the staff Registrations list, G-06).
 */
export async function listRegistrationFacts(
  ctx: AuthContext,
  opts: { engagementId?: string | null } = {},
): Promise<Record<string, RegistrationFactsMap>> {
  if (!READERS.has(ctx.role)) return {};
  let ids: string[];
  if (ctx.role === 'client' || opts.engagementId) {
    const acc = await resolveAccess(ctx, opts.engagementId);
    ids = [acc.dbId];
  } else {
    ids = await listScopedEngagementIds(ctx);
    if (ids.length === 0) return {};
  }
  const built = await buildFor(ctx, ids);
  const out: Record<string, RegistrationFactsMap> = {};
  for (const [dbId, b] of built) out[appEngagementId(dbId)] = b.facts;
  return out;
}

export interface RegistrationDatesInput {
  engagementId: string;
  stepId: string;
  issuedOn: string | null;
  expiresOn: string | null;
  renewEveryMonths: number | null;
}

function titleOf(stepId: string): string {
  return getRegistrationPhases().flatMap((p) => p.items).find((i) => i.id === stepId)?.title ?? stepId;
}

/**
 * Staff set the issue date, expiry and renewal period of one registration. The values
 * merge into the reg row's `fields` (a null clears that field); other cells and the secret
 * ciphertext are left as they are. Clients and other roles are refused.
 */
export async function setRegistrationDates(ctx: AuthContext, input: RegistrationDatesInput): Promise<RegistrationFactsMap> {
  if (!STAFF.has(ctx.role)) throw new CredentialsError('forbidden', 403);
  if (!isRegistrationStep(input.stepId)) throw new CredentialsError('invalid_step', 400);
  const rowKey = rowKeyForStep(input.stepId)!;
  const acc = await resolveAccess(ctx, input.engagementId);
  if (!acc.staff) throw new CredentialsError('forbidden', 403);

  const set: Record<string, string> = {};
  if (input.issuedOn) set.issuedOn = input.issuedOn;
  if (input.expiresOn) set.expiresOn = input.expiresOn;
  if (input.renewEveryMonths) set.renewEveryMonths = String(input.renewEveryMonths);
  const json = JSON.stringify(set);

  await db
    .insert(engagementCredentials)
    .values({ engagementId: acc.dbId, sheet: 'reg', rowKey, fields: set, edited: {}, updatedBy: ctx.userId })
    .onConflictDoUpdate({
      target: [engagementCredentials.engagementId, engagementCredentials.sheet, engagementCredentials.rowKey],
      set: {
        fields: sql`(${engagementCredentials.fields} - ${sql.raw(RENEWAL_FIELDS.map((f) => `'${f}'`).join(' - '))}) || ${json}::jsonb`,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });

  const parts = [
    input.issuedOn ? `issued ${input.issuedOn}` : null,
    input.expiresOn ? `expires ${input.expiresOn}` : null,
    input.renewEveryMonths ? `renews every ${input.renewEveryMonths} months` : null,
  ].filter(Boolean);
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'registrations.dates_updated',
    summary: parts.length ? `set the renewal dates of ${titleOf(input.stepId)} (${parts.join(', ')})` : `cleared the renewal dates of ${titleOf(input.stepId)}`,
    metadata: { stepId: input.stepId, rowKey, ...set },
  });

  const built = await buildFor(ctx, [acc.dbId]);
  return built.get(acc.dbId)?.facts ?? {};
}

function storageOf(objectKey: string): { bucket: StorageBucket; path: string } {
  const clean = objectKey.replace(/^\/+/, '');
  if (clean.startsWith(`${MILESTONE_DOCUMENTS_BUCKET}/`)) return { bucket: MILESTONE_DOCUMENTS_BUCKET, path: clean.slice(MILESTONE_DOCUMENTS_BUCKET.length + 1) };
  if (clean.startsWith(`${ENGAGEMENT_DOCUMENTS_BUCKET}/`)) return { bucket: ENGAGEMENT_DOCUMENTS_BUCKET, path: clean.slice(ENGAGEMENT_DOCUMENTS_BUCKET.length + 1) };
  if (isMilestoneStoragePath(clean)) return { bucket: MILESTONE_DOCUMENTS_BUCKET, path: clean };
  return { bucket: ENGAGEMENT_DOCUMENTS_BUCKET, path: clean };
}

/**
 * A short-lived download URL for one registration's certificate: the step's own upload
 * first, else the newest document filed against the step that the caller may read.
 * Throws `not_found` when there is no file the caller can open.
 */
export async function getRegistrationCertificateUrl(
  ctx: AuthContext,
  input: { engagementId?: string | null; stepId: string },
): Promise<{ url: string; fileName: string }> {
  if (!READERS.has(ctx.role)) throw new CredentialsError('forbidden', 403);
  if (!isRegistrationStep(input.stepId)) throw new CredentialsError('invalid_step', 400);
  const acc = await resolveAccess(ctx, input.engagementId);
  const built = await buildFor(ctx, [acc.dbId]);
  const src = built.get(acc.dbId)?.certificates[input.stepId];
  if (!src) throw new CredentialsError('not_found', 404);
  const { bucket, path } = src.kind === 'step' ? { bucket: MILESTONE_DOCUMENTS_BUCKET as StorageBucket, path: src.path } : storageOf(src.objectKey);
  const url = await signedDownloadUrl(bucketKey(bucket, path), 900);
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'registrations.certificate_downloaded',
    summary: `opened the ${titleOf(input.stepId)} certificate`,
    metadata: { stepId: input.stepId },
  });
  return { url, fileName: src.name };
}
