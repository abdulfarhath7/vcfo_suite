import 'server-only';

import { createHash } from 'node:crypto';
import type { AuthContext } from '@/auth/guards';
import { findByCacheKey, listVerifications, recordDocument } from '@/db/repositories/labour-registers';
import { draftKey, GENERATOR_REVISION, hashRows, type AssumptionSet, type DocumentIdentity } from '@/lib/labour-registers/cache-key';
import { signatoriesFor } from '@/data/labour-registers/signatories';
import { retentionYears } from '@/lib/labour-registers/catalogue';
import { ProjectionError, projectForm, type ProjectedTable } from '@/lib/labour-registers/project';
import { documentFileName, documentObjectKey, periodLabel } from '@/lib/labour-registers/storage';
import { isBuilt } from '@/lib/labour-registers/xlsx/layouts';
import { renderRegisterPdf } from '@/lib/labour-registers/pdf/render-register';
import { renderForForm } from '@/lib/labour-registers/xlsx/renderers';
import { templateVersionFor } from '@/lib/labour-registers/xlsx/version';
import { resolveVerification, verificationIndex } from '@/lib/labour-registers/verification';
import { loadBatchDataset } from '@/lib/labour-registers/load-dataset';
import { EXTENSION_TO_MIME } from '@/lib/upload-limits';
import { putObject } from '@/storage/s3';

export interface GenerateInput {
  batchId: string;
  /** Build only these forms. Left out, everything the period calls for. */
  formIds?: string[];
  /** The establishment name to print, where the caller knows it. */
  companyName?: string;
  /** Which files to produce. The workbook alone, by default. */
  formats?: Array<'xlsx' | 'pdf'>;
}

export type GenerateOutcome =
  | { kind: 'not_found' }
  | { kind: 'not_ready' }
  | {
      kind: 'done';
      documents: Array<{ formId: string; documentId: string; fileName: string; format: string; built: boolean }>;
      blocked: Array<{ formId: string; reason: string }>;
      deferred: Array<{ formId: string; reason: string }>;
      suppressed: Array<{ formId: string; reason: string }>;
    };

/** Builds a closed period's registers, the same for the screen's button and for a card. */
export async function generateRegisters(ctx: AuthContext, input: GenerateInput): Promise<GenerateOutcome> {
  const loaded = await loadBatchDataset(ctx, input.batchId, { companyName: input.companyName });
  if (!loaded) return { kind: 'not_found' };

  const { batch, period, forms, dataset, sources } = loaded;
  if (!batch.markedReadyAt) return { kind: 'not_ready' };

  const wanted = input.formIds ? new Set(input.formIds) : null;
  const formats = input.formats ?? ['xlsx'];
  const assumptions = (batch.assumptions ?? { fullAttendanceAssumed: false }) as AssumptionSet;
  const generatedAt = new Date().toISOString();
  const label = periodLabel(period);

  /* The firm's own verdicts, read once for the whole batch. A form with no row keeps the
     catalogue's claim, which is the common case and costs nothing. */
  const verdicts = verificationIndex(await listVerifications(ctx));

  const documents: Array<{ formId: string; documentId: string; fileName: string; format: string; built: boolean }> = [];
  const blocked: Array<{ formId: string; reason: string }> = [];
  const deferred: Array<{ formId: string; reason: string }> = [];
  const suppressed: Array<{ formId: string; reason: string }> = [];

  for (const form of forms) {
    if (wanted && !wanted.has(form.id)) continue;
    if (!isBuilt(form.archetype)) {
      deferred.push({ formId: form.id, reason: `The ${form.archetype} archetype is not built yet.` });
      continue;
    }

    /* The firm has decided this register is not one it owes. Reported rather than skipped
       silently: a gap in an act's folder that nobody can account for is worse than a line
       saying who decided it was not needed and why. */
    const verdict = resolveVerification(form, verdicts);
    if (verdict.suppressed) {
      suppressed.push({
        formId: form.id,
        reason: verdict.suppressedReason || 'The firm has recorded that this register does not apply.',
      });
      continue;
    }

    let table: ProjectedTable;
    try {
      table = projectForm(form, dataset);
    } catch (e) {
      if (e instanceof ProjectionError) {
        blocked.push({ formId: form.id, reason: e.message });
        continue;
      }
      throw e;
    }

    /* The content address, over this form's own rows. `hashRows` sorts the field list itself,
       so the order columns happen to be in cannot change the key. */
    const fields = table.columns.map((c) => (c.day === undefined ? c.field : `day-${c.day}`));
    const rowObjects = table.rows.map((values) =>
      Object.fromEntries(values.map((v, i) => [fields[i], v])),
    );

    const identity: DocumentIdentity = {
      engagementId: batch.engagementId,
      jurisdiction: form.jurisdiction,
      formId: form.id,
      period: period.from.slice(0, 7) === period.to.slice(0, 7) ? period.from.slice(0, 7) : `${period.from}..${period.to}`,
      inputsHash: hashRows(rowObjects, fields),
      templateVersion: templateVersionFor(form, verdict.fromFirm ? verdict : undefined),
      assumptions,
      locale: batch.locale,
      timeZone: batch.timeZone,
    };
    const cacheKey = draftKey(identity);

    const meta = {
      establishment: dataset.master,
      periodLabel: label,
      generatedAt,
      generatorRevision: GENERATOR_REVISION,
      cacheKey,
      verification: verdict.fromFirm ? verdict : undefined,
    };

    for (const format of formats) {
      const hit = await findByCacheKey(ctx, batch.id, form.id, cacheKey, format);
      if (hit) {
        documents.push({
          formId: form.id,
          documentId: hit.id,
          fileName: documentFileName(form, period, format),
          format,
          built: false,
        });
        continue;
      }

      const buffer = format === 'pdf' ? await renderRegisterPdf(table, meta) : await renderForForm(table, meta);

      const objectKey = documentObjectKey({
        engagementId: batch.engagementId,
        batchId: batch.id,
        formId: form.id,
        cacheKey,
        format,
      });
      await putObject(objectKey, buffer, format === 'pdf' ? EXTENSION_TO_MIME.pdf : EXTENSION_TO_MIME.xlsx);

      /* Everything an evidence certificate needs, recorded at the moment it was true: what
         went in, what came out, under which mapping and which assumptions, and what printed
         nil. */
      const row = await recordDocument(ctx, {
        batchId: batch.id,
        formId: form.id,
        cacheKey,
        objectKey,
        artifactSha256: createHash('sha256').update(buffer).digest('hex'),
        byteLength: buffer.byteLength,
        format,
        templateVersion: identity.templateVersion,
        generatorRevision: GENERATOR_REVISION,
        manifest: {
          identity,
          mapping: dataset.mapping,
          sources,
          employees: dataset.employees.length,
          nilColumns: table.nil,
          notes: table.notes,
          orphanRows: dataset.orphans.length,
          verification: verdict,
          signatories: signatoriesFor(form).map((b) => b.label),
        },
        retainUntil: String(new Date(period.to).getUTCFullYear() + retentionYears([form])),
      });
      if (!row) return { kind: 'not_found' };

      documents.push({
        formId: form.id,
        documentId: row.id,
        fileName: documentFileName(form, period, format),
        format,
        built: true,
      });
    }
  }

  return { kind: 'done', documents, blocked, deferred, suppressed };
}
