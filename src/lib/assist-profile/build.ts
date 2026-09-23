import { PART_A_SECTION } from '@/lib/part-a-sections';
import {
  PROPOSED_DIRECTORS_STEP_ID,
  readProposedDirectors,
  type ProposedDirector,
} from '@/lib/proposed-directors';
import { resolveRegisteredOfficeResponses } from '@/lib/registered-office-responses';
import { PRE15_MAX_OTHER_INTERESTS } from '@/lib/other-company-interests';
import { resolveProposedCompanyName } from '@/lib/incorporation-docs/shared';
import {
  anyDirectorName,
  authorisedShareCapital,
  nominalValuePerShare,
  paidUpShareCapital,
  registeredOfficeAddress,
} from '@/lib/doc-pack/inputs';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import type { DocPackContext, RequiredInput } from '@/lib/doc-pack/types';
import {
  COUNTRY_INDIA,
  EDUCATION,
  GENDER,
  INTEREST_DESIGNATION,
  OCCUPATION_TYPE,
  companyStructureForName,
  mcaTerm,
} from '@/lib/assist-profile/vocabulary';
import type {
  AssistCompany,
  AssistDirector,
  AssistInterest,
  AssistProfile,
  AssistProfileMissing,
  AssistProfileNote,
  AssistProfileResult,
  AssistRegisteredOffice,
} from '@/lib/assist-profile/types';

/**
 * ASSIST PROFILE BUILDER — pure. `DocPackContext` in, Assist profile out.
 *
 * No db, no S3, no React, no fetch: the clipboard button and the API route
 * share this one implementation. Every value comes through the resolvers the
 * doc pack and docx generators already use, so Assist and the generated
 * documents cannot drift apart. A field Suite does not hold is omitted from
 * the profile and listed in `missing` — never a placeholder, never a guess.
 *
 * Bump `ASSIST_PROFILE_SCHEMA_VERSION` whenever the profile shape changes in
 * a way Assist's `mapping.js` would misread.
 */
export const ASSIST_PROFILE_SCHEMA_VERSION = 1;

/** Missing-item reasons. No reason = the Suite field exists and is blank. */
export const MISSING_REASON = {
  notCollected: 'Suite does not collect this yet',
  noMcaEquivalent: 'no MCA equivalent mapped',
  notSplit: 'Suite holds this as one line of text; MCA asks for it in parts',
  notWholeShares: 'capital does not divide into whole shares at this nominal value',
  unreadable: 'value is not in a form Suite can convert',
} as const;

const NIC_POPUP_NOTE = 'Pick the NIC row from the popup table manually; MainNICCode is read-only.';
const PLACEHOLDER = /^\[/;

const PROPOSED_NAMES_TAB = sectionSlug(PART_A_SECTION.proposedNames);
const BUSINESS_TAB = sectionSlug(PART_A_SECTION.businessDescription);
const COMPANY_MAIL_TAB = sectionSlug(PART_A_SECTION.companyMail);
const COMPANY_MOBILE_TAB = sectionSlug(PART_A_SECTION.companyMobile);
const REGISTERED_OFFICE_TAB = sectionSlug('Registered office');
const DIRECTORS_TAB = sectionSlug('Directors');

// ---------- formats: converted once, here ----------

/** Suite stores ISO `YYYY-MM-DD`; MCA wants `DD/MM/YYYY`. Anything else is unreadable. */
export function toMcaDate(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed) ? trimmed : undefined;
}

/** "10,00,000", "INR 10", "₹ 1,00,000" → number. `undefined` when not a plain amount. */
export function rupeeAmount(value: string | undefined): number | undefined {
  const cleaned = (value ?? '').replace(/inr|rs\.?|₹|,|\s/gi, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** "+91 9999999999" → `{ countryCode: '+91', mobile: '9999999999' }`; a bare number keeps no code. */
export function splitMobile(value: string | undefined): { countryCode?: string; mobile: string } | undefined {
  const trimmed = (value ?? '').trim();
  const withCode = /^\+(\d{1,3})[\s-]+([\d\s-]+)$/.exec(trimmed);
  if (withCode) return { countryCode: `+${withCode[1]}`, mobile: withCode[2]!.replace(/\D/g, '') };
  if (/^[\d\s-]+$/.test(trimmed)) return { mobile: trimmed.replace(/\D/g, '') };
  return undefined;
}

const text = (value: string | undefined): string | undefined => {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : undefined;
};

// ---------- missing / notes ----------

class Findings {
  readonly missing: AssistProfileMissing[] = [];
  readonly notes: AssistProfileNote[] = [];

  miss(item: AssistProfileMissing): void {
    if (this.missing.some((m) => m.key === item.key)) return;
    this.missing.push(item);
  }

  /** A doc-pack required input reported under its own key, step and tab. */
  missInput(input: RequiredInput, reason?: string): void {
    this.miss({
      key: input.key,
      label: input.label,
      stepId: input.stepId,
      ...(input.tabId ? { tabId: input.tabId } : {}),
      ...(input.directorIndex !== undefined ? { directorIndex: input.directorIndex } : {}),
      ...(reason ? { reason } : {}),
    });
  }

  note(key: string, note: string): void {
    this.notes.push({ key, note });
  }
}

// ---------- company (pre-1, pre-5) ----------

/** Reads pre-5 (approved name) and pre-1 (proposed names, NIC, share capital). */
function resolveCompany(ctx: DocPackContext, f: Findings): AssistCompany {
  const { pre1, pre5 } = ctx.responses;
  const company: AssistCompany = {
    // Structural: every company Suite incorporates has share capital and no entrenched articles.
    hasShareCapital: true,
    aoaEntrenched: false,
  };

  const resolved = resolveProposedCompanyName(pre5, pre1, ctx.engagement ?? null);
  const names = [resolved, pre1.proposedName1 ?? '', pre1.proposedName2 ?? '']
    .map((n) => n.trim())
    .filter((n) => n && !PLACEHOLDER.test(n))
    .filter((n, i, all) => all.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i);

  if (names.length === 0) {
    f.miss({ key: 'company.name', label: 'Proposed company name', stepId: 'pre-1', tabId: PROPOSED_NAMES_TAB });
  } else {
    company.proposedNames = names;
    // Before approval Part A files two names; after, the second no longer matters.
    if (!text(pre5.approvedCompanyName) && names.length < 2) {
      f.miss({ key: 'company.proposedName2', label: 'Proposed name 2', stepId: 'pre-1', tabId: PROPOSED_NAMES_TAB });
    }
    const structure = companyStructureForName(names[0]!);
    if (structure) {
      company.type = structure.type;
      company.class = structure.class;
      company.category = structure.category;
    } else {
      f.miss({
        key: 'company.structure',
        label: 'Type, class and category of company',
        stepId: 'pre-1',
        tabId: PROPOSED_NAMES_TAB,
        reason: MISSING_REASON.noMcaEquivalent,
      });
    }
  }
  f.miss({
    key: 'company.subCategory',
    label: 'Sub-category of company',
    stepId: 'pre-1',
    tabId: PROPOSED_NAMES_TAB,
    reason: MISSING_REASON.notCollected,
  });

  const nicCode = text(pre1.nicCode);
  if (nicCode) {
    company.nicCode = nicCode;
    const description = text(pre1.nicBusinessType);
    if (description) company.nicDescription = description;
  } else {
    f.miss({ key: 'company.nicCode', label: 'NIC code', stepId: 'pre-1', tabId: BUSINESS_TAB });
  }
  f.note('company.nicCode', NIC_POPUP_NOTE);

  const capital = resolveCapital(ctx, f);
  if (capital) company.capital = capital;
  return company;
}

/** Reads pre-1 Share Capital Details. Share counts are capital ÷ nominal value, whole shares only. */
function resolveCapital(ctx: DocPackContext, f: Findings): AssistCompany['capital'] {
  const { pre1 } = ctx.responses;
  const amount = (input: RequiredInput, raw: string | undefined): number | undefined => {
    if (!text(raw)) {
      f.missInput(input);
      return undefined;
    }
    const n = rupeeAmount(raw);
    if (n === undefined) f.missInput(input, MISSING_REASON.unreadable);
    return n;
  };
  const authorized = amount(authorisedShareCapital, pre1.authorisedShareCapital);
  const subscribed = amount(paidUpShareCapital, pre1.paidUpShareCapital);
  const faceValue = amount(nominalValuePerShare, pre1.nominalValuePerEquityShare);

  const shares = (total: number | undefined, key: string, label: string): number | undefined => {
    if (total === undefined || faceValue === undefined) return undefined;
    const count = total / faceValue;
    if (Number.isInteger(count)) return count;
    f.miss({
      key,
      label,
      stepId: authorisedShareCapital.stepId,
      tabId: authorisedShareCapital.tabId,
      reason: MISSING_REASON.notWholeShares,
    });
    return undefined;
  };
  const authorizedShares = shares(authorized, 'company.authorisedShares', 'Number of authorised equity shares');
  const subscribedShares = shares(subscribed, 'company.subscribedShares', 'Number of subscribed equity shares');

  return {
    ...(authorized !== undefined ? { authorized } : {}),
    ...(subscribed !== undefined ? { subscribed } : {}),
    equity: {
      // Structural: Suite collects one class of equity shares.
      classes: 1,
      ...(authorizedShares !== undefined ? { authorizedShares } : {}),
      ...(subscribedShares !== undefined ? { subscribedShares } : {}),
      ...(faceValue !== undefined ? { faceValue } : {}),
    },
    // Structural: Suite collects no preference shares.
    preference: { classes: 0 },
  };
}

// ---------- registered office (pre-14, falling back to pre-6 / pre-8; contact from pre-1) ----------

/** Omitted entirely when Suite holds no registered office address. */
function resolveRegisteredOffice(ctx: DocPackContext, f: Findings): AssistRegisteredOffice | undefined {
  const { pre1, pre6, pre8, pre14 } = ctx.responses;
  const address = text(resolveRegisteredOfficeResponses(pre6, pre8, pre14).registeredOfficeCompleteAddress);
  if (!address) {
    f.missInput(registeredOfficeAddress);
    return undefined;
  }

  // Structural: a SPICe+ registered office is always in India.
  const office: AssistRegisteredOffice = { country: COUNTRY_INDIA };
  f.miss({
    key: 'registeredOffice.lines',
    label: 'Registered office line 1, line 2 and PIN code',
    stepId: registeredOfficeAddress.stepId,
    tabId: REGISTERED_OFFICE_TAB,
    reason: MISSING_REASON.notSplit,
  });
  f.note(
    'registeredOffice.lines',
    `Suite holds the registered office as one address. Type line 1, line 2 and the PIN code from it; the PIN code fills area, city, district and state: ${address}`,
  );
  f.miss({
    key: 'registeredOffice.coordinates',
    label: 'Registered office longitude and latitude',
    stepId: registeredOfficeAddress.stepId,
    tabId: REGISTERED_OFFICE_TAB,
    reason: MISSING_REASON.notCollected,
  });

  const email = text(pre1.companyMailId);
  if (email) office.email = email;
  else f.miss({ key: 'company.email', label: 'Company mail ID', stepId: 'pre-1', tabId: COMPANY_MAIL_TAB });

  const mobile = text(pre1.companyMobileNumber);
  if (mobile) {
    const parsed = splitMobile(mobile);
    if (parsed?.mobile) {
      office.mobile = parsed.mobile;
      const code = text(pre1.companyMobileCountryCode) ?? parsed.countryCode;
      if (code) office.countryCode = code;
    } else {
      f.miss({
        key: 'company.mobile',
        label: 'Company mobile number',
        stepId: 'pre-1',
        tabId: COMPANY_MOBILE_TAB,
        reason: MISSING_REASON.unreadable,
      });
    }
  } else {
    f.miss({ key: 'company.mobile', label: 'Company mobile number', stepId: 'pre-1', tabId: COMPANY_MOBILE_TAB });
  }
  return office;
}

// ---------- directors (pre-15, or the legacy pre-1 / pre-6 slots) ----------

const LEGACY_DIRECTOR_ID = /^legacy-/;

function directorStep(director: ProposedDirector): { stepId: string; tabId?: string } {
  return LEGACY_DIRECTOR_ID.test(director.id)
    ? { stepId: 'pre-6' }
    : { stepId: PROPOSED_DIRECTORS_STEP_ID, tabId: DIRECTORS_TAB };
}

/** Fields no director has in Suite: one aggregated `missing` line each, not one per director. */
const DIRECTORS_NOT_COLLECTED: ReadonlyArray<[field: string, label: string]> = [
  ['nationality', 'Nationality and Indian citizenship'],
  ['placeOfBirth', 'Place of birth'],
  ['areaOfOccupation', 'Area of occupation'],
  ['stay', 'Duration of stay at present address'],
];

/**
 * One director. Reads the `ProposedDirector.values` template keys and
 * translates them onto the names `mapping.js`'s `person()` consumes.
 */
function resolveDirector(director: ProposedDirector, f: Findings): AssistDirector {
  const v = director.values;
  const n = director.index;
  const where = directorStep(director);
  const miss = (field: string, label: string, reason?: string) =>
    f.miss({ key: `director.${n}.${field}`, label, ...where, directorIndex: n, ...(reason ? { reason } : {}) });

  const out: AssistDirector = { id: director.id, index: n };

  const firstName = text(v.firstName);
  const middleName = text(v.middleName);
  const surName = text(v.lastName);
  if (firstName) out.firstName = firstName;
  if (middleName) out.middleName = middleName;
  if (surName) out.surName = surName;
  if (!firstName && !surName) miss('fullName', 'Full name');

  const father = text(v.fatherName);
  if (father) {
    miss('fatherName', "Father's first, middle and surname", MISSING_REASON.notSplit);
    f.note(`director.${n}.fatherName`, `Father's name in Suite: ${father}`);
  } else {
    miss('fatherName', "Father's name");
  }

  const gender = text(v.gender);
  if (!gender) miss('gender', 'Gender');
  else {
    const term = mcaTerm(GENDER, gender);
    if (term) out.gender = term;
    else miss('gender', 'Gender', MISSING_REASON.noMcaEquivalent);
  }

  const dob = text(v.dob);
  if (!dob) miss('dob', 'Date of birth');
  else {
    const date = toMcaDate(dob);
    if (date) out.dob = date;
    else miss('dob', 'Date of birth', MISSING_REASON.unreadable);
  }

  const resident = text(v.indiaResident);
  if (resident === 'yes') out.residentInIndia = true;
  else if (resident === 'no') {
    out.residentInIndia = false;
    f.note(
      `director.${n}.nationality`,
      'Non-resident director: Suite does not hold nationality or Indian citizenship. Set both on the portal.',
    );
  } else miss('residency', 'Resident of India?');

  const occupation = text(v.occupationType);
  if (occupation) {
    const term = mcaTerm(OCCUPATION_TYPE, occupation);
    if (term) out.occupationType = term;
    else miss('occupationType', 'Occupation type', MISSING_REASON.noMcaEquivalent);
    if (occupation === 'others') miss('othersOccupation', 'Occupation (if others)', MISSING_REASON.notCollected);
  } else miss('occupationType', 'Occupation type');

  const education = text(v.highestEducationalQualification);
  if (education) {
    const term = mcaTerm(EDUCATION, education);
    if (term) out.education = term;
    else miss('education', 'Educational qualification', MISSING_REASON.noMcaEquivalent);
    if (education === 'others') miss('othersEducation', 'Qualification (if others)', MISSING_REASON.notCollected);
  } else miss('education', 'Educational qualification');

  // PAN is asked of resident directors only; a non-resident has none to give.
  if (resident === 'yes') {
    const pan = text(v.panNumber);
    if (pan) out.pan = pan.toUpperCase();
    else miss('pan', 'PAN');
  }

  const din = text(v.din);
  if (din) out.din = din;

  const email = text(v.personalMailId) ?? text(v.officialMailId);
  if (email) out.email = email;
  else miss('email', 'Email');

  const mobileRaw = text(v.mobileNumber);
  if (!mobileRaw) miss('mobile', 'Mobile number');
  else {
    const parsed = splitMobile(mobileRaw);
    if (parsed?.mobile) {
      out.mobile = parsed.mobile;
      if (parsed.countryCode) out.countryCode = parsed.countryCode;
    } else miss('mobile', 'Mobile number', MISSING_REASON.unreadable);
  }

  if (text(v.utilityBillAddress)) miss('address', 'Permanent address in parts', MISSING_REASON.notSplit);
  else miss('address', 'Address as per utility bill');

  const interests = resolveInterests(director, miss);
  if (interests.length > 0) out.interests = interests;
  return out;
}

/** `pre-15` other-company interests (`otherInterest{i}Company|Cin|Designation`). */
function resolveInterests(
  director: ProposedDirector,
  miss: (field: string, label: string, reason?: string) => void,
): AssistInterest[] {
  const v = director.values;
  if (text(v.hasOtherCompanyInterest) !== 'yes') return [];
  const out: AssistInterest[] = [];
  for (let i = 1; i <= PRE15_MAX_OTHER_INTERESTS; i += 1) {
    const name = text(v[`otherInterest${i}Company`]);
    if (!name) continue;
    const interest: AssistInterest = { name };
    const cin = text(v[`otherInterest${i}Cin`]);
    if (cin) interest.cin = cin.toUpperCase();
    const designation = text(v[`otherInterest${i}Designation`]);
    if (designation) {
      const term = mcaTerm(INTEREST_DESIGNATION, designation);
      if (term) interest.designation = term;
      else miss(`interest${i}.designation`, `Interest ${i} designation`, MISSING_REASON.noMcaEquivalent);
    }
    out.push(interest);
  }
  if (out.length > 0) {
    miss('interests.shareholding', 'Shareholding % and amount in other companies', MISSING_REASON.notCollected);
  }
  return out;
}

/** Reads `pre-15` through `readProposedDirectors`. Order and `index` are preserved exactly. */
function resolveDirectors(ctx: DocPackContext, f: Findings): AssistDirector[] {
  const directors = readProposedDirectors(ctx.state);
  if (directors.length === 0) {
    f.missInput(anyDirectorName);
    return [];
  }
  const out = directors.map((d) => resolveDirector(d, f));
  const step = directorStep(directors[0]!);
  for (const [field, label] of DIRECTORS_NOT_COLLECTED) {
    f.miss({ key: `directors.${field}`, label, ...step, reason: MISSING_REASON.notCollected });
  }
  f.note(
    'directors.designation',
    "Suite does not hold each director's designation or category (Director / Promoter). Choose them on the portal.",
  );
  return out;
}

// ---------- subscribers (pre-16) ----------

/**
 * Subscribers are not emitted yet: Suite has no resolver for `pre-16`, and
 * which directors subscribe (and for how many shares) is not recorded
 * anywhere. See QUESTIONS Q3.
 */
function reportSubscribers(f: Findings): void {
  f.miss({
    key: 'subscribers',
    label: 'Subscribers and the shares each takes',
    stepId: 'pre-16',
    tabId: sectionSlug('Subscribers'),
    reason: MISSING_REASON.notCollected,
  });
  f.note(
    'subscribers',
    'No subscribers are sent. Enter the subscribers and the Part B section 3 counts on the portal.',
  );
}

// ---------- AGILE-PRO-S, INC-33 e-MoA, INC-34 e-AoA ----------

/** Where these e-forms are filled; Suite collects none of their own inputs yet (QUESTIONS Q5). */
const EFORMS_STEP_ID = 'pre-10';

/**
 * Suite-held inputs for the three e-forms, and the list of what it lacks.
 * Most of it resolves to `missing` — that list is the specification for
 * what Suite should collect next, not a failure. Nothing is written to
 * `checklist_state` to fill it.
 */
const EFORM_GAPS: ReadonlyArray<[key: string, label: string]> = [
  ['agile.gstin', 'AGILE-PRO-S: GSTIN application and jurisdiction'],
  ['agile.premises', 'AGILE-PRO-S: principal place of business — possession, lease and proof'],
  ['agile.businessActivity', 'AGILE-PRO-S: primary business activity, nature of work and HSN code'],
  ['agile.authorizedSignatory', 'AGILE-PRO-S: which director signs, with mobile and email'],
  ['agile.esic', 'AGILE-PRO-S: police station and ESIC branch / inspection office'],
  ['agile.bank', 'AGILE-PRO-S: bank for the company account'],
  ['agile.declaration', 'AGILE-PRO-S: declaration place and date'],
  ['moa.objects', 'INC-33: objects to be pursued and matters necessary for them'],
  ['moa.liabilityClause', 'INC-33: liability clause'],
  ['moa.witness', 'INC-33: witness name, parentage, address, age and membership'],
  ['aoa.witness', 'INC-34: witness name, address, occupation, DIN / PAN / membership and place'],
  ['aoa.subscriberPlaces', 'INC-34: place of signing for each subscriber'],
];

function resolveEforms(directors: AssistDirector[], f: Findings): Pick<AssistProfile, 'agile' | 'moa' | 'aoa'> {
  for (const [key, label] of EFORM_GAPS) {
    f.miss({ key, label, stepId: EFORMS_STEP_ID, reason: MISSING_REASON.notCollected });
  }
  f.note(
    'agile.declarations',
    'Suite does not hold the AGILE-PRO-S declarations or the GSTIN, lease, composition and hired-premises answers. Answer each on the portal.',
  );
  f.note('moa.table', 'Suite does not choose the MoA / AoA table. A company limited by shares uses Table A (MoA) and Table F (AoA).');
  return {
    // Counted from pre-15 through the same accessor as `directors[]`.
    agile: directors.length > 0 ? { numberOfDirectors: directors.length } : {},
    moa: {},
    aoa: {},
  };
}

// ---------- entry point ----------

export function buildAssistProfile(ctx: DocPackContext): AssistProfileResult {
  const f = new Findings();
  const company = resolveCompany(ctx, f);
  const registeredOffice = resolveRegisteredOffice(ctx, f);
  const directors = resolveDirectors(ctx, f);
  reportSubscribers(f);
  const eforms = resolveEforms(directors, f);

  const profile: AssistProfile = {
    // Suite never emits an MCA credential.
    mcaLogin: { userId: '' },
    company,
    ...(registeredOffice ? { registeredOffice } : {}),
    directors,
    ...eforms,
  };

  const resolvedName = resolveProposedCompanyName(ctx.responses.pre5, ctx.responses.pre1, ctx.engagement ?? null);
  return {
    schemaVersion: ASSIST_PROFILE_SCHEMA_VERSION,
    companyName: PLACEHOLDER.test(resolvedName) ? '' : resolvedName,
    profile,
    missing: f.missing,
    notes: f.notes,
  };
}
