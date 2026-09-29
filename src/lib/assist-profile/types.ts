/**
 * ASSIST PROFILE — the JSON VCFO Assist fills MCA forms from.
 *
 * The shape is Assist's, not Suite's: it mirrors
 * `vcfo_assist/extension/sample/profile.sample.json` and the keys
 * `extension/lib/mapping.js` reads. Every key is optional because a field
 * Suite does not hold is omitted (and listed in `missing`), never invented.
 */

/** Dates are `DD/MM/YYYY`; numbers are numbers; booleans are booleans. */
export interface AssistPerson {
  firstName?: string;
  middleName?: string;
  surName?: string;
  father?: { firstName?: string; middleName?: string; surName?: string };
  gender?: string;
  dob?: string;
  nationality?: string;
  placeOfBirth?: string;
  occupationType?: string;
  areaOfOccupation?: string;
  othersOccupation?: string;
  education?: string;
  othersEducation?: string;
  pan?: string;
}

export interface AssistInterest {
  cin?: string;
  name?: string;
  address?: string;
  designation?: string;
  percent?: number;
  amount?: number;
}

export interface AssistDirector extends AssistPerson {
  /**
   * Stable Suite id of the director entry (`pre-15` entry id, or `legacy-{n}`).
   * Not read by `mapping.js`; lets a consumer detect that the list was
   * reordered after the profile was generated (QUESTIONS Q1).
   */
  id: string;
  /** 1-based `ProposedDirector.index`; always equals array position + 1. */
  index: number;
  din?: string;
  email?: string;
  mobile?: string;
  countryCode?: string;
  citizenOfIndia?: boolean;
  residentInIndia?: boolean;
  designation?: string;
  category?: string;
  interests?: AssistInterest[];
}

/** The person who signs for a body-corporate subscriber (Part B 6a). */
export type AssistRepresentative = AssistPerson & { din?: string; email?: string };

/**
 * One subscriber, from `planSubscription` (QUESTIONS Q3). A subscriber who is
 * also a proposed director carries that director's details and `id`, and is
 * not repeated in `directors[]` — Assist lists subscriber-directors and
 * `directors[]` together in Part B section 5, so the two sets are disjoint
 * (QUESTIONS Q7).
 */
export interface AssistSubscriber extends Omit<AssistDirector, 'id' | 'index'> {
  /** Stable Suite id of the proposed director this subscriber is; absent otherwise. */
  id?: string;
  /** 1-based position in `subscribers[]`. */
  index: number;
  kind: 'individual' | 'bodyCorporate';
  isDirector: boolean;
  /** Body corporate only. */
  name?: string;
  cin?: string;
  representative?: AssistRepresentative;
  shares?: { equity?: { class?: string; number?: number } };
  /** INC-34 place of signing. */
  place?: string;
}

export interface AssistCapitalClass {
  classes?: number;
  className?: string;
  authorizedShares?: number;
  subscribedShares?: number;
  faceValue?: number;
}

export interface AssistCompany {
  proposedNames?: string[];
  type?: string;
  class?: string;
  category?: string;
  subCategory?: string;
  nicCode?: string;
  nicDescription?: string;
  hasShareCapital?: boolean;
  aoaEntrenched?: boolean;
  capital?: {
    authorized?: number;
    subscribed?: number;
    equity?: AssistCapitalClass;
    preference?: AssistCapitalClass;
  };
}

export interface AssistRegisteredOffice {
  line1?: string;
  line2?: string;
  pincode?: string;
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  mobile?: string;
  email?: string;
  longitude?: string;
  latitude?: string;
  rocOffice?: string;
}

export interface AssistAgile {
  numberOfDirectors?: number;
}

/** INC-33. Only the subscription witness Suite holds on pre-7 (QUESTIONS Q2). */
export interface AssistMoa {
  witness?: { name?: string; address?: string };
}
/** INC-34. Only the subscription witness Suite holds on pre-7 (QUESTIONS Q2). */
export interface AssistAoa {
  witness?: { name?: string; addressDescriptionOccupation?: string; dinPanMembership?: string };
}

export interface AssistProfile {
  /** Suite never emits an MCA credential: `userId` is always `''`. */
  mcaLogin: { userId: '' };
  company: AssistCompany;
  registeredOffice?: AssistRegisteredOffice;
  /** Directors who are not subscribers; subscriber-directors are in `subscribers[]`. */
  directors: AssistDirector[];
  subscribers: AssistSubscriber[];
  agile: AssistAgile;
  moa: AssistMoa;
  aoa: AssistAoa;
}

/** Why a field is absent. Omitted = the Suite field exists and is blank. */
export type AssistMissingReason = string;

/** Mirrors doc-pack's `DocPackMissingInput`, same `key` naming. */
export interface AssistProfileMissing {
  key: string;
  label: string;
  stepId: string;
  tabId?: string;
  directorIndex?: number;
  /**
   * Absent when a Suite step holds the field and it is blank — the lead can
   * fix it in Suite. Present when Suite cannot supply the value at all.
   */
  reason?: AssistMissingReason;
}

export interface AssistProfileNote {
  key: string;
  note: string;
}

export interface AssistProfileResult {
  schemaVersion: number;
  companyName: string;
  profile: AssistProfile;
  missing: AssistProfileMissing[];
  notes: AssistProfileNote[];
}
