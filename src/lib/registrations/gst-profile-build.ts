import { getItem } from '@/data/checklist';
import { extractItemResponses, type ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { resolveRegisteredOfficeResponses } from '@/lib/checklist/registered-office-responses';
import { directorResponsesFromState, readProposedDirectors, type ProposedDirector, type StepStateMap } from '@/lib/incorporation/proposed-directors';
import { resolveProposedCompanyName } from '@/lib/incorporation-docs/shared';
import { splitMobile, toMcaDate, trailingPinCode } from '@/lib/assist-profile/build';
import { fileNameFromStoragePath } from '@/lib/documents/milestone-document-storage';
import {
  GST_ACTIVITY,
  GST_BANK_ACCOUNT_TYPE,
  GST_CLIENT_KEY,
  GST_CONSTITUTION,
  GST_CONSTITUTION_PROOF,
  GST_POSSESSION_NEEDS_NOC,
  GST_SIGNATORY_PROOF,
  GST_EXISTING_REGISTRATION,
  GST_FORM_ID,
  GST_GENDER,
  GST_MAX_CODES,
  GST_POSSESSION,
  GST_PROFILE_SCHEMA_VERSION,
  GST_PROOF_FOR_POSSESSION,
  GST_REASON,
  GST_SBC_KEY,
  gstTerm,
  type GstAddress,
  type GstDocumentRef,
  type GstMissing,
  type GstPlace,
  type GstPrincipalPlace,
  type GstProfile,
  type GstProfileResult,
  type GstPromoter,
  type GstSignatory,
  type GstSource,
} from './gst-profile';
import { GST_STEP_ID } from './gst-tracker';
import { gstPromoterAddressKey, subjectInputs } from '@/data/compliance-inputs';

/**
 * GST REG-01 PROFILE BUILDER — pure. The tool's records in, the profile VCFO Assist fills the GST
 * portal from out, with the readiness list: every value or document REG-01 needs that the tool
 * does not hold yet, and where to get it (SharePoint for what a paper shows, the client for what
 * only they know, the portal for what is looked up there).
 *
 * Sources, first match wins: the company's checklist (pre-12 company PAN, CIN and date; pre-14
 * registered office; pre-15 directors), then the GST step's own fields (`compliance_subject_fields`
 * on `reg-4`: client side for the business facts, SBC side for jurisdiction and the signatory),
 * then the documents asked for on the GST step. Nothing is invented: a value the tool does not
 * hold is omitted and listed in `missing`. No db, no S3, no fetch.
 */

export interface GstRequestFile {
  /** The document request's title ("Rent agreement"), or the vault folder and file name. */
  label: string;
  /** A file on a GST step document request, or one in the document vault. Requests win. */
  source?: 'request' | 'vault';
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  /** `document_request_files.object_key` or `documents.object_key`. */
  objectKey: string;
}

export interface GstBuildInput {
  engagement: {
    id: string;
    slug?: string | null;
    companyName: string;
    entityLegalForm?: string | null;
    incorporationDate?: string | null;
  };
  state: StepStateMap;
  /** `reg-4` client-side field values. */
  client: Record<string, string | null | undefined>;
  /** `reg-4` SBC-side field values. */
  sbc: Record<string, string | null | undefined>;
  /** Files on the GST step's document requests, then the vault's current files. */
  requestFiles: GstRequestFile[];
  /** `reg-4` client-side keys the client entered that the lead has not confirmed. */
  unconfirmed?: readonly string[];
}

const REG4_TAB = 'from-the-client';
const PHOTO_LIMIT_KB = 100;
const PDF_LIMIT_KB = 1024;

const txt = (v: string | null | undefined): string | undefined => {
  const t = (v ?? '').trim();
  return t && !/^\[/.test(t) ? t : undefined;
};

function responses(state: StepStateMap, stepId: string): ChecklistItemResponses {
  const item = getItem(stepId);
  return item ? extractItemResponses(item, state?.[stepId]) : {};
}

/** "Ramesh Kumar Rao" → first / middle / last. One word is a first name only. */
export function splitName(full: string | undefined): { first?: string; middle?: string; last?: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], middle: parts.slice(1, -1).join(' ') || undefined, last: parts[parts.length - 1] };
}

/** A ten-digit Indian mobile, or undefined. */
export function tenDigitMobile(value: string | undefined): string | undefined {
  const split = splitMobile(value);
  if (!split) return undefined;
  const digits = split.mobile.replace(/^0+/, '');
  if (split.countryCode && split.countryCode !== '+91') return undefined;
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : undefined;
}

/** The address as stored plus the parts that can be read from it without guessing. */
export function addressFrom(full: string | undefined, state?: string, district?: string): GstAddress | undefined {
  const whole = txt(full);
  if (!whole) return undefined;
  const pin = trailingPinCode(whole);
  return {
    full: whole,
    ...(pin ? { pincode: pin } : {}),
    ...(state ? { state } : {}),
    ...(district ? { district } : {}),
    country: 'India',
  };
}

function constitutionFor(legalForm: string | null | undefined, companyName: string): string | undefined {
  const name = companyName.trim().toLowerCase();
  if (name.includes('(opc)')) return GST_CONSTITUTION.opc;
  if (legalForm === 'llp' || /\bllp$/.test(name)) return GST_CONSTITUTION.llp;
  if (legalForm === 'partnership') return GST_CONSTITUTION.partnership;
  if (legalForm === 'proprietorship') return GST_CONSTITUTION.proprietorship;
  if (/private limited$|pvt\.? ltd\.?$/.test(name)) return GST_CONSTITUTION.privateLimited;
  if (/limited$|ltd\.?$/.test(name)) return GST_CONSTITUTION.publicLimited;
  return undefined;
}

function yesNo(value: string | undefined): boolean | undefined {
  const v = (value ?? '').trim().toLowerCase();
  if (['yes', 'y', 'true', 'opted', 'opt in'].includes(v)) return true;
  if (['no', 'n', 'false', 'not opted', 'opt out'].includes(v)) return false;
  return undefined;
}

/** "9983 - Software services, 998314 IT design" → codes, at most five, digits 4 to 8. */
export function parseCodes(value: string | undefined): Array<{ code: string; description?: string }> {
  const out: Array<{ code: string; description?: string }> = [];
  for (const piece of (value ?? '').split(/[\n;,]+/)) {
    // The separator is written as an alternation: a bracket class here reads to Tailwind as an
    // arbitrary property and breaks app/globals.css.
    const m = /^\s*(\d{4,8})\s*(?:-|:|\u2013)?\s*(.*)$/.exec(piece);
    if (!m) continue;
    if (out.some((c) => c.code === m[1])) continue;
    out.push({ code: m[1]!, ...(m[2]?.trim() ? { description: m[2].trim() } : {}) });
  }
  return out;
}

function listOf(table: Readonly<Record<string, string>>, value: string | undefined): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const piece of (value ?? '').split(/[\n;,/]+/).map((p) => p.trim()).filter(Boolean)) {
    const term = gstTerm(table, piece);
    if (term) {
      if (!known.includes(term)) known.push(term);
    } else unknown.push(piece);
  }
  return { known, unknown };
}

const coordinate = (value: string | undefined, max: number): number | undefined => {
  const n = Number((value ?? '').trim());
  return (value ?? '').trim() && Number.isFinite(n) && Math.abs(n) <= max ? n : undefined;
};

/** Which uploaded document request answers a GST document. */
const REQUEST_MATCH: Array<[key: string, pattern: RegExp]> = [
  ['place.noc', /\b(noc|no objection|consent)\b/i],
  ['place.proof', /\b(rent|lease|electricity|utility|property tax|khata|ownership|sale deed|address proof)\b/i],
  ['signatory.proof', /\b(board resolution|authori[sz]ation|letter of authority|appointment)\b/i],
  ['bank.proof', /\b(bank|cheque|passbook|statement)\b/i],
];

class Findings {
  readonly missing: GstMissing[] = [];
  readonly notes: Array<{ key: string; note: string }> = [];
  miss(key: string, label: string, opts: { kind?: 'value' | 'document'; source: GstSource; where: string; stepId?: string; tabId?: string; reason?: string; required?: boolean }) {
    if (this.missing.some((m) => m.key === key)) return;
    this.missing.push({
      key,
      label,
      kind: opts.kind ?? 'value',
      source: opts.source,
      where: opts.where,
      stepId: opts.stepId ?? GST_STEP_ID,
      ...(opts.tabId ? { tabId: opts.tabId } : {}),
      ...(opts.reason ? { reason: opts.reason } : {}),
      required: opts.required ?? true,
    });
  }
  note(key: string, note: string) {
    this.notes.push({ key, note });
  }
}

const WHERE = {
  pre12: 'Post-incorporation details (step pre-12)',
  pre14: 'Registered office (step pre-14)',
  pre15: 'Proposed directors (step pre-15)',
  reg4Client: 'GST Registration, "From the client"',
  reg4Sbc: 'GST Registration, SBC fields',
  reg4Docs: 'GST Registration, documents',
  /** A finished step is not reopened for GST: the value goes to the GST step's copy (paste it in Ask VCFO). */
  pre14Copy: 'GST Registration, "From the client" (the registered office step is finished, so the GST copy holds it)',
  pre15Copy: 'GST Registration, SBC fields (the directors step is finished, so the GST copy holds it)',
} as const;

/** A finished checklist step: GST never reopens it, so its missing values go to the GST step's copy. */
const finished = (state: StepStateMap, stepId: string): boolean => state?.[stepId]?.status === 'completed';

function contentTypeFor(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function checklistDoc(key: string, label: string, path: string | undefined, limitKb: number): GstDocumentRef | null {
  const p = txt(path);
  if (!p) return null;
  const fileName = fileNameFromStoragePath(p);
  return { key, label, fileName, contentType: contentTypeFor(fileName), sizeBytes: null, storageKey: p, source: 'checklist', portalLimitKb: limitKb };
}

function personFrom(d: ProposedDirector, f: Findings, docs: GstDocumentRef[], copies: { address?: string; directorsFinished: boolean }): GstPromoter {
  const v = d.values;
  const n = d.index;
  const name = [v.firstName, v.middleName, v.lastName].map((x) => (x ?? '').trim()).filter(Boolean).join(' ') || `Director ${n}`;
  const at = `promoters.${n}`;
  const father = splitName(v.fatherName);
  const resident = (v.indiaResident ?? '').trim().toLowerCase();
  const nationality = (v.nationality ?? '').trim().toLowerCase();
  const citizen = nationality ? nationality === 'india' || nationality === 'indian' : resident === 'yes' ? true : resident === 'no' ? false : undefined;
  const aadhaarDigits = (v.aadhaarNumber ?? '').replace(/\D/g, '');
  const p: GstPromoter = { index: n, id: d.id, designation: txt(v.designation) ?? 'Director' };
  const put = <K extends keyof GstPromoter>(k: K, value: GstPromoter[K] | undefined, label: string, opts: { source: GstSource; required?: boolean }) => {
    if (value !== undefined && value !== '') p[k] = value;
    else f.miss(`${at}.${String(k)}`, `${label} of ${name}`, { source: opts.source, where: WHERE.pre15, stepId: 'pre-15', required: opts.required });
  };
  put('firstName', txt(v.firstName), 'First name', { source: 'sharepoint' });
  if (txt(v.middleName)) p.middleName = txt(v.middleName);
  if (txt(v.lastName)) p.lastName = txt(v.lastName);
  put('fatherFirstName', father.first, "Father's name", { source: 'sharepoint' });
  if (father.middle) p.fatherMiddleName = father.middle;
  if (father.last) p.fatherLastName = father.last;
  put('dob', toMcaDate(v.dob), 'Date of birth', { source: 'sharepoint' });
  put('mobile', tenDigitMobile(v.mobileNumber), 'Mobile number', { source: 'client' });
  put('email', txt(v.personalMailId) ?? txt(v.officialMailId), 'Email', { source: 'client' });
  put('gender', gstTerm(GST_GENDER, v.gender), 'Gender', { source: 'sharepoint' });
  if (citizen !== undefined) p.citizenOfIndia = citizen;
  else f.miss(`${at}.citizenOfIndia`, `Citizenship of ${name}`, { source: 'client', where: WHERE.pre15, stepId: 'pre-15' });
  if (citizen === false) put('passport', txt(v.passportNumber), 'Passport number', { source: 'sharepoint' });
  else put('pan', txt(v.panNumber)?.toUpperCase(), 'PAN', { source: 'sharepoint' });
  // A DIN is allotted with SPICe+; a company not yet incorporated through Suite may have none recorded.
  put('din', txt(v.din), 'DIN', { source: 'sharepoint', required: false });
  if (aadhaarDigits.length === 12) {
    p.aadhaarLast4 = aadhaarDigits.slice(-4);
    p.aadhaarOnFile = true;
  } else p.aadhaarOnFile = false;
  // The GST copy wins: it is written when the directors step is finished, so it is the newer value.
  const address = addressFrom(copies.address ?? v.utilityBillAddress);
  if (address) p.address = address;
  else if (copies.directorsFinished) f.miss(`${at}.address`, `Residential address of ${name}`, { source: 'sharepoint', where: WHERE.pre15Copy, stepId: GST_STEP_ID });
  else f.miss(`${at}.address`, `Residential address of ${name}`, { source: 'sharepoint', where: WHERE.pre15, stepId: 'pre-15' });
  const photo = checklistDoc(`promoter.${n}.photo`, `Photograph of ${name}`, v.recentPhotographUrl, PHOTO_LIMIT_KB);
  if (photo) {
    docs.push(photo);
    p.photo = photo.key;
  } else f.miss(`promoter.${n}.photo`, `Photograph of ${name}`, { kind: 'document', source: 'sharepoint', where: WHERE.pre15, stepId: 'pre-15' });
  const pan = checklistDoc(`promoter.${n}.pan`, `PAN card of ${name}`, v.panCopyUrl, PDF_LIMIT_KB);
  if (pan) docs.push(pan);
  return p;
}

function placeFrom(
  full: string | undefined,
  extra: { state?: string; district?: string; latitude?: string; longitude?: string; possession?: string; activities?: string; email?: string; mobile?: string },
  key: string,
  f: Findings,
  opts: { required: boolean },
): GstPlace {
  const place: GstPlace = {};
  const address = addressFrom(full, extra.state, extra.district);
  if (address) place.address = address;
  else if (opts.required) f.miss(`${key}.address`, 'Address of the principal place of business', { source: 'client', where: WHERE.reg4Client, tabId: REG4_TAB });
  if (address && !address.pincode && opts.required) {
    f.miss(`${key}.address.pincode`, 'PIN code of the principal place', { source: 'client', where: WHERE.reg4Client, tabId: REG4_TAB });
  }
  const lat = coordinate(extra.latitude, 90);
  const lng = coordinate(extra.longitude, 180);
  if (lat !== undefined && lng !== undefined) {
    place.latitude = lat;
    place.longitude = lng;
  } else if (opts.required) {
    f.miss(`${key}.latitude`, 'Latitude and longitude of the principal place', { source: 'portal', where: 'Optional on REG-01; the portal can pick it from the map', required: false });
  }
  if (extra.email) place.email = extra.email;
  if (extra.mobile) place.mobile = extra.mobile;
  const possession = gstTerm(GST_POSSESSION, extra.possession);
  if (possession) {
    place.possession = possession;
    place.proofDocType = GST_PROOF_FOR_POSSESSION[possession];
  } else if (opts.required) {
    f.miss(`${key}.possession`, 'Nature of possession of the premises (owned, rented or leased, consent based, co-working)', {
      source: 'client',
      where: WHERE.reg4Client,
      tabId: REG4_TAB,
      ...(extra.possession ? { reason: 'no GST portal equivalent mapped' } : {}),
    });
  }
  const acts = listOf(GST_ACTIVITY, extra.activities);
  if (acts.known.length) place.activities = acts.known;
  else if (opts.required) f.miss(`${key}.activities`, 'Nature of business activity at the premises', { source: 'client', where: WHERE.reg4Client, tabId: REG4_TAB });
  if (acts.unknown.length) f.note(`${key}.activities`, `Not a GST portal activity, so left out: ${acts.unknown.join(', ')}.`);
  return place;
}

/** Flatten the nested profile into `sourceField` keys; repeat rows are 1-based. */
export function flattenGstProfile(profile: GstProfile): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const walk = (value: unknown, path: string) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      if (value.every((x) => typeof x !== 'object' || x === null)) {
        out[path] = value.join('; ');
        return;
      }
      value.forEach((row, i) => walk(row, `${path}.${i + 1}`));
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        // `index` and `id` locate a promoter; the row number in the key already says it.
        if ((k === 'index' || k === 'id') && /\.\d+$/.test(path)) continue;
        walk(v, path ? `${path}.${k}` : k);
      }
      return;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[path] = value;
  };
  walk(profile, '');
  return out;
}

export function buildGstProfile(input: GstBuildInput): GstProfileResult {
  const f = new Findings();
  const docs: GstDocumentRef[] = [];
  const { state, client, sbc } = input;
  const c = (k: string) => txt(client[k]);
  const s = (k: string) => txt(sbc[k]);

  const pre12 = responses(state, 'pre-12');
  const pre5 = responses(state, 'pre-5');
  const pre14 = responses(state, 'pre-14');
  const { pre1, pre6 } = directorResponsesFromState(state);
  const office = resolveRegisteredOfficeResponses(pre6, responses(state, 'pre-8'), pre14);

  // ---- company ----
  const resolvedName = resolveProposedCompanyName(pre5, pre1, null);
  const legalName = txt(pre12.incorporatedCompanyName) ?? txt(resolvedName) ?? txt(input.engagement.companyName);
  const companyName = legalName ?? input.engagement.companyName;
  const pan = txt(pre12.pan)?.toUpperCase();
  const cin = txt(pre12.cin)?.toUpperCase();
  const incorporationDate = toMcaDate(txt(pre12.dateOfIncorporation) ?? txt(input.engagement.incorporationDate ?? undefined)?.slice(0, 10));
  // The GST copy of the state wins over the registered office step, which GST never reopens.
  const officeState = c(GST_CLIENT_KEY.placeState) ?? txt(office.registeredOfficeState) ?? txt(pre14.registeredOfficeState);
  const district = c('district');

  if (!legalName) f.miss('partA.legalName', 'Legal name of the company as per PAN', { source: 'sharepoint', where: WHERE.pre12, stepId: 'pre-12' });
  if (!pan) f.miss('partA.pan', 'Company PAN', { source: 'sharepoint', where: `${WHERE.pre12}; read from the PAN card or the certificate of incorporation`, stepId: 'pre-12' });
  if (!officeState) {
    if (finished(state, 'pre-14')) f.miss('partA.state', 'State of the principal place', { source: 'sharepoint', where: WHERE.pre14Copy, stepId: GST_STEP_ID, tabId: REG4_TAB });
    else f.miss('partA.state', 'State of the principal place', { source: 'sharepoint', where: WHERE.pre14, stepId: 'pre-14' });
  }
  if (!district) f.miss('partA.district', 'District of the principal place', { source: 'client', where: WHERE.reg4Client, tabId: REG4_TAB });

  // ---- promoters (the directors) and the signatory ----
  const directors = readProposedDirectors(state);
  const directorsFinished = finished(state, 'pre-15');
  const promoters = directors.map((d) => personFrom(d, f, docs, { address: s(gstPromoterAddressKey(d.index)), directorsFinished }));
  if (promoters.length === 0) f.miss('promoters', 'Directors (promoters)', { source: 'sharepoint', where: WHERE.pre15, stepId: 'pre-15' });
  const wanted = Number.parseInt(s(GST_SBC_KEY.signatory) ?? '', 10);
  const signatoryIndex = Number.isFinite(wanted) && promoters.some((p) => p.index === wanted) ? wanted : promoters[0]?.index;
  let signatory: GstSignatory | undefined;
  if (signatoryIndex !== undefined) {
    const chosen = promoters.find((p) => p.index === signatoryIndex)!;
    chosen.isPrimarySignatory = true;
    const { index: _i, id: _id, isPrimarySignatory: _p, ...person } = chosen;
    signatory = { ...person, promoterIndex: signatoryIndex, isPrimarySignatory: true };
    if (s(GST_SBC_KEY.signatory) && !Number.isFinite(wanted)) f.note('signatory', 'The signatory on the GST step is not a director number; the first director is used.');
  }

  // ---- documents asked for on the GST step ----
  const taken = new Set<string>();
  const ordered = [...input.requestFiles.filter((x) => x.source !== 'vault'), ...input.requestFiles.filter((x) => x.source === 'vault')];
  for (const file of ordered) {
    // File names join words with dashes or underscores (`board-resolution.pdf`); read them as spaces.
    const words = `${file.label} ${file.fileName}`.replace(/[_-]+/g, ' ');
    const match = REQUEST_MATCH.find(([key, re]) => !taken.has(key) && re.test(words));
    if (!match) continue;
    taken.add(match[0]);
    docs.push({
      key: match[0],
      label: file.label,
      fileName: file.fileName,
      contentType: file.contentType ?? contentTypeFor(file.fileName),
      sizeBytes: file.sizeBytes,
      storageKey: file.objectKey,
      source: file.source ?? 'request',
      portalLimitKb: PDF_LIMIT_KB,
    });
  }
  const companyPan = checklistDoc('company.pan', 'PAN card of the company', pre12.panCardFinalUrl, PDF_LIMIT_KB);
  if (companyPan) docs.push(companyPan);
  const coi = checklistDoc('company.coi', 'Certificate of incorporation', pre12.certificateOfIncorporationFinalUrl ?? pre1.certificateOfIncorporationUrl, PDF_LIMIT_KB);
  if (coi) docs.push(coi);
  else f.miss('company.coi', 'Certificate of incorporation (proof of constitution)', { kind: 'document', source: 'sharepoint', where: WHERE.pre12, stepId: 'pre-12' });
  // The registered office's own papers stand in when the GST step has none of its own.
  if (!taken.has('place.proof')) {
    const bill = checklistDoc('place.proof', 'Utility bill of the registered office', pre14.registeredOfficeUtilityBillCopyUrl, PDF_LIMIT_KB);
    if (bill) docs.push(bill);
  }
  if (!taken.has('place.noc')) {
    const noc = checklistDoc('place.noc', 'NOC from the owner of the registered office', pre14.registeredOfficeNocUrl, PDF_LIMIT_KB);
    if (noc) docs.push(noc);
  }
  const hasDoc = (key: string) => docs.some((d) => d.key === key);

  if (signatory) {
    if (hasDoc('signatory.proof')) {
      signatory.proofOfAppointment = 'signatory.proof';
      const proof = docs.find((d) => d.key === 'signatory.proof')!;
      signatory.proofDocType = /resolution/i.test(`${proof.label} ${proof.fileName}`) ? GST_SIGNATORY_PROOF.resolution : GST_SIGNATORY_PROOF.letter;
    }
    else f.miss('signatory.proof', 'Board resolution or letter appointing the authorised signatory', { kind: 'document', source: 'client', where: WHERE.reg4Docs });
  }

  // ---- Part A ----
  const partA: GstProfile['partA'] = { applicantType: 'Taxpayer' };
  if (officeState) partA.state = officeState;
  if (district) partA.district = district;
  if (legalName) partA.legalName = legalName;
  if (pan) partA.pan = pan;
  if (signatory?.email) partA.email = signatory.email;
  else f.miss('partA.email', "Authorised signatory's email (the OTP goes here)", { source: 'client', where: WHERE.pre15, stepId: 'pre-15' });
  if (signatory?.mobile) partA.mobile = signatory.mobile;
  else f.miss('partA.mobile', "Authorised signatory's mobile (the OTP goes here)", { source: 'client', where: WHERE.pre15, stepId: 'pre-15' });

  // ---- business ----
  const constitution = constitutionFor(input.engagement.entityLegalForm, companyName);
  if (!constitution) f.miss('business.constitution', 'Constitution of business', { source: 'tool', where: 'The project type (legal form) on the project page', stepId: 'pre-1', reason: 'no GST portal equivalent mapped' });
  const commencement = toMcaDate(c(GST_CLIENT_KEY.commencementDate)) ?? incorporationDate;
  if (!c(GST_CLIENT_KEY.commencementDate) && incorporationDate) f.note('business.commencementDate', 'Date of commencement taken as the date of incorporation; change it on the GST step if the business started later.');
  if (!commencement) f.miss('business.commencementDate', 'Date of commencement of business', { source: 'client', where: WHERE.reg4Client, tabId: REG4_TAB });
  const reasonText = c(GST_CLIENT_KEY.reason);
  const reason = gstTerm(GST_REASON, reasonText);
  if (!reason) {
    f.miss('business.reason', 'Reason to obtain registration (voluntary, crossing the threshold, others)', {
      source: 'client',
      where: WHERE.reg4Client,
      tabId: REG4_TAB,
      ...(reasonText ? { reason: 'no GST portal equivalent mapped' } : {}),
    });
  }
  const jurisdiction: GstProfile['business']['jurisdiction'] = { type: 'state' };
  const jd = s(GST_SBC_KEY.jurisdiction);
  if (district ?? jd) jurisdiction.stateDistrict = district ?? jd;
  if (s(GST_SBC_KEY.sector)) jurisdiction.sector = s(GST_SBC_KEY.sector);
  if (s(GST_SBC_KEY.circle)) jurisdiction.circle = s(GST_SBC_KEY.circle);
  if (s(GST_SBC_KEY.ward)) jurisdiction.ward = s(GST_SBC_KEY.ward);
  if (s(GST_SBC_KEY.commissionerate)) jurisdiction.commissionerate = s(GST_SBC_KEY.commissionerate);
  if (s(GST_SBC_KEY.division)) jurisdiction.division = s(GST_SBC_KEY.division);
  if (s(GST_SBC_KEY.range)) jurisdiction.range = s(GST_SBC_KEY.range);
  if (!jurisdiction.sector) {
    f.miss('business.jurisdiction.sector', 'State jurisdiction (sector / circle / ward)', { source: 'portal', where: 'Pick it on the portal from the PIN code, or record it in the GST step SBC fields', required: false });
  }
  if (!jurisdiction.commissionerate) {
    f.miss('business.jurisdiction.commissionerate', 'Centre jurisdiction (commissionerate / division / range)', { source: 'portal', where: 'Look it up on the CBIC jurisdiction page from the PIN code', required: false });
  }
  const business: GstProfile['business'] = {
    jurisdiction,
    // A company registers as a regular taxpayer at incorporation: not composition, not casual.
    compositionOpted: false,
    casualTaxable: false,
    ...(c(GST_CLIENT_KEY.tradeName) ?? legalName ? { tradeName: c(GST_CLIENT_KEY.tradeName) ?? legalName } : {}),
    ...(constitution ? { constitution } : {}),
    ...(constitution ? { constitutionProofType: constitution === GST_CONSTITUTION.partnership ? GST_CONSTITUTION_PROOF.partnershipDeed : constitution === GST_CONSTITUTION.proprietorship ? undefined : GST_CONSTITUTION_PROOF.coi } : {}),
    ...(commencement ? { commencementDate: commencement } : {}),
    ...(reason ? { reason } : {}),
    ...(reason === 'Others' && reasonText && !/^others?$/i.test(reasonText) ? { reasonOther: reasonText } : {}),
    ...(cin ? { cin } : {}),
    ...(incorporationDate ? { incorporationDate } : {}),
  };

  // ---- existing registrations ----
  const existingRegistrations: GstProfile['existingRegistrations'] = [];
  if (cin) existingRegistrations.push({ type: GST_EXISTING_REGISTRATION.cin, number: cin, ...(incorporationDate ? { date: incorporationDate } : {}) });
  const reg8 = responses(state, 'reg-8');
  if (txt(reg8.iecCode)) existingRegistrations.push({ type: GST_EXISTING_REGISTRATION.iec, number: txt(reg8.iecCode)!, ...(toMcaDate(reg8.iecRegistrationDate) ? { date: toMcaDate(reg8.iecRegistrationDate) } : {}) });
  const reg15 = responses(state, 'reg-15');
  if (txt(reg15.msmeUdyamNumber)) existingRegistrations.push({ type: GST_EXISTING_REGISTRATION.udyam, number: txt(reg15.msmeUdyamNumber)!, ...(toMcaDate(reg15.msmeRegistrationDate) ? { date: toMcaDate(reg15.msmeRegistrationDate) } : {}) });
  if (!cin) f.miss('business.cin', 'Company CIN', { source: 'sharepoint', where: WHERE.pre12, stepId: 'pre-12' });

  // ---- principal place ----
  const placeText = c(GST_CLIENT_KEY.place) ?? txt(office.registeredOfficeCompleteAddress);
  if (!c(GST_CLIENT_KEY.place) && placeText) f.note('principalPlace.address', 'The principal place is taken as the registered office. Record another address on the GST step if the business runs elsewhere.');
  const principal: GstPrincipalPlace = placeFrom(
    placeText,
    {
      state: officeState,
      district,
      latitude: c(GST_CLIENT_KEY.latitude),
      longitude: c(GST_CLIENT_KEY.longitude),
      possession: c(GST_CLIENT_KEY.possession),
      activities: c(GST_CLIENT_KEY.activities),
      email: signatory?.email,
      mobile: signatory?.mobile,
    },
    'principalPlace',
    f,
    { required: true },
  );
  if (principal.address?.full) {
    f.note('principalPlace.address.parts', `The tool holds the address as one line. Type building, road, locality and city from it on the portal: ${principal.address.full}`);
  }
  if (hasDoc('place.proof')) principal.proofDocument = 'place.proof';
  else f.miss('place.proof', 'Proof of the principal place (rent agreement, electricity bill or ownership document)', { kind: 'document', source: 'sharepoint', where: `${WHERE.reg4Docs}, or ${WHERE.pre14}`, stepId: 'pre-14' });
  if (hasDoc('place.noc')) principal.nocDocument = 'place.noc';
  else if (principal.possession && GST_POSSESSION_NEEDS_NOC.has(principal.possession)) {
    f.miss('place.noc', "Owner's NOC or consent letter for the premises", { kind: 'document', source: 'sharepoint', where: `${WHERE.reg4Docs}, or ${WHERE.pre14}`, stepId: 'pre-14' });
  }
  const additionalPlaces = (c(GST_CLIENT_KEY.additionalPlaces) ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => placeFrom(line, {}, `additionalPlaces.${i + 1}`, f, { required: false }));
  principal.hasAdditionalPlaces = additionalPlaces.length > 0;

  // ---- goods and services ----
  const hsn = parseCodes(c(GST_CLIENT_KEY.hsn));
  const sac = parseCodes(c(GST_CLIENT_KEY.sac));
  if (hsn.length > GST_MAX_CODES) f.note('goods', `Only the first ${GST_MAX_CODES} HSN codes go on REG-01.`);
  if (sac.length > GST_MAX_CODES) f.note('services', `Only the first ${GST_MAX_CODES} SAC codes go on REG-01.`);
  if (hsn.length === 0 && sac.length === 0) {
    f.miss('services', 'HSN codes of the goods or SAC codes of the services (top five)', { source: 'client', where: WHERE.reg4Client, tabId: REG4_TAB });
    if (c(GST_CLIENT_KEY.business)) f.note('services', `The client describes the supplies as: ${c(GST_CLIENT_KEY.business)}. Pick the codes from that.`);
  }

  // ---- bank (optional at registration) ----
  const bankAccount = c(GST_CLIENT_KEY.bankAccount)?.replace(/\s/g, '');
  const ifsc = c(GST_CLIENT_KEY.bankIfsc)?.toUpperCase();
  const bank: GstProfile['bank'] =
    bankAccount || ifsc || hasDoc('bank.proof')
      ? {
          ...(bankAccount ? { accountNumber: bankAccount } : {}),
          ...(ifsc && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) ? { ifsc } : {}),
          accountType: gstTerm(GST_BANK_ACCOUNT_TYPE, 'current'),
          ...(hasDoc('bank.proof') ? { proofDocument: 'bank.proof' } : {}),
        }
      : undefined;
  if (!bank) f.miss('bank', 'Bank account (optional at registration; added by amendment after the GSTIN)', { source: 'sharepoint', where: WHERE.reg4Client, tabId: REG4_TAB, required: false });

  // ---- state specific, Aadhaar, verification ----
  const ptRc = responses(state, 'reg-7').ptRegistrationNumberCompany;
  const stateSpecific: GstProfile['stateSpecific'] = {
    ...(c(GST_CLIENT_KEY.ptEc) ? { professionalTaxEc: c(GST_CLIENT_KEY.ptEc) } : {}),
    ...(txt(ptRc) ? { professionalTaxRc: txt(ptRc) } : {}),
  };
  const optIn = yesNo(c(GST_CLIENT_KEY.aadhaarOptIn));
  // Firm practice: opt in, so the registration is not held for physical verification.
  const aadhaar: GstProfile['aadhaar'] = {
    optIn: optIn ?? true,
    persons: optIn === false || signatoryIndex === undefined ? [] : [signatoryIndex, ...promoters.map((p) => p.index).filter((i) => i !== signatoryIndex)],
  };
  if (aadhaar.optIn) f.note('aadhaar', 'Aadhaar authentication: each person named gets an OTP on the Aadhaar-linked mobile after Submit and types it in themselves.');
  const signatoryName = signatory ? [signatory.firstName, signatory.middleName, signatory.lastName].filter(Boolean).join(' ') : '';
  const city = principal.address?.city ?? principal.address?.district;

  const profile: GstProfile = {
    partA,
    business,
    existingRegistrations,
    promoters,
    ...(signatory ? { signatory } : {}),
    principalPlace: principal,
    additionalPlaces,
    goods: hsn.slice(0, GST_MAX_CODES).map((x) => ({ hsn: x.code, ...(x.description ? { description: x.description } : {}) })),
    services: sac.slice(0, GST_MAX_CODES).map((x) => ({ sac: x.code, ...(x.description ? { description: x.description } : {}) })),
    ...(bank ? { bank } : {}),
    stateSpecific,
    aadhaar,
    verification: { ...(signatoryName ? { signatoryName } : {}), ...(city ? { place: city } : {}) },
    meta: { subjectKind: 'registration', subjectKey: GST_STEP_ID, additionalPlacesCount: additionalPlaces.length },
  };

  const required = f.missing.filter((m) => m.required);
  // The client's own entries the lead has not confirmed: used as they stand, listed for a confirm.
  const clientLabels = new Map(subjectInputs('registration', { stepId: GST_STEP_ID }).client.map((field) => [field.key, field.label]));
  const confirm = [...new Set(input.unconfirmed ?? [])].filter((key) => c(key) && clientLabels.has(key)).map((key) => ({ key, label: clientLabels.get(key)! }));
  return {
    schemaVersion: GST_PROFILE_SCHEMA_VERSION,
    form: GST_FORM_ID,
    companyName,
    profile,
    fields: flattenGstProfile(profile),
    documents: docs,
    missing: f.missing,
    notes: f.notes,
    readiness: {
      ready: required.length === 0,
      missingValues: required.filter((m) => m.kind === 'value').length,
      missingDocuments: required.filter((m) => m.kind === 'document').length,
    },
    confirm,
  };
}

/** The required gaps, grouped by where they come from, in the chain's order. */
export function gstGapsBySource(missing: GstMissing[]): Array<{ source: GstSource; items: GstMissing[] }> {
  const order: GstSource[] = ['tool', 'sharepoint', 'zoho', 'client', 'portal'];
  return order
    .map((source) => ({ source, items: missing.filter((m) => m.required && m.source === source) }))
    .filter((g) => g.items.length > 0);
}
