import { directorAudienceKind } from '@/lib/incorporation-docs/audiences';
import { PART_A_SECTION } from '@/lib/part-a-sections';
import { resolveSignatoryDisplayName } from '@/lib/person-name';
import { resolveRegisteredOfficeResponses } from '@/lib/registered-office-responses';
import { PROPOSED_DIRECTORS_STEP_ID } from '@/lib/proposed-directors';
import {
  resolveParentEntityAddress,
  resolveParentEntityName,
} from '@/lib/incorporation-docs/parent-entity';
import { resolveProposedCompanyName } from '@/lib/incorporation-docs/shared';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import type { DocPackContext, DocPackDirector, RequiredInput } from '@/lib/doc-pack/types';

/**
 * Required inputs mirror what the generators' missing-field collectors demand
 * (`collectIncorpDocsMissingFields` and friends), so "ready" here means the
 * generate route will not answer 422. Labels are short; the UI prefixes the
 * director from `directorIndex`.
 */

const filled = (value: string | undefined): boolean => Boolean(value?.trim());
const isPlaceholder = (value: string): boolean => !value || value.startsWith('[');

const NAME_APPROVAL_TAB = sectionSlug('Name Approval');
const REGISTERED_OFFICE_TAB = sectionSlug('Registered office');
const DIRECTORS_TAB = sectionSlug('Directors');

export const companyName: RequiredInput = {
  key: 'company.name',
  label: 'Approved company name',
  stepId: 'pre-5',
  tabId: NAME_APPROVAL_TAB,
  isPresent: (ctx) =>
    !isPlaceholder(
      resolveProposedCompanyName(ctx.responses.pre5, ctx.responses.pre1, ctx.engagement ?? null),
    ),
};

export const registeredOfficeAddress: RequiredInput = {
  key: 'company.registeredOffice',
  label: 'Registered office address',
  stepId: 'pre-14',
  tabId: REGISTERED_OFFICE_TAB,
  isPresent: (ctx) =>
    filled(
      resolveRegisteredOfficeResponses(
        ctx.responses.pre6,
        ctx.responses.pre8,
        ctx.responses.pre14,
      ).registeredOfficeCompleteAddress,
    ),
};

function pre1Input(key: string, label: string, section: string, fieldId: string): RequiredInput {
  return {
    key,
    label,
    stepId: 'pre-1',
    tabId: sectionSlug(section),
    isPresent: (ctx) => filled(ctx.responses.pre1[fieldId]),
  };
}

export const authorisedShareCapital = pre1Input(
  'company.authorisedShareCapital',
  'Authorised share capital',
  PART_A_SECTION.shareCapital,
  'authorisedShareCapital',
);
export const paidUpShareCapital = pre1Input(
  'company.paidUpShareCapital',
  'Paid-up share capital',
  PART_A_SECTION.shareCapital,
  'paidUpShareCapital',
);
export const nominalValuePerShare = pre1Input(
  'company.nominalValuePerEquityShare',
  'Nominal value per equity share',
  PART_A_SECTION.shareCapital,
  'nominalValuePerEquityShare',
);

export const parentEntityName: RequiredInput = {
  key: 'parent.name',
  label: 'Parent entity name',
  stepId: 'pre-1',
  tabId: sectionSlug(PART_A_SECTION.foreignEntity),
  isPresent: (ctx) =>
    !isPlaceholder(resolveParentEntityName(ctx.responses.pre1, ctx.engagement ?? null)),
};

export const parentEntityAddress: RequiredInput = {
  key: 'parent.address',
  label: 'Parent entity address',
  stepId: 'pre-1',
  tabId: sectionSlug(PART_A_SECTION.foreignEntity),
  isPresent: (ctx) =>
    !isPlaceholder(resolveParentEntityAddress(ctx.responses.pre1, ctx.engagement ?? null)),
};

export const signatoryName: RequiredInput = {
  key: 'signatory.name',
  label: 'Authorised signatory name',
  stepId: 'pre-1',
  tabId: sectionSlug(PART_A_SECTION.authorizedSignatory),
  isPresent: (ctx) => filled(resolveSignatoryDisplayName(ctx.responses.pre1)),
};

export const signatoryDesignation = pre1Input(
  'signatory.designation',
  'Authorised signatory designation',
  PART_A_SECTION.authorizedSignatory,
  'signatoryDesignation',
);

/** The AOA lists directors; it needs at least one name. */
export const anyDirectorName: RequiredInput = {
  key: 'directors.any',
  label: 'At least one director name',
  stepId: PROPOSED_DIRECTORS_STEP_ID,
  tabId: DIRECTORS_TAB,
  isPresent: (ctx) => ctx.directors.some((d) => filled(d.displayName)),
};

/**
 * The letters and subscription sheets are written for the first non-resident
 * director. When there is none, the missing input points at the directors step.
 */
export const nonResidentDirectorExists: RequiredInput = {
  key: 'directors.nonResident',
  label: 'A non-resident director',
  stepId: PROPOSED_DIRECTORS_STEP_ID,
  tabId: DIRECTORS_TAB,
  isPresent: (ctx) => ctx.directors.some((d) => directorAudienceKind(d.audience) === 'non-resident'),
};

type DirectorFieldSpec = {
  key: string;
  label: string;
  /** Present when any listed `values` key is filled. */
  values: string[];
};

const DIRECTOR_FIELDS = {
  fullName: { key: 'fullName', label: 'Full name', values: ['firstName', 'lastName'] },
  fatherName: { key: 'fatherName', label: "Father's name", values: ['fatherName'] },
  dob: { key: 'dob', label: 'Date of birth', values: ['dob'] },
  address: { key: 'address', label: 'Address as per utility bill', values: ['utilityBillAddress'] },
  email: { key: 'email', label: 'Email', values: ['personalMailId', 'officialMailId'] },
  mobile: { key: 'mobile', label: 'Mobile number', values: ['mobileNumber'] },
  pan: { key: 'pan', label: 'PAN', values: ['panNumber'] },
  utilityBillType: { key: 'utilityBillType', label: 'Utility bill type', values: ['utilityBillType'] },
  passport: { key: 'passport', label: 'Passport number', values: ['passportNumber'] },
} satisfies Record<string, DirectorFieldSpec>;

export type DirectorFieldKey = keyof typeof DIRECTOR_FIELDS;

function directorInput(
  director: DocPackDirector,
  spec: DirectorFieldSpec,
  present?: (ctx: DocPackContext) => boolean,
): RequiredInput {
  const index = director.director.index;
  return {
    key: `director.${index}.${spec.key}`,
    label: spec.label,
    stepId: director.stepId,
    // Legacy pre-6 tabs are generated per slot; link to the step only.
    tabId: director.stepId === PROPOSED_DIRECTORS_STEP_ID ? DIRECTORS_TAB : undefined,
    directorIndex: index,
    isPresent:
      present ?? (() => spec.values.some((v) => filled(director.director.values[v]))),
  };
}

export function directorInputs(
  director: DocPackDirector,
  fields: DirectorFieldKey[],
): RequiredInput[] {
  return fields.map((f) => directorInput(director, DIRECTOR_FIELDS[f]));
}

/** DIR-2 / DIR-8 / INC-9 need the same KYC set; residents also need PAN and bill type. */
export function directorFormInputs(director: DocPackDirector): RequiredInput[] {
  const base = directorInputs(director, ['fullName', 'fatherName', 'dob', 'address', 'email', 'mobile']);
  return directorAudienceKind(director.audience) === 'resident'
    ? [...base, ...directorInputs(director, ['pan', 'utilityBillType'])]
    : base;
}

/** The authorisation letter accepts the NR passport or the parent's registration number. */
export function passportOrParentRegistration(director: DocPackDirector): RequiredInput {
  return directorInput(director, DIRECTOR_FIELDS.passport, (ctx) =>
    filled(director.director.values.passportNumber) ||
    filled(ctx.responses.pre1.parentEntityRegistrationNumber) ||
    filled(ctx.engagement?.parentEntityRegistrationNumber ?? undefined),
  );
}

export function firstNonResident(ctx: DocPackContext): DocPackDirector | undefined {
  return ctx.directors.find((d) => d.audience === 'non-resident');
}
