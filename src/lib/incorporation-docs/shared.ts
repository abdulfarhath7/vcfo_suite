import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  PRE6_OCCUPATION_OPTIONS,
  PRE6_UTILITY_BILL_OPTIONS,
} from '@/lib/checklist-pre6-validation';
import { resolvePre6DirectorDisplayName } from '@/lib/person-name';

export type IncorpDirectorKind = 'non-resident' | 'resident';

/** Director-specific or company-level incorporation draft audience. */
export type IncorpDocAudience = IncorpDirectorKind | 'company';

export interface IncorpMergeInput {
  engagement?: Pick<
    Engagement,
    'companyName' | 'parentEntityName' | 'parentEntityAddress' | 'parentEntityRegistrationNumber'
  > | null;
  pre1?: ChecklistItemResponses;
  pre5?: ChecklistItemResponses;
  pre6?: ChecklistItemResponses;
  director: IncorpDocAudience;
}

const DIRECTOR_PREFIX: Record<IncorpDirectorKind, string> = {
  'non-resident': 'nrDirector',
  resident: 'residentDirector',
};

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
  director: IncorpDirectorKind | IncorpDocAudience,
  suffix: string,
): string {
  if (director === 'company') return '';
  if (suffix === 'FullName') {
    return resolvePre6DirectorDisplayName(pre6, director);
  }
  const prefix = DIRECTOR_PREFIX[director];
  return (pre6[`${prefix}${suffix}`] ?? '').trim();
}

export function documentPlaceForDirector(director: IncorpDirectorKind): string {
  return director === 'resident' ? 'India' : 'Foreign';
}

export function identityProofForDirector(director: IncorpDirectorKind): string {
  return director === 'resident' ? 'Copy of Aadhaar Card' : 'Copy of Passport';
}

export function residenceProofForDirector(
  pre6: ChecklistItemResponses,
  director: IncorpDirectorKind,
): string {
  if (director === 'resident') {
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
  director: IncorpDirectorKind,
): string {
  const occupationRaw = directorField(pre6, director, 'OccupationType');
  const occupationLabel = labelForOption(PRE6_OCCUPATION_OPTIONS, occupationRaw);
  return occupationLabel || 'Director';
}

export function directorNationalityLabel(director: IncorpDirectorKind): string {
  return director === 'resident' ? 'India' : 'Foreign';
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
