import { checklist, getItem } from '@/data/checklist';
import {
  extractItemResponses,
  getClientResponseFields,
  type ChecklistItemResponses,
} from '@/lib/checklist-responses';
import { isRepeatField, repeatEntries, type RepeatEntry, type RepeatField } from '@/lib/checklist-repeat';
import { parseDirectorCount } from '@/lib/checklist-pre1-validation';
import { pre6NrFieldPrefix, pre6ResidentFieldPrefix } from '@/lib/checklist-pre6-validation';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

/**
 * PROPOSED DIRECTORS — one read-side accessor for every consumer.
 *
 * Source of truth is `pre-15` (SPICe+ Part B, repeating entries). Engagements
 * from before 2026-09-16 hold the same facts in two legacy places — the fixed
 * `director{n}*` slots on Part A (`pre-1`) and the `nrDirector*` /
 * `residentDirector*` KYC slots on the deleted Director KYC step (`pre-6`).
 * When `pre-15` has no entries the accessor rebuilds the list from those, so
 * in-flight engagements keep rendering and generating. Nothing is migrated
 * or deleted.
 *
 * The docx generators still speak the legacy shapes (`directorField(pre6, …)`,
 * `resolveDirectors(pre1)`), so `directorResponsesFromState` hands them
 * synthesised `pre1` / `pre6` maps built from the entries — one repoint,
 * every generator unchanged.
 */
export const PROPOSED_DIRECTORS_STEP_ID = 'pre-15';
export const PROPOSED_DIRECTORS_GROUP_ID = 'directors';

export type StepStateMap = Record<string, ChecklistItemStateSlice | undefined> | null | undefined;

export interface ProposedDirector {
  id: string;
  /** 1-based position. */
  index: number;
  /** Relative template values (`firstName`, `gender`, `dob`, `passportCopyUrl`, …). */
  values: Record<string, string>;
}

export function proposedDirectorsGroup(): RepeatField | null {
  const item = getItem(PROPOSED_DIRECTORS_STEP_ID);
  const group = item ? getClientResponseFields(item).find((f) => f.id === PROPOSED_DIRECTORS_GROUP_ID) : undefined;
  return group && isRepeatField(group) ? group : null;
}

function responsesFor(state: StepStateMap, itemId: string): ChecklistItemResponses {
  const item = checklist.find((c) => c.id === itemId);
  return item ? extractItemResponses(item, state?.[itemId]) : {};
}

export function displayName(values: Record<string, string>): string {
  return [values.firstName, values.middleName, values.lastName]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Legacy Part A slot + matching Director KYC slot → one entry. */
function legacyDirectors(pre1: ChecklistItemResponses, pre6: ChecklistItemResponses): ProposedDirector[] {
  const count = parseDirectorCount(pre1);
  const out: ProposedDirector[] = [];
  let nrSlot = 0;
  let residentSlot = 0;
  for (let i = 1; i <= count; i += 1) {
    const resident = (pre1[`director${i}IndiaResident`] ?? '').trim();
    if (!(pre1[`director${i}FirstName`] ?? '').trim() && !(pre1[`director${i}LastName`] ?? '').trim()) continue;
    let prefix: string | null = null;
    if (resident === 'yes') prefix = pre6ResidentFieldPrefix(++residentSlot);
    else if (resident === 'no') prefix = pre6NrFieldPrefix(++nrSlot);
    const kyc: Record<string, string> = {};
    if (prefix) {
      for (const [key, value] of Object.entries(pre6)) {
        if (!key.startsWith(prefix) || !value?.trim()) continue;
        const rest = key.slice(prefix.length);
        // `nrDirector` must not swallow `nrDirector2…`.
        if (/^\d/.test(rest)) continue;
        kyc[rest.charAt(0).toLowerCase() + rest.slice(1)] = value;
      }
    }
    out.push({
      id: `legacy-${i}`,
      index: out.length + 1,
      values: {
        ...kyc,
        firstName: pre1[`director${i}FirstName`] ?? kyc.firstName ?? '',
        middleName: pre1[`director${i}MiddleName`] ?? kyc.middleName ?? '',
        lastName: pre1[`director${i}LastName`] ?? kyc.lastName ?? '',
        gender: pre1[`director${i}Gender`] ?? kyc.gender ?? '',
        indiaResident: resident,
        din: pre1[`director${i}Din`] ?? '',
        hasDsc: pre1[`director${i}HasDsc`] ?? kyc.hasValidDsc ?? '',
        dscExpiryDate: pre1[`director${i}DscExpiryDate`] ?? kyc.dscExpiryDate ?? '',
      },
    });
  }
  return out;
}

/** The proposed directors, from `pre-15` when it has entries, else the legacy slots. */
export function readProposedDirectors(state: StepStateMap): ProposedDirector[] {
  const group = proposedDirectorsGroup();
  if (group) {
    const entries: RepeatEntry[] = repeatEntries(responsesFor(state, PROPOSED_DIRECTORS_STEP_ID), group);
    if (entries.length > 0) return entries;
  }
  return legacyDirectors(responsesFor(state, 'pre-1'), responsesFor(state, 'pre-6'));
}

/** Template id → legacy Director KYC suffix (`residentDirector` + suffix). */
const PRE6_SUFFIX: Record<string, string> = {
  firstName: 'FirstName',
  middleName: 'MiddleName',
  lastName: 'LastName',
  gender: 'Gender',
  dob: 'Dob',
  fatherName: 'FatherName',
  highestEducationalQualification: 'HighestEducationalQualification',
  occupationType: 'OccupationType',
  aadhaarNumber: 'AadhaarNumber',
  aadhaarCopyUrl: 'AadhaarCopyUrl',
  panNumber: 'PanNumber',
  panCopyUrl: 'PanCopyUrl',
  passportNumber: 'PassportNumber',
  passportCopyUrl: 'PassportCopyUrl',
  drivingLicenceNumber: 'DrivingLicenceNumber',
  drivingLicenceCopyUrl: 'DrivingLicenceCopyUrl',
  utilityBillType: 'UtilityBillType',
  utilityBillNumber: 'UtilityBillNumber',
  utilityBillAddress: 'UtilityBillAddress',
  utilityBillCopyUrl: 'UtilityBillCopyUrl',
  mobileNumber: 'MobileNumber',
  personalMailId: 'PersonalMailId',
  officialMailId: 'OfficialMailId',
  recentPhotographUrl: 'RecentPhotographUrl',
  notaryApostilleMethod: 'NotaryApostilleMethod',
  hasDsc: 'HasValidDsc',
  dscExpiryDate: 'DscExpiryDate',
  dscAvailabilitySlots: 'DscAvailabilitySlots',
  hasOtherCompanyInterest: 'HasOtherCompanyInterest',
};

/** The directors in the legacy `pre-6` key shape the docx generators read. */
export function directorsAsPre6Responses(directors: ProposedDirector[]): ChecklistItemResponses {
  const out: ChecklistItemResponses = {};
  let nrSlot = 0;
  let residentSlot = 0;
  for (const director of directors) {
    const resident = (director.values.indiaResident ?? '').trim();
    if (resident !== 'yes' && resident !== 'no') continue;
    const prefix = resident === 'yes' ? pre6ResidentFieldPrefix(++residentSlot) : pre6NrFieldPrefix(++nrSlot);
    for (const [key, suffix] of Object.entries(PRE6_SUFFIX)) {
      const value = (director.values[key] ?? '').trim();
      if (value) out[`${prefix}${suffix}`] = value;
    }
  }
  return out;
}

/** The directors in the legacy Part A slot shape (`director{n}*`). */
export function directorsAsPre1Responses(directors: ProposedDirector[]): ChecklistItemResponses {
  const out: ChecklistItemResponses = { directorCount: String(Math.min(Math.max(directors.length, 2), 4)) };
  directors.slice(0, 4).forEach((director, i) => {
    const n = i + 1;
    const v = director.values;
    const put = (key: string, value: string | undefined) => {
      if (value?.trim()) out[`director${n}${key}`] = value.trim();
    };
    put('FirstName', v.firstName);
    put('MiddleName', v.middleName);
    put('LastName', v.lastName);
    put('Gender', v.gender);
    put('IndiaResident', v.indiaResident);
    put('Din', v.din);
    put('HasDsc', v.hasDsc);
    put('DscExpiryDate', v.dscExpiryDate);
  });
  return out;
}

/**
 * What the generators read: Part A responses with the director slots
 * overlaid from `pre-15`, and a `pre-6`-shaped map — synthesised when
 * `pre-15` has entries, the stored legacy map otherwise.
 */
export function directorResponsesFromState(state: StepStateMap): {
  pre1: ChecklistItemResponses;
  pre6: ChecklistItemResponses;
} {
  const pre1 = responsesFor(state, 'pre-1');
  const pre6 = responsesFor(state, 'pre-6');
  const group = proposedDirectorsGroup();
  const entries = group ? repeatEntries(responsesFor(state, PROPOSED_DIRECTORS_STEP_ID), group) : [];
  if (entries.length === 0) return { pre1, pre6 };
  return {
    pre1: { ...pre1, ...directorsAsPre1Responses(entries) },
    // Registered-office keys still ride on the legacy map until pre-14 lands.
    pre6: { ...pre6, ...directorsAsPre6Responses(entries) },
  };
}

export function hasIndiaResidentDirector(directors: ProposedDirector[]): boolean {
  return directors.some((d) => (d.values.indiaResident ?? '').trim() === 'yes');
}
