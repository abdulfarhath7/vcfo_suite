import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  PRE6_OCCUPATION_OPTIONS,
  PRE6_UTILITY_BILL_OPTIONS,
} from '@/lib/checklist-pre6-validation';
import { resolvePre6DisplayNameForPrefix } from '@/lib/person-name';
import { otherInterestsFromPre6, type OtherCompanyInterest } from '@/lib/other-company-interests';
import {
  DIRECTOR_IDENTITY_PROOF_OPTIONS,
  DIRECTOR_RESIDENCE_PROOF_OPTIONS,
  proofDocumentName,
} from '@/lib/director-proofs';
import {
  directorAudienceKind,
  directorFieldPrefix,
  type IncorpDirectorAudience,
  type IncorpDirectorKind,
  type IncorpDocAudience,
} from '@/lib/incorporation-docs/audiences';

export type { IncorpDirectorAudience, IncorpDirectorKind, IncorpDocAudience };

export interface IncorpMergeInput {
  engagement?: (Pick<
    Engagement,
    'companyName' | 'parentEntityName' | 'parentEntityAddress' | 'parentEntityRegistrationNumber'
  > &
    Partial<Pick<Engagement, 'ownershipType'>>) | null;
  pre1?: ChecklistItemResponses;
  pre5?: ChecklistItemResponses;
  pre6?: ChecklistItemResponses;
  /** Pre-7 answers — the lead's signing date and place (`incorpDocsSigning*`), subscription witness. */
  pre7?: ChecklistItemResponses;
  /** Capital structure — equity shares issued at incorporation. */
  pre13?: ChecklistItemResponses;
  /** Subscriber details — who takes the shares, and how many. */
  pre16?: ChecklistItemResponses;
  director: IncorpDocAudience;
}

/** Pre-7 ids for the signing block every generated draft shares. */
export const INCORP_SIGNING_DATE_FIELD = 'incorpDocsSigningDate';
export const INCORP_SIGNING_PLACE_FIELD = 'incorpDocsSigningPlace';

/** The lead's signing date (ISO `YYYY-MM-DD` on pre-7), else today — exactly as before. */
export function signingDate(input: Pick<IncorpMergeInput, 'pre7'>): Date {
  const raw = (input.pre7?.[INCORP_SIGNING_DATE_FIELD] ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

/**
 * Place of signing. A non-resident director's own `pre-15` answer
 * (`signingPlace`, "City, Country"), else "Foreign" as before (owner answer
 * Q3); resident directors take the lead's pre-7 place, else "India".
 */
export function signingPlace(
  input: Pick<IncorpMergeInput, 'pre6' | 'pre7'>,
  director: IncorpDirectorAudience,
): string {
  if (!isResidentAudience(director)) {
    return pickString(directorField(input.pre6 ?? {}, director, 'SigningPlace'), documentPlaceForDirector(director));
  }
  return pickString(input.pre7?.[INCORP_SIGNING_PLACE_FIELD], documentPlaceForDirector(director));
}

/** "son of" unless the director is recorded as female; unknown keeps today's wording. */
export function relationOf(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
  capitalised = false,
): string {
  const female = directorField(pre6, director, 'Gender').toLowerCase() === 'female';
  const text = female ? 'daughter of' : 'son of';
  return capitalised ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** A director's other company interests (DIR-8 table, DIR-2 count). */
export function directorOtherInterests(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
): OtherCompanyInterest[] {
  return otherInterestsFromPre6(pre6, directorFieldPrefix(director));
}

export function pickString(...values: (string | null | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return '';
}

export function formatDocumentDate(date: Date): string {
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

export function formatDob(isoDate: string | undefined): string {
  const trimmed = (isoDate ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed || '—';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function labelForOption<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string | undefined,
): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  return options.find((o) => o.value === v)?.label ?? v;
}

export function resolveProposedCompanyName(
  pre5: ChecklistItemResponses,
  pre1: ChecklistItemResponses,
  engagement?: Pick<Engagement, 'companyName'> | null,
): string {
  return pickString(
    pre5.approvedCompanyName,
    pre1.proposedName1,
    engagement?.companyName,
    '[Proposed company name]',
  );
}

export function directorField(
  pre6: ChecklistItemResponses,
  director: IncorpDocAudience,
  suffix: string,
): string {
  if (director === 'company') return '';
  const prefix = directorFieldPrefix(director);
  if (suffix === 'FullName') {
    return resolvePre6DisplayNameForPrefix(pre6, prefix);
  }
  return (pre6[`${prefix}${suffix}`] ?? '').trim();
}

function isResidentAudience(director: IncorpDirectorAudience): boolean {
  return directorAudienceKind(director) === 'resident';
}

export function documentPlaceForDirector(director: IncorpDirectorAudience): string {
  return isResidentAudience(director) ? 'India' : 'Foreign';
}

/** The confirmed `pre-15` identity proof, else Aadhaar (resident) / passport (non-resident). */
export function identityProofForDirector(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
): string {
  const confirmed = proofDocumentName(
    DIRECTOR_IDENTITY_PROOF_OPTIONS,
    directorField(pre6, director, 'IdentityProofType'),
  );
  if (confirmed) return `Copy of ${confirmed}`;
  return isResidentAudience(director) ? 'Copy of Aadhaar Card' : 'Copy of Passport';
}

/**
 * Residents: their utility-bill type. Non-residents: the `pre-15` residence
 * proof ("other" names its own document), else the driving licence as before.
 */
export function residenceProofForDirector(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
): string {
  if (isResidentAudience(director)) {
    const utilityType = labelForOption(
      PRE6_UTILITY_BILL_OPTIONS,
      directorField(pre6, director, 'UtilityBillType'),
    );
    return utilityType ? `Copy of ${utilityType}` : 'Copy of Utility Bill';
  }
  const type = directorField(pre6, director, 'ResidenceProofType');
  const document =
    type === 'other'
      ? directorField(pre6, director, 'ResidenceProofOther')
      : proofDocumentName(DIRECTOR_RESIDENCE_PROOF_OPTIONS, type);
  return document ? `Copy of ${document}` : 'Copy of Driving License';
}

export function directorOccupationLabel(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
): string {
  const occupationRaw = directorField(pre6, director, 'OccupationType');
  const occupationLabel = labelForOption(PRE6_OCCUPATION_OPTIONS, occupationRaw);
  return occupationLabel || 'Director';
}

/** The `pre-15` nationality, else "India" (resident) / "Foreign" (non-resident) as before. */
export function directorNationalityLabel(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
): string {
  return pickString(
    directorField(pre6, director, 'Nationality'),
    isResidentAudience(director) ? 'India' : 'Foreign',
  );
}

/**
 * Nationality for documents that historically read it off the address
 * (PAN undertaking, subscription sheet): the answer first, then the address.
 */
export function directorNationalityOrAddressCountry(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
): string {
  return pickString(
    directorField(pre6, director, 'Nationality'),
    nationalityFromAddress(directorField(pre6, director, 'UtilityBillAddress')),
  );
}

/** Extract trailing country token from a comma-separated address (e.g. "…, USA"). */
export function nationalityFromAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return 'Foreign Country';
  const parts = trimmed.split(',').flatMap((p) => {
    const part = p.trim();
    return part ? [part] : [];
  });
  const last = parts[parts.length - 1];
  if (!last) return 'Foreign Country';
  if (/^USA$/i.test(last)) return 'United States of America';
  return last;
}

export function splitDocumentDateForRuns(date: Date): {
  DOCUMENT_DATE_DAY1: string;
  DOCUMENT_DATE_DAY2: string;
  DOCUMENT_DATE_ORDINAL: string;
  DOCUMENT_DATE_SPACE1: string;
  DOCUMENT_DATE_MONTH: string;
  DOCUMENT_DATE_YEAR_PREFIX: string;
  DOCUMENT_DATE_YEAR: string;
} {
  const day = date.getDate();
  const dayStr = String(day);
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = String(date.getFullYear());
  const yearPrefix = year.length > 1 ? ` ${year.slice(0, -1)}` : ' ';
  const yearLast = year.slice(-1);

  if (dayStr.length === 1) {
    return {
      DOCUMENT_DATE_DAY1: dayStr,
      DOCUMENT_DATE_DAY2: '',
      DOCUMENT_DATE_ORDINAL: suffix,
      DOCUMENT_DATE_SPACE1: ' ',
      DOCUMENT_DATE_MONTH: month,
      DOCUMENT_DATE_YEAR_PREFIX: yearPrefix,
      DOCUMENT_DATE_YEAR: yearLast,
    };
  }

  return {
    DOCUMENT_DATE_DAY1: dayStr[0] ?? '',
    DOCUMENT_DATE_DAY2: dayStr[1] ?? '',
    DOCUMENT_DATE_ORDINAL: suffix,
    DOCUMENT_DATE_SPACE1: ' ',
    DOCUMENT_DATE_MONTH: month,
    DOCUMENT_DATE_YEAR_PREFIX: yearPrefix,
    DOCUMENT_DATE_YEAR: yearLast,
  };
}
