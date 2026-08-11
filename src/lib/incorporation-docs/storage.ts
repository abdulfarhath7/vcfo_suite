import 'server-only';

import {
  MILESTONE_DOCUMENTS_BUCKET,
  milestoneDocumentObjectPath,
} from '@/lib/milestone-document-storage';
import { incorpDocDownloadFilename } from '@/lib/incorporation-docs/paths';
import type { IncorpDraftLabelOptions } from '@/lib/incorporation-docs/paths';
import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import {
  draftUrlFieldFor,
  INCORP_DOC_DEFINITIONS,
  type IncorpDocKind,
} from '@/lib/incorporation-docs/types';
import { EXTENSION_TO_MIME } from '@/lib/upload-limits';
import { bucketKey, getObjectBuffer, putObject } from '@/storage/s3';

/**
 * Incorporation-document .docx storage — SERVER ONLY.
 *
 * Generated drafts live alongside milestone documents (same historic bucket,
 * now the same S3 key prefix) under the checklist field the draft belongs to,
 * so the existing MilestoneFileDisplay rendering picks them up unchanged.
 *
 * Stored paths keep the original `{engagementUuid}/{fieldId}/{ts}-{name}`
 * shape; `bucketKey` adds the prefix only when addressing S3.
 */

function keyFor(storagePath: string): string {
  return bucketKey(MILESTONE_DOCUMENTS_BUCKET, storagePath);
}

export async function uploadIncorpDocx(
  appEngagementId: string,
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
  docx: Buffer,
  labelOptions?: IncorpDraftLabelOptions,
): Promise<string> {
  const fieldId = draftUrlFieldFor(doc, audience);
  if (!fieldId) {
    throw new Error(`${INCORP_DOC_DEFINITIONS[doc].label} is not generated for this audience.`);
  }

  const fileName = incorpDocDownloadFilename(doc, audience, labelOptions);
  const objectPath = milestoneDocumentObjectPath(appEngagementId, fieldId, fileName);

  await putObject(keyFor(objectPath), docx, EXTENSION_TO_MIME.docx);
  return objectPath;
}

export async function downloadIncorpDocx(storagePath: string): Promise<ArrayBuffer | null> {
  const trimmed = storagePath.trim();
  if (!trimmed) return null;

  try {
    const buf = await getObjectBuffer(keyFor(trimmed));
    if (!buf) {
      console.warn('[milestone-documents] incorporation doc download failed: not found');
      return null;
    }
    // Return a standalone ArrayBuffer — Buffer views share a pooled backing
    // store, so handing out buf.buffer would expose unrelated bytes.
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch (error) {
    console.warn(
      '[milestone-documents] incorporation doc download failed',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Overwrite an existing draft in place (regeneration/repair). Never throws. */
export async function repairIncorpDocxAtPath(
  storagePath: string,
  docx: Buffer,
): Promise<void> {
  const trimmed = storagePath.trim();
  if (!trimmed) return;
  try {
    await putObject(keyFor(trimmed), docx, EXTENSION_TO_MIME.docx);
  } catch (error) {
    console.warn(
      '[milestone-documents] incorporation doc repair upload failed',
      error instanceof Error ? error.message : error,
    );
  }
}
