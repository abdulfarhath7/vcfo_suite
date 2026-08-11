import type { IncorpDocAudience, IncorpDirectorKind } from '@/lib/incorporation-docs/shared';

export type { IncorpDocAudience };

export type IncorpDocKind =
  | 'dir-2'
  | 'dir-8'
  | 'inc-9'
  | 'pan-undertaking'
  | 'moa'
  | 'aoa'
  | 'authorisation-letter'
  | 'acceptance-letter'
  | 'moa-subscription-sheet'
  | 'aoa-subscription-sheet';

export const INCORP_DOC_KINDS = [
  'dir-2',
  'dir-8',
  'inc-9',
  'pan-undertaking',
  'moa',
  'aoa',
  'authorisation-letter',
  'acceptance-letter',
  'moa-subscription-sheet',
  'aoa-subscription-sheet',
] as const satisfies readonly IncorpDocKind[];

export type IncorpDraftUrlField =
  | 'nrDirectorDir2DraftUrl'
  | 'residentDirectorDir2DraftUrl'
  | 'nrDirectorDir8DraftUrl'
  | 'residentDirectorDir8DraftUrl'
  | 'nrDirectorInc9DraftUrl'
  | 'residentDirectorInc9DraftUrl'
  | 'nrDirectorPanUndertakingDraftUrl'
  | 'moaDraftUrl'
  | 'aoaDraftUrl'
  | 'authorisationLetterDraftUrl'
  | 'acceptanceLetterDraftUrl'
  | 'moaSubscriptionSheetDraftUrl'
  | 'aoaSubscriptionSheetDraftUrl';

export interface IncorpDocDefinition {
  kind: IncorpDocKind;
  label: string;
  templateRelative: string;
  /** Which audiences receive this document. */
  directors: IncorpDirectorKind[] | 'non-resident-only' | 'company-only';
  draftUrlField: Partial<Record<IncorpDocAudience, IncorpDraftUrlField>>;
  downloadFilename: (audience: IncorpDocAudience) => string;
}

export const INCORP_DOC_DEFINITIONS: Record<IncorpDocKind, IncorpDocDefinition> = {
  'dir-2': {
    kind: 'dir-2',
    label: 'DIR-2',
    templateRelative: 'public/templates/dir-2.docx',
    directors: ['non-resident', 'resident'],
    draftUrlField: {
      'non-resident': 'nrDirectorDir2DraftUrl',
      resident: 'residentDirectorDir2DraftUrl',
    },
    downloadFilename: (audience) =>
      `dir-2-${audience === 'non-resident' ? 'non-resident-director' : 'resident-director'}.docx`,
  },
  'dir-8': {
    kind: 'dir-8',
    label: 'DIR-8',
    templateRelative: 'public/templates/dir-8.docx',
    directors: ['non-resident', 'resident'],
    draftUrlField: {
      'non-resident': 'nrDirectorDir8DraftUrl',
      resident: 'residentDirectorDir8DraftUrl',
    },
    downloadFilename: (audience) =>
      `dir-8-${audience === 'non-resident' ? 'non-resident-director' : 'resident-director'}.docx`,
  },
  'inc-9': {
    kind: 'inc-9',
    label: 'INC-9',
    templateRelative: 'public/templates/inc-9.docx',
    directors: ['non-resident', 'resident'],
    draftUrlField: {
      'non-resident': 'nrDirectorInc9DraftUrl',
      resident: 'residentDirectorInc9DraftUrl',
    },
    downloadFilename: (audience) =>
      `inc-9-${audience === 'non-resident' ? 'non-resident-director' : 'resident-director'}.docx`,
  },
  'pan-undertaking': {
    kind: 'pan-undertaking',
    label: 'PAN Undertaking',
    templateRelative: 'public/templates/pan-undertaking.docx',
    directors: 'non-resident-only',
    draftUrlField: {
      'non-resident': 'nrDirectorPanUndertakingDraftUrl',
    },
    downloadFilename: () => 'pan-undertaking-non-resident-director.docx',
  },
  moa: {
    kind: 'moa',
    label: 'MOA',
    templateRelative: 'public/templates/moa.docx',
    directors: 'company-only',
    draftUrlField: { company: 'moaDraftUrl' },
    downloadFilename: () => 'moa.docx',
  },
  aoa: {
    kind: 'aoa',
    label: 'AOA',
    templateRelative: 'public/templates/aoa.docx',
    directors: 'company-only',
    draftUrlField: { company: 'aoaDraftUrl' },
    downloadFilename: () => 'aoa.docx',
  },
  'authorisation-letter': {
    kind: 'authorisation-letter',
    label: 'Authorisation Letter',
    templateRelative: 'public/templates/authorisation-letter.docx',
    directors: 'company-only',
    draftUrlField: { company: 'authorisationLetterDraftUrl' },
    downloadFilename: () => 'authorisation-letter.docx',
  },
  'acceptance-letter': {
    kind: 'acceptance-letter',
    label: 'Acceptance Letter',
    templateRelative: 'public/templates/acceptance-letter.docx',
    directors: 'company-only',
    draftUrlField: { company: 'acceptanceLetterDraftUrl' },
    downloadFilename: () => 'acceptance-letter.docx',
  },
  'moa-subscription-sheet': {
    kind: 'moa-subscription-sheet',
    label: 'MOA Subscription Sheet',
    templateRelative: 'public/templates/moa-aoa-subscription-sheet-foreign.docx',
    directors: 'company-only',
    draftUrlField: { company: 'moaSubscriptionSheetDraftUrl' },
    downloadFilename: () => 'moa-subscription-sheet.docx',
  },
  'aoa-subscription-sheet': {
    kind: 'aoa-subscription-sheet',
    label: 'AOA Subscription Sheet',
    templateRelative: 'public/templates/moa-aoa-subscription-sheet-foreign.docx',
    directors: 'company-only',
    draftUrlField: { company: 'aoaSubscriptionSheetDraftUrl' },
    downloadFilename: () => 'aoa-subscription-sheet.docx',
  },
};

export function audiencesForDoc(doc: IncorpDocKind): IncorpDocAudience[] {
  const def = INCORP_DOC_DEFINITIONS[doc];
  if (def.directors === 'non-resident-only') return ['non-resident'];
  if (def.directors === 'company-only') return ['company'];
  return def.directors;
}

/** @deprecated Use audiencesForDoc — kept for call sites still naming directors. */
export function draftUrlFieldFor(
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
): IncorpDraftUrlField | null {
  return INCORP_DOC_DEFINITIONS[doc].draftUrlField[audience] ?? null;
}

export function isCompanyIncorpDoc(doc: IncorpDocKind): boolean {
  return INCORP_DOC_DEFINITIONS[doc].directors === 'company-only';
}
