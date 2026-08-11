import 'server-only';

import type { Engagement } from '@/data/engagements';
import { checklist } from '@/data/checklist';
import { extractItemResponses, type ChecklistItemResponses } from '@/lib/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { patchIncorpDocxBuffer, renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import { downloadIncorpDocx, uploadIncorpDocx } from '@/lib/incorporation-docs/storage';
import {
  audiencesForDoc,
  draftUrlFieldFor,
  INCORP_DOC_DEFINITIONS,
  INCORP_DOC_KINDS,
  type IncorpDocKind,
} from '@/lib/incorporation-docs/types';
import type { AuthContext } from '@/auth/guards';
import {
  patchChecklistItem,
  type EngagementChecklistState,
} from '@/db/repositories/engagements';

export {
  INCORP_DOCS_ERROR_CODES,
  IncorpDocsError,
  toIncorpDocsError,
  toIncorpDocsPatchError,
  validateIncorpDocsGeneration,
  type IncorpDocsErrorCode,
} from '@/lib/api/incorporation-docs-errors';

import {
  INCORP_DOCS_ERROR_CODES,
  IncorpDocsError,
  toIncorpDocsError,
  toIncorpDocsPatchError,
  validateIncorpDocsGeneration,
} from '@/lib/api/incorporation-docs-errors';

export function parseIncorpDocKinds(docs: string[] | undefined): IncorpDocKind[] {
  if (!docs?.length) return [...INCORP_DOC_KINDS];
  const invalid = docs.filter((d) => !INCORP_DOC_KINDS.includes(d as IncorpDocKind));
  if (invalid.length > 0) {
    throw new IncorpDocsError(
      `Unknown document type(s): ${invalid.join(', ')}`,
      INCORP_DOCS_ERROR_CODES.INVALID_DOC,
    );
  }
  return docs as IncorpDocKind[];
}

export interface GenerateIncorpDocsResult {
  paths: Partial<Record<IncorpDocKind, Partial<Record<IncorpDocAudience, string>>>>;
  responsePatch: Record<string, string>;
}

function pre7ResponsesFromState(
  checklistState: EngagementChecklistState | null | undefined,
): Record<string, string> {
  const pre7Item = checklist.find((c) => c.id === 'pre-7');
  const pre7State = checklistState?.['pre-7'] as ChecklistItemStateSlice | undefined;
  if (!pre7Item) return {};
  const responses = extractItemResponses(pre7Item, pre7State);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(responses)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}

function pre6ResponsesFromState(
  checklistState: EngagementChecklistState | null | undefined,
): ChecklistItemResponses {
  const pre6Item = checklist.find((c) => c.id === 'pre-6');
  const pre6State = checklistState?.['pre-6'] as ChecklistItemStateSlice | undefined;
  return pre6Item ? extractItemResponses(pre6Item, pre6State) : {};
}

export async function generateAndStoreIncorpDocs(
  ctx: AuthContext,
  engagement: Engagement,
  checklistState: EngagementChecklistState | null | undefined,
  options: {
    docs: IncorpDocKind[];
    directors?: IncorpDocAudience[];
    /** Preview edit content — patches the stored docx when a path already exists. */
    content?: string;
  },
): Promise<GenerateIncorpDocsResult> {
  const editedContent = options.content?.trim();
  const isPatchOnly = Boolean(editedContent);

  const pre6ForLabels = pre6ResponsesFromState(checklistState);
  const { pre6, pre1, pre5 } = isPatchOnly
    ? { pre6: pre6ForLabels, pre1: {}, pre5: {} }
    : validateIncorpDocsGeneration({
        engagement,
        checklistState,
        docs: options.docs,
        directors: options.directors,
      });

  const pre7Stored = pre7ResponsesFromState(checklistState);
  const paths: GenerateIncorpDocsResult['paths'] = {};
  const responsePatch: Record<string, string> = {};

  for (const doc of options.docs) {
    const def = INCORP_DOC_DEFINITIONS[doc];
    const docAudienceSet = new Set(audiencesForDoc(doc));
    const docAudiences = options.directors?.length
      ? options.directors.filter((a) => docAudienceSet.has(a))
      : audiencesForDoc(doc);

    if (docAudiences.length === 0) continue;

    paths[doc] = {};

    for (const audience of docAudiences) {
      const fieldId = draftUrlFieldFor(doc, audience);
      if (!fieldId) continue;

      let docx: Buffer;

      if (isPatchOnly && editedContent) {
        const existingPath = pre7Stored[fieldId]?.trim();
        if (!existingPath) {
          throw new IncorpDocsError(
            'Generate this draft before saving inline edits.',
            INCORP_DOCS_ERROR_CODES.GENERATION_FAILED,
            { status: 422 },
          );
        }

        const downloaded = await downloadIncorpDocx(existingPath);
        if (!downloaded) {
          throw new IncorpDocsError(
            'The saved Word file could not be loaded. Re-generate the draft, then try saving again.',
            INCORP_DOCS_ERROR_CODES.GENERATION_FAILED,
            { status: 404 },
          );
        }

        try {
          docx = patchIncorpDocxBuffer(Buffer.from(downloaded), editedContent);
        } catch (err) {
          throw toIncorpDocsPatchError(err);
        }

        try {
          const storagePath = await uploadIncorpDocx(engagement.id, doc, audience, docx, {
            pre6,
          });
          paths[doc]![audience] = storagePath;
          responsePatch[fieldId] = storagePath;
        } catch {
          throw new IncorpDocsError(
            `Could not upload ${def.label}. Try again in a moment.`,
            INCORP_DOCS_ERROR_CODES.STORAGE_UPLOAD_FAILED,
          );
        }
        continue;
      }

      try {
        docx = renderIncorpDocxBuffer(doc, {
          engagement,
          pre1,
          pre5,
          pre6,
          director: audience,
        });
      } catch (err) {
        throw toIncorpDocsError(err);
      }

      try {
        const storagePath = await uploadIncorpDocx(engagement.id, doc, audience, docx, {
          pre6,
        });
        paths[doc]![audience] = storagePath;
        responsePatch[fieldId] = storagePath;
      } catch {
        throw new IncorpDocsError(
          `Could not upload ${def.label}. Try again in a moment.`,
          INCORP_DOCS_ERROR_CODES.STORAGE_UPLOAD_FAILED,
        );
      }
    }
  }

  if (Object.keys(responsePatch).length > 0 && !isPatchOnly) {
    await patchChecklistItem(ctx, engagement.id, 'pre-7', { responses: responsePatch });
  }

  return { paths, responsePatch };
}

/** @deprecated Use generateAndStoreIncorpDocs — kept for dir-2 route compatibility */
export async function generateAndStoreDir2(
  ctx: AuthContext,
  engagement: Engagement,
  checklistState: EngagementChecklistState | null | undefined,
  directors: IncorpDocAudience[],
): Promise<Record<IncorpDocAudience, string>> {
  const { paths } = await generateAndStoreIncorpDocs(ctx, engagement, checklistState, {
    docs: ['dir-2'],
    directors,
  });
  return paths['dir-2'] as Record<IncorpDocAudience, string>;
}

export { IncorpDocsError as Dir2Error, toIncorpDocsError as toDir2Error };
