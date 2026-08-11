import type { Engagement } from '@/data/engagements';
import { checklist } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { extractItemResponses } from '@/lib/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import type { EngagementChecklistState } from '@/lib/engagements-db';
import { collectAcceptanceLetterMissingFields } from '@/lib/incorporation-docs/acceptance-letter';
import { collectAuthorisationLetterMissingFields } from '@/lib/incorporation-docs/authorisation-letter';
import { collectAoaMissingFields } from '@/lib/incorporation-docs/aoa';
import { collectMoaMissingFields } from '@/lib/incorporation-docs/moa';
import { collectSubscriptionSheetMissingFields } from '@/lib/incorporation-docs/subscription-sheet';
import type { IncorpDocAudience, IncorpDirectorKind } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  pickString,
  resolveProposedCompanyName,
} from '@/lib/incorporation-docs/shared';
import { INCORP_DOC_KINDS, type IncorpDocKind } from '@/lib/incorporation-docs/types';
import { audiencesForDoc, isCompanyIncorpDoc } from '@/lib/incorporation-docs/types';

export const INCORP_DOCS_ERROR_CODES = {
  PRE6_NOT_ACCEPTED: 'pre6_not_accepted',
  MISSING_FIELDS: 'missing_fields',
  TEMPLATE_MISSING: 'template_missing',
  TEMPLATE_RENDER_FAILED: 'template_render_failed',
  PATCH_FAILED: 'patch_failed',
  SAVE_FAILED: 'save_failed',
  STORAGE_UPLOAD_FAILED: 'storage_upload_failed',
  GENERATION_FAILED: 'generation_failed',
  INVALID_DOC: 'invalid_doc',
} as const;

export type IncorpDocsErrorCode =
  (typeof INCORP_DOCS_ERROR_CODES)[keyof typeof INCORP_DOCS_ERROR_CODES];

export interface IncorpDocsApiErrorBody {
  ok: false;
  error: string;
  code?: IncorpDocsErrorCode;
  missingFields?: string[];
}

export class IncorpDocsError extends Error {
  readonly code: IncorpDocsErrorCode;
  readonly missingFields?: string[];
  readonly status: number;

  constructor(
    message: string,
    code: IncorpDocsErrorCode,
    options?: { missingFields?: string[]; status?: number },
  ) {
    super(message);
    this.name = 'IncorpDocsError';
    this.code = code;
    this.missingFields = options?.missingFields;
    this.status = options?.status ?? incorpDocsHttpStatus(code);
  }
}

function incorpDocsHttpStatus(code: IncorpDocsErrorCode): number {
  switch (code) {
    case INCORP_DOCS_ERROR_CODES.MISSING_FIELDS:
    case INCORP_DOCS_ERROR_CODES.PRE6_NOT_ACCEPTED:
      return 422;
    case INCORP_DOCS_ERROR_CODES.TEMPLATE_MISSING:
      return 503;
    default:
      return 500;
  }
}

export function incorpDocsErrorJson(err: IncorpDocsError): IncorpDocsApiErrorBody {
  return {
    ok: false,
    error: err.message,
    code: err.code,
    ...(err.missingFields?.length ? { missingFields: err.missingFields } : {}),
  };
}

const DIRECTOR_LABEL: Record<IncorpDirectorKind, string> = {
  'non-resident': 'Non-resident director',
  resident: 'Resident director',
};

function pre6Slice(checklistState: EngagementChecklistState | null | undefined) {
  const pre6Item = checklist.find((c) => c.id === 'pre-6');
  const pre6State = checklistState?.['pre-6'] as ChecklistItemStateSlice | undefined;
  return pre6Item ? extractItemResponses(pre6Item, pre6State) : {};
}

function pre6Accepted(checklistState: EngagementChecklistState | null | undefined): boolean {
  const slice = checklistState?.['pre-6'] as ChecklistItemStateSlice | undefined;
  return slice?.reviewStatus === 'accepted';
}

function pushMissing(missing: string[], label: string, value: string | undefined) {
  if (!(value ?? '').trim()) missing.push(label);
}

/** Collect human-readable labels for fields required to merge incorporation drafts. */
function collectCompanyDocMissing(
  doc: IncorpDocKind,
  mergeInput: {
    engagement?: Pick<Engagement, 'companyName'> | null;
    pre1: ChecklistItemResponses;
    pre5: ChecklistItemResponses;
    pre6: ChecklistItemResponses;
  },
): string[] {
  const base = { ...mergeInput, director: 'company' as const };
  switch (doc) {
    case 'moa':
      return collectMoaMissingFields(base);
    case 'aoa':
      return collectAoaMissingFields(base);
    case 'authorisation-letter':
      return collectAuthorisationLetterMissingFields(base);
    case 'acceptance-letter':
      return collectAcceptanceLetterMissingFields(base);
    case 'moa-subscription-sheet':
    case 'aoa-subscription-sheet':
      return collectSubscriptionSheetMissingFields(base);
    default:
      return [];
  }
}

export function collectIncorpDocsMissingFields(input: {
  engagement?: Pick<Engagement, 'companyName'> | null;
  pre1?: ChecklistItemResponses;
  pre5?: ChecklistItemResponses;
  pre6?: ChecklistItemResponses;
  docs?: IncorpDocKind[];
  directors?: IncorpDocAudience[];
}): string[] {
  const {
    engagement,
    pre1 = {},
    pre5 = {},
    pre6 = {},
    docs = [...INCORP_DOC_KINDS],
    directors: audiencesFilter,
  } = input;
  const missing: string[] = [];

  const directorDocs = docs.filter((d) => !isCompanyIncorpDoc(d));
  const needsCompanyName = docs.some((d) => isCompanyIncorpDoc(d) || directorDocs.length > 0);
  if (needsCompanyName) {
    const companyName = resolveProposedCompanyName(pre5, pre1, engagement);
    if (!companyName || companyName.startsWith('[')) {
      missing.push('Approved company name (Pre-5) or proposed name (Pre-1)');
    }
  }

  for (const doc of docs) {
    const docAudienceSet = new Set(audiencesForDoc(doc));
    if (isCompanyIncorpDoc(doc)) {
      const docAudiences = audiencesFilter?.length
        ? audiencesFilter.filter((a) => a === 'company' && docAudienceSet.has(a))
        : audiencesForDoc(doc);
      if (docAudienceSet.has('company')) {
        missing.push(...collectCompanyDocMissing(doc, { engagement, pre1, pre5, pre6 }));
      }
      continue;
    }

    const docDirectors = audiencesFilter?.length
      ? audiencesFilter.filter(
          (a): a is IncorpDirectorKind => a !== 'company' && docAudienceSet.has(a),
        )
      : (audiencesForDoc(doc).filter((a) => a !== 'company') as IncorpDirectorKind[]);

    for (const director of docDirectors) {
      const label = DIRECTOR_LABEL[director];

      if (doc === 'pan-undertaking') {
        pushMissing(missing, `${label} — full name (Pre-6)`, directorField(pre6, director, 'FullName'));
        pushMissing(
          missing,
          `${label} — father's name (Pre-6)`,
          directorField(pre6, director, 'FatherName'),
        );
        pushMissing(
          missing,
          `${label} — passport number (Pre-6)`,
          directorField(pre6, director, 'PassportNumber'),
        );
        pushMissing(
          missing,
          `${label} — utility bill address (Pre-6)`,
          directorField(pre6, director, 'UtilityBillAddress'),
        );
        continue;
      }

      pushMissing(missing, `${label} — full name (Pre-6)`, directorField(pre6, director, 'FullName'));
      pushMissing(
        missing,
        `${label} — father's name (Pre-6)`,
        directorField(pre6, director, 'FatherName'),
      );
      pushMissing(
        missing,
        `${label} — date of birth (Pre-6)`,
        directorField(pre6, director, 'Dob'),
      );
      pushMissing(
        missing,
        `${label} — utility bill address (Pre-6)`,
        directorField(pre6, director, 'UtilityBillAddress'),
      );

      const email = pickString(
        directorField(pre6, director, 'PersonalMailId'),
        directorField(pre6, director, 'OfficialMailId'),
      );
      pushMissing(missing, `${label} — email (Pre-6)`, email);

      pushMissing(
        missing,
        `${label} — mobile number (Pre-6)`,
        directorField(pre6, director, 'MobileNumber'),
      );

      if (director === 'resident') {
        pushMissing(missing, `${label} — PAN (Pre-6)`, directorField(pre6, director, 'PanNumber'));
        pushMissing(
          missing,
          `${label} — utility bill type (Pre-6)`,
          directorField(pre6, director, 'UtilityBillType'),
        );
      }
    }
  }

  return [...new Set(missing)];
}

export function validateIncorpDocsGeneration(input: {
  engagement?: Pick<Engagement, 'companyName'> | null;
  checklistState?: EngagementChecklistState | null;
  docs?: IncorpDocKind[];
  directors?: IncorpDocAudience[];
}): {
  pre6: ChecklistItemResponses;
  pre1: ChecklistItemResponses;
  pre5: ChecklistItemResponses;
} {
  const pre6 = pre6Slice(input.checklistState);

  if (!pre6Accepted(input.checklistState)) {
    throw new IncorpDocsError(
      'Client KYC (Pre-6) must be submitted and accepted before generating incorporation drafts.',
      INCORP_DOCS_ERROR_CODES.PRE6_NOT_ACCEPTED,
    );
  }

  const pre1Item = checklist.find((c) => c.id === 'pre-1');
  const pre5Item = checklist.find((c) => c.id === 'pre-5');
  const pre1State = input.checklistState?.['pre-1'] as ChecklistItemStateSlice | undefined;
  const pre5State = input.checklistState?.['pre-5'] as ChecklistItemStateSlice | undefined;
  const pre1 = pre1Item ? extractItemResponses(pre1Item, pre1State) : {};
  const pre5 = pre5Item ? extractItemResponses(pre5Item, pre5State) : {};

  const missingFields = collectIncorpDocsMissingFields({
    engagement: input.engagement,
    pre1,
    pre5,
    pre6,
    docs: input.docs,
    directors: input.directors,
  });

  if (missingFields.length > 0) {
    throw new IncorpDocsError(
      `This data is missing: ${missingFields.join(', ')}.`,
      INCORP_DOCS_ERROR_CODES.MISSING_FIELDS,
      { missingFields },
    );
  }

  return { pre6, pre1, pre5 };
}

export function toIncorpDocsError(err: unknown): IncorpDocsError {
  if (err instanceof IncorpDocsError) return err;

  const message = err instanceof Error ? err.message : 'Incorporation document generation failed.';
  if (/template missing/i.test(message)) {
    return new IncorpDocsError(message, INCORP_DOCS_ERROR_CODES.TEMPLATE_MISSING);
  }

  if (message.toLowerCase().includes('multi error') || message.toLowerCase().includes('docxtemplater')) {
    return new IncorpDocsError(
      'The Word template could not be merged with checklist data. Re-run the prepare script for this form.',
      INCORP_DOCS_ERROR_CODES.TEMPLATE_RENDER_FAILED,
    );
  }

  if (/invalid xml|unexpected close tag|xml parse/i.test(message)) {
    return new IncorpDocsError(
      'Generated document has invalid Word XML. Re-run the prepare script for this template.',
      INCORP_DOCS_ERROR_CODES.TEMPLATE_RENDER_FAILED,
    );
  }

  if (message.toLowerCase().includes('bucket') || message.toLowerCase().includes('storage')) {
    return new IncorpDocsError(
      'Could not upload the document. Try again in a moment.',
      INCORP_DOCS_ERROR_CODES.STORAGE_UPLOAD_FAILED,
    );
  }

  return new IncorpDocsError(message, INCORP_DOCS_ERROR_CODES.GENERATION_FAILED);
}

/** Map patch/save failures from inline draft editing into clearer API errors. */
export function toIncorpDocsPatchError(err: unknown): IncorpDocsError {
  if (err instanceof IncorpDocsError) return err;

  const message = err instanceof Error ? err.message : 'Could not save inline edits.';
  if (/template missing/i.test(message)) {
    return new IncorpDocsError(message, INCORP_DOCS_ERROR_CODES.TEMPLATE_MISSING);
  }

  if (
    /word\/document\.xml:|unexpected close tag|disallowed character|duplicate attribute|invalid xml|xml parse/i.test(
      message,
    )
  ) {
    return new IncorpDocsError(
      'Could not save inline edits — the draft Word file could not be patched safely. Re-generate this draft, then try editing again.',
      INCORP_DOCS_ERROR_CODES.PATCH_FAILED,
    );
  }

  if (message.toLowerCase().includes('bucket') || message.toLowerCase().includes('storage')) {
    return new IncorpDocsError(
      'Could not upload the saved draft. Try again in a moment.',
      INCORP_DOCS_ERROR_CODES.STORAGE_UPLOAD_FAILED,
    );
  }

  return new IncorpDocsError(
    message.trim() || 'Could not save inline edits. Try again in a moment.',
    INCORP_DOCS_ERROR_CODES.SAVE_FAILED,
  );
}

export interface IncorpDocsErrorDisplay {
  title: string;
  description: string;
  missingFields?: string[];
}

export function formatIncorpDocsErrorDisplay(
  body: Partial<IncorpDocsApiErrorBody> & { error?: string },
  fallbackTitle = 'Could not generate documents',
): IncorpDocsErrorDisplay {
  const code = body.code;
  const missingFields = body.missingFields;
  const errorText = body.error?.trim();

  switch (code) {
    case INCORP_DOCS_ERROR_CODES.PRE6_NOT_ACCEPTED:
      return {
        title: 'Pre-6 not accepted',
        description:
          errorText ??
          'Client KYC (Pre-6) must be submitted and accepted before generating incorporation drafts.',
      };
    case INCORP_DOCS_ERROR_CODES.MISSING_FIELDS:
      return {
        title: 'Missing information',
        description:
          errorText ??
          (missingFields?.length
            ? `This data is missing: ${missingFields.join(', ')}.`
            : 'Complete the required checklist fields, then try again.'),
        missingFields,
      };
    case INCORP_DOCS_ERROR_CODES.TEMPLATE_MISSING:
      return {
        title: 'Template not found',
        description: errorText ?? 'The Word template is missing on the server.',
      };
    case INCORP_DOCS_ERROR_CODES.TEMPLATE_RENDER_FAILED:
      return {
        title: 'Template merge failed',
        description:
          errorText ?? 'The Word template could not be filled with checklist data.',
      };
    case INCORP_DOCS_ERROR_CODES.PATCH_FAILED:
      return {
        title: 'Could not save edits',
        description:
          errorText ??
          'The draft could not be updated safely. Re-generate this draft, then try editing again.',
      };
    case INCORP_DOCS_ERROR_CODES.SAVE_FAILED:
      return {
        title: 'Could not save changes',
        description: errorText ?? 'Try again in a moment.',
      };
    default:
      return {
        title: fallbackTitle,
        description: errorText ?? 'Try again in a moment.',
        missingFields,
      };
  }
}
