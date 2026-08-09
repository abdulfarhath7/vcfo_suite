import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { parseDirectorCount } from '@/lib/checklist-pre1-validation';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { formatDisplayName, resolveDirectorDisplayName } from '@/lib/person-name';
import {
  PRE6_REGISTERED_OFFICE_SECTION,
  REGISTERED_OFFICE_FIELD_IDS,
} from '@/lib/registered-office-responses';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PRE6_GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

export const PRE6_QUALIFICATION_OPTIONS = [
  { value: 'primary-education', label: 'Primary Education' },
  { value: 'secondary-education', label: 'Secondary Education' },
  { value: 'vocational-qualification', label: 'Vocational Qualification' },
  { value: 'bachelors-degree', label: "Bachelor's Degree" },
  { value: 'master-degree', label: 'Master Degree' },
  { value: 'doctorate-or-higher', label: 'Doctorate or Higher' },
  { value: 'professional', label: 'Professional' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'others', label: 'Others' },
] as const;

export const PRE6_OCCUPATION_OPTIONS = [
  { value: 'business', label: 'Business' },
  { value: 'professional', label: 'Professional' },
  { value: 'government-employment', label: 'Government Employment' },
  { value: 'private-employment', label: 'Private Employment' },
  { value: 'housewife', label: 'Housewife' },
  { value: 'student', label: 'Student' },
  { value: 'others', label: 'Others' },
] as const;

export const PRE6_UTILITY_BILL_OPTIONS = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'gas', label: 'Gas' },
  { value: 'water', label: 'Water' },
  { value: 'telephone-bill', label: 'Telephone Bill' },
  { value: 'bank-statement', label: 'Bank Statement' },
] as const;

export const PRE6_YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

const PRE6_GENDER_VALUES: Set<string> = new Set(PRE6_GENDER_OPTIONS.map((o) => o.value));
const PRE6_QUALIFICATION_VALUES: Set<string> = new Set(PRE6_QUALIFICATION_OPTIONS.map((o) => o.value));
const PRE6_OCCUPATION_VALUES: Set<string> = new Set(PRE6_OCCUPATION_OPTIONS.map((o) => o.value));
const PRE6_UTILITY_BILL_VALUES: Set<string> = new Set(PRE6_UTILITY_BILL_OPTIONS.map((o) => o.value));

const PRE6_MAX_KYC_SLOTS = 4;

const PRE6_SHAREHOLDER_FIELD_IDS = new Set([
  'shareholderAuthorizedPerson',
  'shareholderNominee',
]);

const PRE6_REGISTERED_OFFICE_FIELD_ID_SET = new Set<string>(REGISTERED_OFFICE_FIELD_IDS);

const PRE6_HAS_VALID_DSC_SUFFIX = 'HasValidDsc';
const PRE6_DSC_EXPIRY_SUFFIX = 'DscExpiryDate';
const PRE6_DSC_AVAILABILITY_SLOTS_SUFFIX = 'DscAvailabilitySlots';
const PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX = 'HasOtherCompanyInterest';
const PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX = 'OtherCompanyInterestCount';
const PRE6_NOTARY_APOSTILLE_METHOD_SUFFIX = 'NotaryApostilleMethod';

export const PRE6_MAX_OTHER_COMPANY_INTERESTS = 5;

export const PRE6_NOTARY_APOSTILLE_OPTIONS = [
  {
    value: 'self',
    label:
      'Self – The Non-Resident Director will arrange the notarization and apostille independently.',
  },
  {
    value: 'consultant',
    label:
      "Consultant of the Tool – The notarization and apostille process will be coordinated through the tool's consultant.",
  },
] as const;

const PRE6_NOTARY_APOSTILLE_VALUES: Set<string> = new Set(
  PRE6_NOTARY_APOSTILLE_OPTIONS.map((o) => o.value),
);

const PRE6_YES_NO_VALUES: Set<string> = new Set(PRE6_YES_NO_OPTIONS.map((o) => o.value));

const PRE6_OTHER_COMPANY_INTEREST_ENTRY_RE =
  /^OtherCompanyInterest(\d+)(Name|Shareholding|Designation|StartDate|EndDate)$/;

/** Shown on every director DSC slots field (nrDirector*, residentDirector*, numbered slots). */
export const PRE6_DSC_AVAILABILITY_SLOTS_LABEL =
  'Please provide two available time slots of 30 minutes each for completing the Digital Signature Certificate (DSC) creation process, based on the director\'s availability. (This question is applicable only if the above answer is "No.")';

const PRE6_DSC_AVAILABILITY_SLOTS_PLACEHOLDER =
  'e.g. 3 Jun 2025, 10:00–10:30 IST; 4 Jun 2025, 14:00–14:30 IST';

function isPre6DscExpiryFieldId(fieldId: string): boolean {
  return fieldId.endsWith(PRE6_DSC_EXPIRY_SUFFIX);
}

function isPre6DscAvailabilitySlotsFieldId(fieldId: string): boolean {
  return fieldId.endsWith(PRE6_DSC_AVAILABILITY_SLOTS_SUFFIX);
}

function isPre6OtherCompanyInterestCountFieldId(fieldId: string): boolean {
  return fieldId.endsWith(PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX);
}

function isPre6HasOtherCompanyInterestFieldId(fieldId: string): boolean {
  return fieldId.endsWith(PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX);
}

function parsePre6OtherCompanyInterestEntrySuffix(
  suffix: string,
): { index: number; part: string } | null {
  const match = PRE6_OTHER_COMPANY_INTEREST_ENTRY_RE.exec(suffix);
  if (!match) return null;
  return { index: Number(match[1]), part: match[2] };
}

function parsePre6OtherCompanyInterestEntryFieldId(
  fieldId: string,
  prefix: string,
): { index: number; part: string } | null {
  if (!fieldId.startsWith(prefix)) return null;
  return parsePre6OtherCompanyInterestEntrySuffix(fieldId.slice(prefix.length));
}

export function getPre6OtherCompanyInterestCount(
  pre6Responses: ChecklistItemResponses,
  prefix: string,
): number {
  const raw = (pre6Responses[`${prefix}${PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX}`] ?? '').trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, PRE6_MAX_OTHER_COMPANY_INTERESTS);
}

export function pre6DirectorHasOtherCompanyInterest(
  pre6Responses: ChecklistItemResponses,
  prefix: string,
): boolean {
  return (
    (pre6Responses[`${prefix}${PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX}`] ?? '').trim() === 'yes'
  );
}

export function shouldShowPre6OtherCompanyInterestCount(
  pre6Responses: ChecklistItemResponses,
  prefix: string,
): boolean {
  return pre6DirectorHasOtherCompanyInterest(pre6Responses, prefix);
}

export function shouldShowPre6OtherCompanyInterestEntry(
  pre6Responses: ChecklistItemResponses,
  prefix: string,
  index: number,
): boolean {
  if (!pre6DirectorHasOtherCompanyInterest(pre6Responses, prefix)) return false;
  const count = getPre6OtherCompanyInterestCount(pre6Responses, prefix);
  return index >= 1 && index <= count;
}

/** Clears count and entry fields when interest answer or count changes. */
export function clearPre6OtherCompanyInterestFields(
  responses: ChecklistItemResponses,
  prefix: string,
  options?: { keepCount?: number },
): ChecklistItemResponses {
  const next = { ...responses };
  const keepCount = options?.keepCount ?? 0;
  if (keepCount <= 0) {
    delete next[`${prefix}${PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX}`];
  }
  for (let i = 1; i <= PRE6_MAX_OTHER_COMPANY_INTERESTS; i += 1) {
    if (i <= keepCount) continue;
    for (const part of ['Name', 'Shareholding', 'Designation', 'StartDate', 'EndDate'] as const) {
      delete next[`${prefix}OtherCompanyInterest${i}${part}`];
    }
  }
  return next;
}

export function pre6DirectorHasValidDsc(
  pre6Responses: ChecklistItemResponses,
  prefix: string,
): boolean {
  return (pre6Responses[`${prefix}${PRE6_HAS_VALID_DSC_SUFFIX}`] ?? '').trim() === 'yes';
}

/** DSC availability slots apply only when the director answered "No" on Pre-6. */
export function shouldShowPre6DscAvailabilitySlots(
  pre6Responses: ChecklistItemResponses,
  prefix: string,
): boolean {
  return (pre6Responses[`${prefix}${PRE6_HAS_VALID_DSC_SUFFIX}`] ?? '').trim() === 'no';
}

export function shouldShowPre6DscExpiryDate(
  pre6Responses: ChecklistItemResponses,
  prefix: string,
): boolean {
  return pre6DirectorHasValidDsc(pre6Responses, prefix);
}

export type Pre6DirectorKind = 'non-resident' | 'resident';

export interface Pre6KycSlot {
  /** Proposed director index from Phase 1 Step 1 (1–4). */
  pre1DirectorIndex: number;
  kind: Pre6DirectorKind;
  /** 1-based index within NR or resident directors (maps to field prefix). */
  slotIndex: number;
  /** Response key prefix, e.g. nrDirector, nrDirector2, residentDirector. */
  prefix: string;
  sectionTitle: string;
  pre1DisplayName: string;
}

export interface Pre6ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/** First NR slot keeps legacy `nrDirector*` keys; further slots use `nrDirector2*`, etc. */
export function pre6NrFieldPrefix(slotIndex: number): string {
  return slotIndex <= 1 ? 'nrDirector' : `nrDirector${slotIndex}`;
}

/** First resident slot keeps legacy `residentDirector*` keys. */
function pre6ResidentFieldPrefix(slotIndex: number): string {
  return slotIndex <= 1 ? 'residentDirector' : `residentDirector${slotIndex}`;
}

function pre6FieldPrefix(kind: Pre6DirectorKind, slotIndex: number): string {
  return kind === 'non-resident'
    ? pre6NrFieldPrefix(slotIndex)
    : pre6ResidentFieldPrefix(slotIndex);
}

/** Whether a stored field id belongs to a given prefix (avoids nrDirector matching nrDirector2). */
export function fieldIdMatchesPre6Prefix(fieldId: string, prefix: string): boolean {
  if (!fieldId.startsWith(prefix)) return false;
  if (prefix === 'nrDirector') return !/^nrDirector[2-9]/.test(fieldId);
  if (prefix === 'residentDirector') return !/^residentDirector[2-9]/.test(fieldId);
  return true;
}

export function getPre6DirectorSlotsFromPre1(
  pre1Responses: ChecklistItemResponses,
): Pre6KycSlot[] {
  const directorCount = parseDirectorCount(pre1Responses);
  const slots: Pre6KycSlot[] = [];
  let nrSlot = 0;
  let residentSlot = 0;

  for (let i = 1; i <= directorCount; i += 1) {
    const resident = (pre1Responses[`director${i}IndiaResident`] ?? '').trim();
    const pre1DisplayName = resolveDirectorDisplayName(pre1Responses, i);

    if (resident === 'yes') {
      residentSlot += 1;
      slots.push({
        pre1DirectorIndex: i,
        kind: 'resident',
        slotIndex: residentSlot,
        prefix: pre6ResidentFieldPrefix(residentSlot),
        sectionTitle: `Director ${i} — Resident`,
        pre1DisplayName,
      });
    } else if (resident === 'no') {
      nrSlot += 1;
      slots.push({
        pre1DirectorIndex: i,
        kind: 'non-resident',
        slotIndex: nrSlot,
        prefix: pre6NrFieldPrefix(nrSlot),
        sectionTitle: `Director ${i} — Non-Resident`,
        pre1DisplayName,
      });
    }
  }

  return slots;
}

export function isPre1SubmittedForPre6(
  pre1State?: ChecklistItemStateSlice | null,
): boolean {
  if (!pre1State) return false;
  if (pre1State.clientSubmittedAt?.trim()) return true;
  if (pre1State.reviewStatus === 'accepted') return true;
  if (pre1State.status === 'completed') return true;
  return false;
}

type FieldTemplate = {
  suffix: string;
  label: string;
  type: ChecklistField['type'];
  placeholder?: string;
  accept?: string;
  options?: ChecklistField['options'];
  required?: boolean;
  showWhen?: { fieldSuffix: string; value: string };
};

const PRE6_HAS_VALID_DSC_FIELD: FieldTemplate = {
  suffix: PRE6_HAS_VALID_DSC_SUFFIX,
  label: 'Whether Director has Valid Digital Signature Certificate (DSC) Token',
  type: 'select',
  options: [...PRE6_YES_NO_OPTIONS],
};

const PRE6_DSC_EXPIRY_FIELD: FieldTemplate = {
  suffix: PRE6_DSC_EXPIRY_SUFFIX,
  label: 'Digital Signature Certificate (DSC) Token Expiry Date',
  type: 'date',
  placeholder: 'YYYY-MM-DD',
  required: false,
  showWhen: { fieldSuffix: PRE6_HAS_VALID_DSC_SUFFIX, value: 'yes' },
};

const PRE6_DSC_AVAILABILITY_SLOTS_FIELD: FieldTemplate = {
  suffix: PRE6_DSC_AVAILABILITY_SLOTS_SUFFIX,
  label: PRE6_DSC_AVAILABILITY_SLOTS_LABEL,
  type: 'text',
  placeholder: PRE6_DSC_AVAILABILITY_SLOTS_PLACEHOLDER,
  required: false,
};

const PRE6_OTHER_COMPANY_INTEREST_SECTION = 'Existing Interest in Any Other Company/LLP';

function buildOtherCompanyInterestTemplates(): FieldTemplate[] {
  const templates: FieldTemplate[] = [
    {
      suffix: PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX,
      label: 'Do you currently have an interest in any other Company or LLP?',
      type: 'select',
      options: [...PRE6_YES_NO_OPTIONS],
    },
    {
      suffix: PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX,
      label: 'Number of Companies/LLPs',
      type: 'select',
      options: Array.from({ length: PRE6_MAX_OTHER_COMPANY_INTERESTS }, (_, i) => {
        const n = String(i + 1);
        return { value: n, label: n };
      }),
      required: false,
      showWhen: { fieldSuffix: PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX, value: 'yes' },
    },
  ];

  for (let i = 1; i <= PRE6_MAX_OTHER_COMPANY_INTERESTS; i += 1) {
    templates.push(
      {
        suffix: `OtherCompanyInterest${i}Name`,
        label: `Entry ${i} — Name of the Company or LLP`,
        type: 'text',
        required: false,
      },
      {
        suffix: `OtherCompanyInterest${i}Shareholding`,
        label: `Entry ${i} — Shareholding / Contribution Amount`,
        type: 'text',
        required: false,
      },
      {
        suffix: `OtherCompanyInterest${i}Designation`,
        label: `Entry ${i} — Designation (e.g. Director, Managing Director, Partner)`,
        type: 'text',
        required: false,
      },
      {
        suffix: `OtherCompanyInterest${i}StartDate`,
        label: `Entry ${i} — Start Date`,
        type: 'date',
        placeholder: 'YYYY-MM-DD',
        required: false,
      },
      {
        suffix: `OtherCompanyInterest${i}EndDate`,
        label: `Entry ${i} — End Date (if applicable)`,
        type: 'date',
        placeholder: 'YYYY-MM-DD',
        required: false,
      },
    );
  }

  return templates;
}

const PRE6_OTHER_COMPANY_INTEREST_TEMPLATES = buildOtherCompanyInterestTemplates();

const PRE6_NOTARY_APOSTILLE_FIELD: FieldTemplate = {
  suffix: PRE6_NOTARY_APOSTILLE_METHOD_SUFFIX,
  label: 'How will Notary and Apostille be completed?',
  type: 'select',
  options: [...PRE6_NOTARY_APOSTILLE_OPTIONS],
};

const NR_FIELD_TEMPLATES: FieldTemplate[] = [
  { suffix: 'FirstName', label: 'First Name (as per Passport)', type: 'text' },
  {
    suffix: 'MiddleName',
    label: 'Middle Name (as per Passport)',
    type: 'text',
    required: false,
  },
  { suffix: 'LastName', label: 'Last Name', type: 'text' },
  { suffix: 'Gender', label: 'Gender', type: 'select', options: [...PRE6_GENDER_OPTIONS] },
  { suffix: 'Dob', label: 'DOB', type: 'date' },
  { suffix: 'FatherName', label: "Father's name", type: 'text' },
  {
    suffix: 'HighestEducationalQualification',
    label: 'Highest Educational Qualification',
    type: 'select',
    options: [...PRE6_QUALIFICATION_OPTIONS],
  },
  {
    suffix: 'OccupationType',
    label: 'Occupation Type',
    type: 'select',
    options: [...PRE6_OCCUPATION_OPTIONS],
  },
  { suffix: 'PassportNumber', label: 'Passport Number', type: 'text' },
  {
    suffix: 'PassportCopyUrl',
    label: 'Copy of Passport',
    type: 'file',
    accept: '.pdf,image/*',
  },
  { suffix: 'DrivingLicenceNumber', label: 'Driving Licence Number', type: 'text' },
  {
    suffix: 'DrivingLicenceCopyUrl',
    label: 'Copy of Driving Licence',
    type: 'file',
    accept: '.pdf,image/*',
  },
  {
    suffix: 'UtilityBillType',
    label: 'Utility Bill Type',
    type: 'select',
    options: [...PRE6_UTILITY_BILL_OPTIONS],
  },
  { suffix: 'UtilityBillNumber', label: 'Utility Bill Number', type: 'text' },
  { suffix: 'UtilityBillAddress', label: 'Address as per Utility Bill', type: 'textarea' },
  {
    suffix: 'UtilityBillCopyUrl',
    label: 'Copy of Utility Bill',
    type: 'file',
    accept: '.pdf,image/*',
  },
  {
    suffix: 'MobileNumber',
    label: 'Mobile Number incl country code',
    type: 'text',
  },
  {
    suffix: 'PersonalMailId',
    label: 'Personal Mail ID',
    type: 'text',
    placeholder: 'name@example.com',
  },
  {
    suffix: 'OfficialMailId',
    label: 'Official Mail ID',
    type: 'text',
    placeholder: 'name@company.com',
  },
  {
    suffix: 'RecentPhotographUrl',
    label: 'Recent passport-size photograph',
    type: 'file',
    accept: '.pdf,image/*',
  },
  PRE6_NOTARY_APOSTILLE_FIELD,
  ...PRE6_OTHER_COMPANY_INTEREST_TEMPLATES,
];

const RESIDENT_FIELD_TEMPLATES: FieldTemplate[] = [
  {
    suffix: 'FirstName',
    label: 'First Name (as per Permanent Account Number (PAN))',
    type: 'text',
  },
  {
    suffix: 'MiddleName',
    label: 'Middle Name (as per Permanent Account Number (PAN))',
    type: 'text',
    required: false,
  },
  { suffix: 'LastName', label: 'Last Name', type: 'text' },
  { suffix: 'Gender', label: 'Gender', type: 'select', options: [...PRE6_GENDER_OPTIONS] },
  { suffix: 'Dob', label: 'DOB', type: 'date' },
  { suffix: 'FatherName', label: "Father's name", type: 'text' },
  {
    suffix: 'HighestEducationalQualification',
    label: 'Highest Educational Qualification',
    type: 'select',
    options: [...PRE6_QUALIFICATION_OPTIONS],
  },
  {
    suffix: 'OccupationType',
    label: 'Occupation Type',
    type: 'select',
    options: [...PRE6_OCCUPATION_OPTIONS],
  },
  { suffix: 'AadhaarNumber', label: 'Aadhaar Number', type: 'text' },
  {
    suffix: 'AadhaarCopyUrl',
    label: 'Copy of Aadhaar Card',
    type: 'file',
    accept: '.pdf,image/*',
  },
  { suffix: 'PanNumber', label: 'Permanent Account Number (PAN)', type: 'text' },
  {
    suffix: 'PanCopyUrl',
    label: 'Copy of Permanent Account Number (PAN) Card',
    type: 'file',
    accept: '.pdf,image/*',
  },
  {
    suffix: 'UtilityBillType',
    label: 'Utility Bill Type',
    type: 'select',
    options: [...PRE6_UTILITY_BILL_OPTIONS],
  },
  { suffix: 'UtilityBillNumber', label: 'Utility Bill Number', type: 'text' },
  { suffix: 'UtilityBillAddress', label: 'Address as per Utility Bill', type: 'textarea' },
  {
    suffix: 'UtilityBillCopyUrl',
    label: 'Copy of Utility Bill',
    type: 'file',
    accept: '.pdf,image/*',
  },
  {
    suffix: 'MobileNumber',
    label: 'Mobile Number incl country code',
    type: 'text',
  },
  {
    suffix: 'PersonalMailId',
    label: 'Personal Mail ID',
    type: 'text',
    placeholder: 'name@example.com',
  },
  {
    suffix: 'OfficialMailId',
    label: 'Official Mail ID',
    type: 'text',
    placeholder: 'name@company.com',
  },
  {
    suffix: 'RecentPhotographUrl',
    label: 'Recent passport-size photograph',
    type: 'file',
    accept: '.pdf,image/*',
  },
  PRE6_HAS_VALID_DSC_FIELD,
  PRE6_DSC_EXPIRY_FIELD,
  PRE6_DSC_AVAILABILITY_SLOTS_FIELD,
  ...PRE6_OTHER_COMPANY_INTEREST_TEMPLATES,
];

function buildSlotFields(
  prefix: string,
  section: string,
  templates: FieldTemplate[],
  interestSection?: string,
): ChecklistField[] {
  return templates.map((t) => {
    const isInterestField =
      t.suffix === PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX ||
      t.suffix === PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX ||
      parsePre6OtherCompanyInterestEntrySuffix(t.suffix) !== null;
    const fieldSection = isInterestField && interestSection ? interestSection : section;
    return {
      id: `${prefix}${t.suffix}`,
      label: t.label,
      type: t.type,
      section: fieldSection,
      placeholder: t.placeholder,
      accept: t.accept,
      options: t.options,
      required: t.required !== false,
      showWhen: t.showWhen
        ? { field: `${prefix}${t.showWhen.fieldSuffix}`, value: t.showWhen.value }
        : undefined,
    };
  });
}

function isPre6OtherCompanyInterestFieldId(fieldId: string, prefix: string): boolean {
  if (!fieldId.startsWith(prefix)) return false;
  const suffix = fieldId.slice(prefix.length);
  return (
    suffix === PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX ||
    suffix === PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX ||
    parsePre6OtherCompanyInterestEntrySuffix(suffix) !== null
  );
}

/** All possible Pre-6 client fields (up to four NR and four resident KYC slots + shareholders). */
function buildPre6ClientResponseFields(): ChecklistField[] {
  const fields: ChecklistField[] = [];

  for (let slot = 1; slot <= PRE6_MAX_KYC_SLOTS; slot += 1) {
    const nrPrefix = pre6NrFieldPrefix(slot);
    const nrSection =
      slot === 1
        ? 'Non-Resident Director Details'
        : `Director — Non-Resident (${slot})`;
    fields.push(
      ...buildSlotFields(
        nrPrefix,
        nrSection,
        NR_FIELD_TEMPLATES,
        PRE6_OTHER_COMPANY_INTEREST_SECTION,
      ),
    );

    const resPrefix = pre6ResidentFieldPrefix(slot);
    const resSection =
      slot === 1
        ? 'Resident Director Details'
        : `Director — Resident (${slot})`;
    fields.push(
      ...buildSlotFields(
        resPrefix,
        resSection,
        RESIDENT_FIELD_TEMPLATES,
        PRE6_OTHER_COMPANY_INTEREST_SECTION,
      ),
    );
  }

  fields.push(
    {
      id: 'shareholderAuthorizedPerson',
      label:
        'Authorized person acting on behalf of Foreign Entity/Parent to subscribe shares',
      type: 'select',
      section: 'Shareholder Details',
      options: [],
      required: true,
    },
    {
      id: 'shareholderNominee',
      label: 'Nominee shareholder of 1 share',
      type: 'select',
      section: 'Shareholder Details',
      options: [],
      required: true,
    },
    {
      id: 'registeredOfficeCompleteAddress',
      label: 'Complete Address of Proposed Registered Office',
      type: 'textarea',
      section: PRE6_REGISTERED_OFFICE_SECTION,
      required: true,
    },
    {
      id: 'registeredOfficeNocUrl',
      label: 'NOC from landlord',
      type: 'file',
      section: PRE6_REGISTERED_OFFICE_SECTION,
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'registeredOfficeUtilityBillType',
      label: 'Utility Bill Type',
      type: 'select',
      section: PRE6_REGISTERED_OFFICE_SECTION,
      options: [...PRE6_UTILITY_BILL_OPTIONS],
      required: true,
    },
    {
      id: 'registeredOfficeUtilityBillNumber',
      label: 'Utility Bill Number',
      type: 'text',
      section: PRE6_REGISTERED_OFFICE_SECTION,
      required: true,
    },
    {
      id: 'registeredOfficeUtilityBillCopyUrl',
      label: 'Copy of Utility Bill',
      type: 'file',
      section: PRE6_REGISTERED_OFFICE_SECTION,
      accept: '.pdf,image/*',
      required: true,
    },
  );

  return fields;
}

export const PRE6_CLIENT_RESPONSE_FIELDS = buildPre6ClientResponseFields();

const PRE6_ALL_FIELD_IDS = new Set(PRE6_CLIENT_RESPONSE_FIELDS.map((f) => f.id));

export function getPre6VisibleFields(
  allFields: ChecklistField[],
  pre6Responses: ChecklistItemResponses,
  pre1Responses: ChecklistItemResponses,
): ChecklistField[] {
  const slots = getPre6DirectorSlotsFromPre1(pre1Responses);
  if (!slots.length) {
    return allFields.filter((f) => PRE6_SHAREHOLDER_FIELD_IDS.has(f.id));
  }

  const visiblePrefixes = slots.map((s) => s.prefix);
  const sectionByPrefix = new Map(slots.map((s) => [s.prefix, s.sectionTitle]));
  const slotByPrefix = new Map(slots.map((s) => [s.prefix, s]));

  const resolvePrefix = (fieldId: string): string | undefined => {
    for (const prefix of visiblePrefixes) {
      if (fieldIdMatchesPre6Prefix(fieldId, prefix)) return prefix;
    }
    return undefined;
  };

  const visible: ChecklistField[] = [];
  for (const f of allFields) {
    if (PRE6_SHAREHOLDER_FIELD_IDS.has(f.id)) {
      visible.push(f);
      continue;
    }
    if (isPre6RegisteredOfficeFieldId(f.id) && slots.length > 0) {
      visible.push(f);
      continue;
    }
    const prefix = resolvePrefix(f.id);
    if (!prefix) continue;
    if (
      isPre6DscAvailabilitySlotsFieldId(f.id) &&
      !shouldShowPre6DscAvailabilitySlots(pre6Responses, prefix)
    ) {
      continue;
    }
    if (f.showWhen) {
      const whenValue = (pre6Responses[f.showWhen.field] ?? '').trim();
      if (whenValue !== f.showWhen.value) continue;
    }
    const entry = parsePre6OtherCompanyInterestEntryFieldId(f.id, prefix);
    if (entry && !shouldShowPre6OtherCompanyInterestEntry(pre6Responses, prefix, entry.index)) {
      continue;
    }
    if (isPre6OtherCompanyInterestCountFieldId(f.id)) {
      if (!shouldShowPre6OtherCompanyInterestCount(pre6Responses, prefix)) continue;
    }
    const sectionTitle = sectionByPrefix.get(prefix);
    if (isPre6OtherCompanyInterestFieldId(f.id, prefix)) {
      visible.push(f);
    } else {
      visible.push(sectionTitle ? { ...f, section: sectionTitle } : f);
    }
  }
  return visible;
}

function resolvePre6SlotFullName(
  responses: ChecklistItemResponses,
  prefix: string,
): string {
  const fromParts = formatDisplayName(
    responses[`${prefix}FirstName`],
    responses[`${prefix}MiddleName`],
    responses[`${prefix}LastName`],
  );
  if (fromParts) return fromParts;
  return (responses[`${prefix}FullName`] ?? '').trim();
}

export function getPre6DirectorNameOptions(
  responses: ChecklistItemResponses,
  pre1Responses: ChecklistItemResponses = {},
): Array<{ value: string; label: string }> {
  const slots = getPre6DirectorSlotsFromPre1(pre1Responses);
  const names: string[] = [];
  for (const slot of slots) {
    const name = (resolvePre6SlotFullName(responses, slot.prefix) || slot.pre1DisplayName).trim();
    if (name) names.push(name);
  }

  return [...new Set(names)].map((name) => ({ value: name, label: name }));
}

function isValidIsoDate(value: string | undefined | null): boolean {
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

function isPre6ConditionallyRequiredFieldSuffix(suffix: string): boolean {
  return (
    suffix === PRE6_DSC_EXPIRY_SUFFIX ||
    suffix === PRE6_DSC_AVAILABILITY_SLOTS_SUFFIX ||
    suffix === PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX ||
    parsePre6OtherCompanyInterestEntrySuffix(suffix) !== null
  );
}

function collectRequiredFieldIdsForSlot(prefix: string, kind: Pre6DirectorKind): string[] {
  const templates = kind === 'non-resident' ? NR_FIELD_TEMPLATES : RESIDENT_FIELD_TEMPLATES;
  return templates.flatMap((t) => {
    if (t.required === false || isPre6ConditionallyRequiredFieldSuffix(t.suffix)) return [];
    return [`${prefix}${t.suffix}`];
  });
}

export function validatePre6Responses(
  responses: ChecklistItemResponses,
  pre1Responses: ChecklistItemResponses = {},
): Pre6ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  const slots = getPre6DirectorSlotsFromPre1(pre1Responses);
  const requiredIds = new Set<string>();

  for (const slot of slots) {
    for (const id of collectRequiredFieldIdsForSlot(slot.prefix, slot.kind)) {
      if (!PRE6_ALL_FIELD_IDS.has(id)) continue;
      if (
        isPre6DscAvailabilitySlotsFieldId(id) ||
        isPre6DscExpiryFieldId(id) ||
        isPre6OtherCompanyInterestCountFieldId(id) ||
        parsePre6OtherCompanyInterestEntryFieldId(id, slot.prefix)
      ) {
        continue;
      }
      requiredIds.add(id);
    }
  }

  for (const id of PRE6_SHAREHOLDER_FIELD_IDS) {
    if (slots.length > 0) requiredIds.add(id);
  }

  if (slots.length > 0) {
    for (const id of REGISTERED_OFFICE_FIELD_IDS) {
      requiredIds.add(id);
    }
  }

  for (const slot of slots) {
    const first = (responses[`${slot.prefix}FirstName`] ?? '').trim();
    const last = (responses[`${slot.prefix}LastName`] ?? '').trim();
    const legacyFull = (responses[`${slot.prefix}FullName`] ?? '').trim();
    if (!first && !last && !legacyFull) {
      errors[`${slot.prefix}FirstName`] = 'First name is required.';
      errors[`${slot.prefix}LastName`] = 'Last name is required.';
    } else if (!first && !legacyFull) {
      errors[`${slot.prefix}FirstName`] = 'First name is required.';
    } else if (!last && !legacyFull) {
      errors[`${slot.prefix}LastName`] = 'Last name is required.';
    }
  }

  const pre6FieldById = new Map(PRE6_CLIENT_RESPONSE_FIELDS.map((field) => [field.id, field]));

  for (const id of requiredIds) {
    if (id.endsWith('FirstName') || id.endsWith('LastName') || id.endsWith('FullName')) continue;
    const field = pre6FieldById.get(id);
    const value = (responses[id] ?? '').trim();
    if (!value) {
      errors[id] = field?.type === 'file' ? 'Please upload a document.' : 'This field is required.';
    }
  }

  for (const slot of slots) {
    const dobId = `${slot.prefix}Dob`;
    if ((responses[dobId] ?? '').trim() && !isValidIsoDate(responses[dobId])) {
      errors[dobId] = 'Enter a valid date.';
    }

    const genderId = `${slot.prefix}Gender`;
    if (
      (responses[genderId] ?? '').trim() &&
      !PRE6_GENDER_VALUES.has((responses[genderId] ?? '').trim())
    ) {
      errors[genderId] = 'Select a valid gender.';
    }

    const qualId = `${slot.prefix}HighestEducationalQualification`;
    if (
      (responses[qualId] ?? '').trim() &&
      !PRE6_QUALIFICATION_VALUES.has((responses[qualId] ?? '').trim())
    ) {
      errors[qualId] = 'Select a valid qualification.';
    }

    const occId = `${slot.prefix}OccupationType`;
    if (
      (responses[occId] ?? '').trim() &&
      !PRE6_OCCUPATION_VALUES.has((responses[occId] ?? '').trim())
    ) {
      errors[occId] = 'Select a valid occupation.';
    }

    const utilityId = `${slot.prefix}UtilityBillType`;
    if (
      (responses[utilityId] ?? '').trim() &&
      !PRE6_UTILITY_BILL_VALUES.has((responses[utilityId] ?? '').trim())
    ) {
      errors[utilityId] = 'Select a valid utility bill type.';
    }

    for (const mailSuffix of ['PersonalMailId', 'OfficialMailId'] as const) {
      const mailId = `${slot.prefix}${mailSuffix}`;
      const v = (responses[mailId] ?? '').trim();
      if (v && !EMAIL_RE.test(v)) {
        errors[mailId] = 'Enter a valid email address.';
      }
    }

    const hasInterestId = `${slot.prefix}${PRE6_HAS_OTHER_COMPANY_INTEREST_SUFFIX}`;
    const hasInterest = (responses[hasInterestId] ?? '').trim();
    if (!hasInterest) {
      errors[hasInterestId] = 'This field is required.';
    } else if (!PRE6_YES_NO_VALUES.has(hasInterest)) {
      errors[hasInterestId] = 'Select Yes or No.';
    } else if (hasInterest === 'yes') {
      const countId = `${slot.prefix}${PRE6_OTHER_COMPANY_INTEREST_COUNT_SUFFIX}`;
      const countRaw = (responses[countId] ?? '').trim();
      if (!countRaw) {
        errors[countId] = 'This field is required.';
      } else {
        const count = getPre6OtherCompanyInterestCount(responses, slot.prefix);
        if (count < 1) {
          errors[countId] = 'Select the number of Companies/LLPs.';
        } else {
          for (let i = 1; i <= count; i += 1) {
            for (const [part, label] of [
              ['Name', 'Name of the Company or LLP'],
              ['Shareholding', 'Shareholding / Contribution Amount'],
              ['Designation', 'Designation'],
              ['StartDate', 'Start Date'],
            ] as const) {
              const fieldId = `${slot.prefix}OtherCompanyInterest${i}${part}`;
              if (!(responses[fieldId] ?? '').trim()) {
                errors[fieldId] = `${label} is required for entry ${i}.`;
              }
            }
            const endId = `${slot.prefix}OtherCompanyInterest${i}EndDate`;
            const endVal = (responses[endId] ?? '').trim();
            if (endVal && !isValidIsoDate(endVal)) {
              errors[endId] = 'Enter a valid date.';
            }
            const startId = `${slot.prefix}OtherCompanyInterest${i}StartDate`;
            const startVal = (responses[startId] ?? '').trim();
            if (startVal && !isValidIsoDate(startVal)) {
              errors[startId] = 'Enter a valid date.';
            }
          }
        }
      }
    }

    if (slot.kind === 'non-resident') {
      const notaryId = `${slot.prefix}${PRE6_NOTARY_APOSTILLE_METHOD_SUFFIX}`;
      const notary = (responses[notaryId] ?? '').trim();
      if (!notary) {
        errors[notaryId] = 'This field is required.';
      } else if (!PRE6_NOTARY_APOSTILLE_VALUES.has(notary)) {
        errors[notaryId] = 'Select how notary and apostille will be completed.';
      }
    }

    if (slot.kind === 'resident') {
      const hasValidDscId = `${slot.prefix}${PRE6_HAS_VALID_DSC_SUFFIX}`;
      const hasValidDsc = (responses[hasValidDscId] ?? '').trim();
      if (!hasValidDsc) {
        errors[hasValidDscId] = 'This field is required.';
      } else if (!PRE6_YES_NO_VALUES.has(hasValidDsc)) {
        errors[hasValidDscId] = 'Select Yes or No.';
      } else if (hasValidDsc === 'yes') {
        const expiryId = `${slot.prefix}${PRE6_DSC_EXPIRY_SUFFIX}`;
        const expiry = (responses[expiryId] ?? '').trim();
        if (!expiry) {
          errors[expiryId] = 'This field is required.';
        } else if (!isValidIsoDate(expiry)) {
          errors[expiryId] = 'Enter a valid date.';
        }
      } else if (hasValidDsc === 'no') {
        const slotsId = `${slot.prefix}${PRE6_DSC_AVAILABILITY_SLOTS_SUFFIX}`;
        if (!(responses[slotsId] ?? '').trim()) {
          errors[slotsId] = 'This field is required.';
        }
      }
    }
  }

  const directorNames = new Set(
    getPre6DirectorNameOptions(responses, pre1Responses).map((o) => o.value),
  );
  if (
    (responses.shareholderAuthorizedPerson ?? '').trim() &&
    !directorNames.has((responses.shareholderAuthorizedPerson ?? '').trim())
  ) {
    errors.shareholderAuthorizedPerson = 'Select a valid director name.';
  }
  if (
    (responses.shareholderNominee ?? '').trim() &&
    !directorNames.has((responses.shareholderNominee ?? '').trim())
  ) {
    errors.shareholderNominee = 'Select a valid director name.';
  }

  const utilityType = (responses.registeredOfficeUtilityBillType ?? '').trim();
  if (utilityType && !PRE6_UTILITY_BILL_VALUES.has(utilityType)) {
    errors.registeredOfficeUtilityBillType = 'Select a valid utility bill type.';
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}

function isPre6RegisteredOfficeFieldId(fieldId: string): boolean {
  return PRE6_REGISTERED_OFFICE_FIELD_ID_SET.has(fieldId);
}
