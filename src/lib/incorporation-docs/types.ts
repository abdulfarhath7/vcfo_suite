import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  directorAudienceKind,
  directorAudienceSlot,
  directorFieldPrefix,
  isDirectorAudience,
  LEGACY_DIRECTOR_AUDIENCES,
  type IncorpDirectorAudience,
  type IncorpDirectorKind,
  type IncorpDocAudience,
} from '@/lib/incorporation-docs/audiences';

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

/** Checklist response id holding a draft's storage path (`nrDirectorDir2DraftUrl`, `moaDraftUrl` …). */
export type IncorpDraftUrlField = string;

export interface IncorpDocDefinition {
  kind: IncorpDocKind;
  label: string;
  templateRelative: string;
  /** Which audiences receive this document. */
  directors: IncorpDirectorKind[] | 'non-resident-only' | 'company-only';
  /**
   * Director docs: the response-id stem between the director prefix and
   * `DraftUrl` / `SignedUrl` (`nrDirector` + `Dir2` + `DraftUrl`).
   * Company docs: the full draft response id.
   */
  docSuffix: string;
  companyDraftField?: string;
  /** Slot-1 filename stem; later slots append `-{n}` before `.docx`. */
  downloadFilename: (audience: IncorpDocAudience) => string;
  /** Extra per-director applicability beyond residency (e.g. only directors holding a DIN). */
  appliesToDirector?: (pre6: ChecklistItemResponses, audience: IncorpDirectorAudience) => boolean;
  /** Optional on pre-7 / pre-8: never required for "all generated" or the validators. */
  optional?: boolean;
}

function directorFilename(stem: string) {
  return (audience: IncorpDocAudience) => {
    if (audience === 'company') return `${stem}.docx`;
    const kind = directorAudienceKind(audience);
    const slot = directorAudienceSlot(audience);
    const who = kind === 'non-resident' ? 'non-resident-director' : 'resident-director';
    return `${stem}-${who}${slot > 1 ? `-${slot}` : ''}.docx`;
  };
}

export const INCORP_DOC_DEFINITIONS: Record<IncorpDocKind, IncorpDocDefinition> = {
  'dir-2': {
    kind: 'dir-2',
    label: 'DIR-2',
    templateRelative: 'public/templates/dir-2.docx',
    directors: ['non-resident', 'resident'],
    docSuffix: 'Dir2',
    downloadFilename: directorFilename('dir-2'),
  },
  'dir-8': {
    kind: 'dir-8',
    label: 'DIR-8',
    templateRelative: 'public/templates/dir-8.docx',
    directors: ['non-resident', 'resident'],
    docSuffix: 'Dir8',
    downloadFilename: directorFilename('dir-8'),
  },
  'inc-9': {
    kind: 'inc-9',
    label: 'INC-9',
    templateRelative: 'public/templates/inc-9.docx',
    directors: ['non-resident', 'resident'],
    docSuffix: 'Inc9',
    downloadFilename: directorFilename('inc-9'),
  },
  'pan-undertaking': {
    kind: 'pan-undertaking',
    label: 'PAN Undertaking',
    templateRelative: 'public/templates/pan-undertaking.docx',
    directors: 'non-resident-only',
    docSuffix: 'PanUndertaking',
    downloadFilename: directorFilename('pan-undertaking'),
  },
  moa: {
    kind: 'moa',
    label: 'INC-33 — MOA',
    templateRelative: 'public/templates/moa.docx',
    directors: 'company-only',
    docSuffix: 'moa',
    companyDraftField: 'moaDraftUrl',
    downloadFilename: () => 'moa.docx',
  },
  aoa: {
    kind: 'aoa',
    label: 'INC-34 — AOA',
    templateRelative: 'public/templates/aoa.docx',
    directors: 'company-only',
    docSuffix: 'aoa',
    companyDraftField: 'aoaDraftUrl',
    downloadFilename: () => 'aoa.docx',
  },
  'authorisation-letter': {
    kind: 'authorisation-letter',
    label: 'Authorisation Letter',
    templateRelative: 'public/templates/authorisation-letter.docx',
    directors: 'company-only',
    docSuffix: 'authorisationLetter',
    companyDraftField: 'authorisationLetterDraftUrl',
    downloadFilename: () => 'authorisation-letter.docx',
  },
  'acceptance-letter': {
    kind: 'acceptance-letter',
    label: 'Acceptance Letter',
    templateRelative: 'public/templates/acceptance-letter.docx',
    directors: 'company-only',
    docSuffix: 'acceptanceLetter',
    companyDraftField: 'acceptanceLetterDraftUrl',
    downloadFilename: () => 'acceptance-letter.docx',
  },
  'moa-subscription-sheet': {
    kind: 'moa-subscription-sheet',
    label: 'INC-33 — MOA Subscription Sheet',
    templateRelative: 'public/templates/moa-aoa-subscription-sheet-foreign.docx',
    directors: 'company-only',
    docSuffix: 'moaSubscriptionSheet',
    companyDraftField: 'moaSubscriptionSheetDraftUrl',
    downloadFilename: () => 'moa-subscription-sheet.docx',
  },
  'aoa-subscription-sheet': {
    kind: 'aoa-subscription-sheet',
    label: 'INC-34 — AOA Subscription Sheet',
    templateRelative: 'public/templates/moa-aoa-subscription-sheet-foreign.docx',
    directors: 'company-only',
    docSuffix: 'aoaSubscriptionSheet',
    companyDraftField: 'aoaSubscriptionSheetDraftUrl',
    downloadFilename: () => 'aoa-subscription-sheet.docx',
  },
};

/**
 * Who receives `doc`. Director docs go to every director audience given
 * (default: the two legacy audiences) that the doc applies to.
 */
export function audiencesForDoc(
  doc: IncorpDocKind,
  directors: readonly IncorpDirectorAudience[] = LEGACY_DIRECTOR_AUDIENCES,
  pre6?: ChecklistItemResponses,
): IncorpDocAudience[] {
  const def = INCORP_DOC_DEFINITIONS[doc];
  if (def.directors === 'company-only') return ['company'];
  const kinds: readonly IncorpDirectorKind[] =
    def.directors === 'non-resident-only' ? ['non-resident'] : def.directors;
  return directors.filter(
    (a) =>
      kinds.includes(directorAudienceKind(a)) &&
      (!def.appliesToDirector || !pre6 || def.appliesToDirector(pre6, a)),
  );
}

/** Pre-7 response id for a draft, or null when `doc` is not written for `audience`. */
export function draftFieldIdFor(doc: IncorpDocKind, audience: IncorpDocAudience): IncorpDraftUrlField | null {
  const def = INCORP_DOC_DEFINITIONS[doc];
  if (def.directors === 'company-only') {
    return audience === 'company' ? (def.companyDraftField ?? null) : null;
  }
  if (audience === 'company' || !isDirectorAudience(audience)) return null;
  const kinds: readonly IncorpDirectorKind[] =
    def.directors === 'non-resident-only' ? ['non-resident'] : def.directors;
  if (!kinds.includes(directorAudienceKind(audience))) return null;
  return `${directorFieldPrefix(audience)}${def.docSuffix}DraftUrl`;
}

/** Pre-8 signed-upload id for a director draft (`residentDirector2Dir2SignedUrl`). */
export function directorSignedFieldIdFor(doc: IncorpDocKind, audience: IncorpDocAudience): string | null {
  const draft = draftFieldIdFor(doc, audience);
  if (!draft || audience === 'company') return null;
  return `${directorFieldPrefix(audience as IncorpDirectorAudience)}${INCORP_DOC_DEFINITIONS[doc].docSuffix}SignedUrl`;
}

/** Kept name for existing call sites; same as `draftFieldIdFor`. */
export function draftUrlFieldFor(
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
): IncorpDraftUrlField | null {
  return draftFieldIdFor(doc, audience);
}

export function isCompanyIncorpDoc(doc: IncorpDocKind): boolean {
  return INCORP_DOC_DEFINITIONS[doc].directors === 'company-only';
}
