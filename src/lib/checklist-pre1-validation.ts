import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';

const INDIA_PVT_SUFFIX = /india\s+private\s+limited\s*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PRE1_GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

const PRE1_GENDER_VALUES = PRE1_GENDER_OPTIONS.map((o) => o.value);
export type Pre1Gender = (typeof PRE1_GENDER_OPTIONS)[number]['value'];

export function isValidPre1Gender(value: string | undefined | null): value is Pre1Gender {
  const g = (value ?? '').trim().toLowerCase();
  return PRE1_GENDER_VALUES.includes(g as Pre1Gender);
}

export function pre1GenderLabel(value: string | undefined | null): string | null {
  const g = (value ?? '').trim();
  if (!g) return null;
  return PRE1_GENDER_OPTIONS.find((o) => o.value === g)?.label ?? g;
}

export const PRE1_INDIA_RESIDENT_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

export const PRE1_MOBILE_COUNTRY_OPTIONS = [
  { value: '+91', label: 'India (+91)' },
  { value: '+1', label: 'United States / Canada (+1)' },
  { value: '+44', label: 'United Kingdom (+44)' },
  { value: '+65', label: 'Singapore (+65)' },
  { value: '+971', label: 'UAE (+971)' },
  { value: '+49', label: 'Germany (+49)' },
  { value: '+33', label: 'France (+33)' },
  { value: '+81', label: 'Japan (+81)' },
  { value: '+86', label: 'China (+86)' },
  { value: '+61', label: 'Australia (+61)' },
] as const;

export const PRE1_DEFAULT_AUTHORISED_SHARE_CAPITAL = '1000000';
export const PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL = '100000';
export const PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE = '10';

export const PRE1_DIRECTOR_FIRST_NAME_IDS = [
  'director1FirstName',
  'director2FirstName',
  'director3FirstName',
  'director4FirstName',
] as const;

export const PRE1_DIRECTOR_LAST_NAME_IDS = [
  'director1LastName',
  'director2LastName',
  'director3LastName',
  'director4LastName',
] as const;

export const PRE1_DIRECTOR_GENDER_IDS = [
  'director1Gender',
  'director2Gender',
  'director3Gender',
  'director4Gender',
] as const;

export const PRE1_DIRECTOR_INDIA_RESIDENT_IDS = [
  'director1IndiaResident',
  'director2IndiaResident',
  'director3IndiaResident',
  'director4IndiaResident',
] as const;

const PRE1_MIN_DIRECTORS = 2;
const PRE1_MAX_DIRECTORS = 4;
export const PRE1_DEFAULT_DIRECTOR_COUNT = PRE1_MIN_DIRECTORS;

const PRE1_PARENT_HAS_TRADEMARK_ID = 'parentEntityHasTrademark' as const;
const PRE1_PARENT_TRADEMARK_URL_ID = 'parentEntityTrademarkUrl' as const;

const PRE1_BASE_REQUIRED_TEXT_IDS = [
  'parentEntityName',
  'parentEntityRegistrationNumber',
  'parentEntityAddress',
  'signatoryFirstName',
  'signatoryLastName',
  'signatoryDesignation',
  'signatoryGender',
  'proposedName1',
  'proposedName2',
  'companyMailId',
  'companyMobileCountryCode',
  'companyMobileNumber',
  'businessDescription',
  'directorCount',
  'authorisedShareCapital',
  'paidUpShareCapital',
  'nominalValuePerEquityShare',
  'boardResolutionDate',
] as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPre1Date(value: string | undefined | null): boolean {
  const v = (value ?? '').trim();
  if (!ISO_DATE_RE.test(v)) return false;
  const [year, month, day] = v.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function parsePre1BoardResolutionDate(value: string | undefined | null): Date | null {
  if (!isValidPre1Date(value)) return null;
  return new Date(`${(value ?? '').trim()}T00:00:00`);
}

export function formatPre1DateDisplay(value: string | undefined | null): string | null {
  const parsed = parsePre1BoardResolutionDate(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const PRE1_REQUIRED_FILE_IDS = [
  'certificateOfIncorporationUrl',
  'passportUrl',
  'drivingLicenseUrl',
  'utilityBillUrl',
] as const;

export function parseDirectorCount(responses: ChecklistItemResponses): number {
  const raw = (responses.directorCount ?? String(PRE1_DEFAULT_DIRECTOR_COUNT)).trim();
  const n = Number.parseInt(raw, 10);
  if (n >= PRE1_MIN_DIRECTORS && n <= PRE1_MAX_DIRECTORS) return n;
  return PRE1_DEFAULT_DIRECTOR_COUNT;
}

export function directorFieldsToClear(count: number): string[] {
  const ids: string[] = [];
  for (let i = count + 1; i <= PRE1_MAX_DIRECTORS; i += 1) {
    ids.push(
      `director${i}FirstName`,
      `director${i}MiddleName`,
      `director${i}LastName`,
      `director${i}Gender`,
      `director${i}IndiaResident`,
      `director${i}Din`,
      `director${i}HasDsc`,
      `director${i}DscExpiryDate`,
    );
  }
  return ids;
}

export function getPre1VisibleFields(
  fields: ChecklistField[],
  responses: ChecklistItemResponses,
): ChecklistField[] {
  const count = parseDirectorCount(responses);
  return fields.filter((field) => {
    if (field.id === PRE1_PARENT_TRADEMARK_URL_ID) {
      return (responses[PRE1_PARENT_HAS_TRADEMARK_ID] ?? '').trim() === 'yes';
    }

    const match = /^director(\d)(FirstName|MiddleName|LastName|Gender|IndiaResident|Din|HasDsc|DscExpiryDate)$/.exec(
      field.id,
    );
    if (match) {
      const directorIndex = Number.parseInt(match[1], 10);
      if (directorIndex > count) return false;
    }

    if (field.showWhen) {
      return (responses[field.showWhen.field] ?? '').trim() === field.showWhen.value;
    }

    return true;
  });
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function hasIndiaResidentDirector(
  responses: ChecklistItemResponses,
  directorCount: number,
): boolean {
  for (let n = 1; n <= directorCount; n += 1) {
    if ((responses[`director${n}IndiaResident`] ?? '').trim() === 'yes') {
      return true;
    }
  }
  return false;
}

export interface Pre1ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validatePre1Responses(
  responses: ChecklistItemResponses,
): Pre1ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const id of PRE1_BASE_REQUIRED_TEXT_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'This field is required.';
    }
  }

  if ((responses.signatoryGender ?? '').trim() && !isValidPre1Gender(responses.signatoryGender)) {
    errors.signatoryGender = 'Select a valid gender.';
  }

  const directorCount = parseDirectorCount(responses);
  for (let n = 1; n <= directorCount; n += 1) {
    const firstNameId = `director${n}FirstName`;
    const lastNameId = `director${n}LastName`;
    const genderId = `director${n}Gender`;
    const residentId = `director${n}IndiaResident`;
    if (!(responses[firstNameId] ?? '').trim()) {
      errors[firstNameId] = 'This field is required.';
    }
    if (!(responses[lastNameId] ?? '').trim()) {
      errors[lastNameId] = 'This field is required.';
    }
    if (!(responses[genderId] ?? '').trim()) {
      errors[genderId] = 'This field is required.';
    } else if (!isValidPre1Gender(responses[genderId])) {
      errors[genderId] = 'Select a valid gender.';
    }
    if (!(responses[residentId] ?? '').trim()) {
      errors[residentId] = 'Please indicate whether this director is a resident of India.';
    }

    const hasDsc = (responses[`director${n}HasDsc`] ?? '').trim();
    const dscExpiryId = `director${n}DscExpiryDate`;
    if (hasDsc === 'yes') {
      const expiry = (responses[dscExpiryId] ?? '').trim();
      if (!expiry) {
        errors[dscExpiryId] = 'This field is required.';
      } else if (!isValidPre1Date(expiry)) {
        errors[dscExpiryId] = 'Enter a valid date.';
      }
    }
  }

  if (
    directorCount >= PRE1_MIN_DIRECTORS &&
    !hasIndiaResidentDirector(responses, directorCount)
  ) {
    errors.directorCount =
      'At least one proposed director must be a resident of India.';
  }

  for (const id of PRE1_REQUIRED_FILE_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'Please upload a document.';
    }
  }

  const mail = (responses.companyMailId ?? '').trim();
  if (mail && !EMAIL_RE.test(mail)) {
    errors.companyMailId = 'Enter a valid email address.';
  }

  const mobile = (responses.companyMobileNumber ?? '').trim();
  if (mobile && !/^\d{6,15}$/.test(mobile.replace(/\s/g, ''))) {
    errors.companyMobileNumber = 'Enter a valid mobile number (digits only, 6–15 digits).';
  }

  const words = countWords(responses.businessDescription ?? '');
  if (words > 100) {
    errors.businessDescription = `Description must be 100 words or fewer (${words} entered).`;
  }

  for (const id of ['proposedName1', 'proposedName2'] as const) {
    const value = (responses[id] ?? '').trim();
    if (value && !INDIA_PVT_SUFFIX.test(value)) {
      errors[id] = 'Name must end with "India Private Limited".';
    }
  }

  const boardResolutionDate = (responses.boardResolutionDate ?? '').trim();
  if (boardResolutionDate && !isValidPre1Date(boardResolutionDate)) {
    errors.boardResolutionDate = 'Enter a valid date.';
  }

  const nominalRaw = (responses.nominalValuePerEquityShare ?? '').trim();
  if (nominalRaw && !isValidPre1NominalValuePerEquityShare(nominalRaw)) {
    errors.nominalValuePerEquityShare =
      'Enter a valid nominal value per share (positive number, e.g. 10).';
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}

/** Positive numeric nominal value per equity share (commas allowed). */
export function isValidPre1NominalValuePerEquityShare(value: string): boolean {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) return false;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) && n > 0;
}

/** Apply engagement defaults and share-capital placeholders for empty pre-1 drafts. */
export function applyPre1EngagementDefaults(
  draft: ChecklistItemResponses,
  engagement?: {
    parentEntityName?: string | null;
    parentEntityAddress?: string | null;
    parentEntityRegistrationNumber?: string | null;
  } | null,
): ChecklistItemResponses {
  const next = { ...draft };
  if (!next.parentEntityName?.trim() && engagement?.parentEntityName?.trim()) {
    next.parentEntityName = engagement.parentEntityName.trim();
  }
  if (!next.parentEntityAddress?.trim() && engagement?.parentEntityAddress?.trim()) {
    next.parentEntityAddress = engagement.parentEntityAddress.trim();
  }
  if (
    !next.parentEntityRegistrationNumber?.trim() &&
    engagement?.parentEntityRegistrationNumber?.trim()
  ) {
    next.parentEntityRegistrationNumber =
      engagement.parentEntityRegistrationNumber.trim();
  }
  if (!next.authorisedShareCapital?.trim()) {
    next.authorisedShareCapital = PRE1_DEFAULT_AUTHORISED_SHARE_CAPITAL;
  }
  if (!next.paidUpShareCapital?.trim()) {
    next.paidUpShareCapital = PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL;
  }
  if (!next.nominalValuePerEquityShare?.trim()) {
    next.nominalValuePerEquityShare = PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE;
  }
  if (!next.companyMobileCountryCode?.trim()) {
    next.companyMobileCountryCode = '+91';
  }
  return next;
}

