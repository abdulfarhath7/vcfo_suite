import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  PRE6_OCCUPATION_OPTIONS,
  PRE6_UTILITY_BILL_OPTIONS,
} from '@/lib/checklist-pre6-validation';
import { resolvePre6DisplayNameForPrefix } from '@/lib/person-name';
import { otherInterestsFromPre6, type OtherCompanyInterest } from '@/lib/other-company-interests';
import {
  directorAudienceKind,
  directorFieldPrefix,
  type IncorpDirectorAudience,
  type IncorpDirectorKind,
  type IncorpDocAudience,
} from '@/lib/incorporation-docs/audiences';

export type { IncorpDirectorAudience, IncorpDirectorKind, IncorpDocAudience };

export interface IncorpMergeInput {
  engagement?: Pick<
    Engagement,
    'companyName' | 'parentEntityName' | 'parentEntityAddress' | 'parentEntityRegistrationNumber'
  > | null;
  pre1?: ChecklistItemResponses;
  pre5?: ChecklistItemResponses;
  pre6?: ChecklistItemResponses;
  /** Pre-7 answers — the lead's signing date and place (`incorpDocsSigning*`). */
  pre7?: ChecklistItemResponses;
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
 * Place of signing. Non-resident directors keep "Foreign" (owner answer Q3);
 * resident directors take the lead's pre-7 place, else "India" as before.
 */
export function signingPlace(input: Pick<IncorpMergeInput, 'pre7'>, director: IncorpDirectorAudience): string {
  if (!isResidentAudience(director)) return documentPlaceForDirector(director);
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

export function identityProofForDirector(director: IncorpDirectorAudience): string {
  return isResidentAudience(director) ? 'Copy of Aadhaar Card' : 'Copy of Passport';
}

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
  return 'Copy of Driving License';
}

export function directorOccupationLabel(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorAudience,
): string {
  const occupationRaw = directorField(pre6, director, 'OccupationType');
  const occupationLabel = labelForOption(PRE6_OCCUPATION_OPTIONS, occupationRaw);
  return occupationLabel || 'Director';
}

export function directorNationalityLabel(director: IncorpDirectorAudience): string {
  return isResidentAudience(director) ? 'India' : 'Foreign';
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
