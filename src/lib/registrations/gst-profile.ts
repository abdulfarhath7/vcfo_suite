/**
 * GST REG-01 PROFILE — the typed contract between VCFO Suite and the VCFO Assist extension for
 * the GST registration application (`form: 'gst-reg-01'`). Suite owns the vocabulary: the
 * extension's field maps may only reference a `sourceField` in `GST_SOURCE_FIELDS`. The prose
 * copy for the extension team is `vcfo_assist/docs/gst-profile-contract.md`; when the two
 * disagree, this file wins and the doc is corrected.
 *
 * Firm policy SBC-STD-AI-02, "Agents prepare. Humans file.": the person signs in to the GST
 * portal, types every OTP and the captcha, does the Aadhaar authentication, signs with DSC or
 * EVC and presses Submit. Nothing here carries a portal password, an OTP, an EVC or a full
 * Aadhaar number.
 *
 * Pure: types and constants only, so the builder, the routes, the browser and the tests share
 * them.
 */

export const GST_FORM_ID = 'gst-reg-01';
export const GST_PROFILE_SCHEMA_VERSION = 1;
/** Where the person starts a new registration on the portal. */
export const GST_PORTAL_NEW_REGISTRATION_URL = 'https://reg.gst.gov.in/registration/';
/** At most five HSN and five SAC rows go on REG-01. */
export const GST_MAX_CODES = 5;
/** Lifetime of the signed document URLs in the profile. */
export const GST_DOCUMENT_URL_SECONDS = 15 * 60;

// ---------- vocabulary: the GST portal's own label text ----------
// Taken from the REG-01 form as published in the GST portal user manual. The GST pack has no
// recorder capture yet (`assist-agents/packs/gst.json`), so the extension must check each label
// against the live dropdown before the CS opinion allows a live fill; a label that changes on the
// portal changes here only.

/** Suite legal form → "Constitution of Business". */
export const GST_CONSTITUTION = {
  privateLimited: 'Private Limited Company',
  publicLimited: 'Public Limited Company',
  opc: 'One Person Company',
  llp: 'Limited Liability Partnership',
  partnership: 'Partnership',
  proprietorship: 'Proprietorship',
  others: 'Others',
} as const;

/** Suite reason key → "Reason to obtain registration". */
export const GST_REASON: Readonly<Record<string, string>> = {
  voluntary: 'Voluntary Basis',
  'voluntary basis': 'Voluntary Basis',
  threshold: 'Crossing the Threshold',
  'crossing the threshold': 'Crossing the Threshold',
  'inter-state': 'Inter-State supply',
  'inter state supply': 'Inter-State supply',
  'e-commerce': 'Supplies through E-Commerce Operator',
  'e-commerce operator': 'Supplies through E-Commerce Operator',
  isd: 'Input Service Distributor only',
  others: 'Others',
  other: 'Others',
};

/**
 * "Nature of possession of premises": the live master (`/master/natpos/aplrg`, read by the
 * extension on 25 Nov 2026).
 */
export const GST_POSSESSION: Readonly<Record<string, string>> = {
  own: 'Owned',
  owned: 'Owned',
  ownership: 'Owned',
  rented: 'Rented/Leased',
  rent: 'Rented/Leased',
  leased: 'Rented/Leased',
  lease: 'Rented/Leased',
  'rented/leased': 'Rented/Leased',
  consent: 'Consent Based',
  'consent based': 'Consent Based',
  shared: 'Consent Based',
  'co-working': 'Co-working Space',
  coworking: 'Co-working Space',
  'co-working space': 'Co-working Space',
  sez: 'Special Economic Zone',
  'special economic zone': 'Special Economic Zone',
  'deceased ancestor': 'In the name of deceased ancestor',
  'in the name of deceased ancestor': 'In the name of deceased ancestor',
};

/** "Document proof" of a place (the live list; the portal matches case-insensitively). */
export const GST_PROOF_OF_PLACE = {
  electricityBill: 'Electricity Bill',
  rentAgreement: 'Rent / Lease agreement',
  consentLetter: 'Consent Letter',
  ownership: 'Legal ownership document',
  khata: 'Municipal Khata Copy',
  propertyTax: 'Property Tax Receipt',
  rentReceiptWithNoc: 'Rent receipt with NOC (In case of no/expired agreement)',
  waterBill: 'Water Bill',
  affidavit: 'Affidavit',
  undertaking: 'Undertaking',
  membership: 'Membership Agreement',
} as const;

/** The proof a possession calls for first (the portal accepts any one of its list). */
export const GST_PROOF_FOR_POSSESSION: Readonly<Record<string, string>> = {
  Owned: GST_PROOF_OF_PLACE.electricityBill,
  'Rented/Leased': GST_PROOF_OF_PLACE.rentAgreement,
  'Consent Based': GST_PROOF_OF_PLACE.consentLetter,
  'Co-working Space': GST_PROOF_OF_PLACE.membership,
  'Special Economic Zone': GST_PROOF_OF_PLACE.electricityBill,
  'In the name of deceased ancestor': GST_PROOF_OF_PLACE.affidavit,
};

/** Possessions where the owner's NOC or consent letter goes with the proof. */
export const GST_POSSESSION_NEEDS_NOC: ReadonlySet<string> = new Set(['Rented/Leased', 'Consent Based']);

/** "Proof of Constitution of Business" document type (`/master/doclist/bd/active`). */
export const GST_CONSTITUTION_PROOF = {
  coi: 'Certificate of Incorporation',
  moaAoa: 'Memorandum of Association and Articles of Association',
  partnershipDeed: 'Partnership Deed',
  registration: 'Registration Certificate',
} as const;

/** "Proof of details of authorised signatory" document type. */
export const GST_SIGNATORY_PROOF = {
  letter: 'Letter of Authorisation',
  resolution: 'Copy of resolution passed by BoD / Managing Committee',
} as const;

/** "Nature of business activity being carried out at above mentioned premises". */
export const GST_ACTIVITY: Readonly<Record<string, string>> = {
  office: 'Office / Sale Office',
  'sale office': 'Office / Sale Office',
  services: 'Supplier of Services',
  'supplier of services': 'Supplier of Services',
  retail: 'Retail Business',
  wholesale: 'Wholesale Business',
  factory: 'Factory / Manufacturing',
  manufacturing: 'Factory / Manufacturing',
  warehouse: 'Warehouse / Depot',
  export: 'Export',
  import: 'Import',
  recipient: 'Recipient of Goods or Services',
  'bonded warehouse': 'Bonded Warehouse',
  eou: 'EOU / STP / EHTP',
  leasing: 'Leasing Business',
  'works contract': 'Works Contract',
  others: 'Others',
};

export const GST_GENDER: Readonly<Record<string, string>> = { male: 'Male', female: 'Female', other: 'Others', others: 'Others' };

export const GST_BANK_ACCOUNT_TYPE: Readonly<Record<string, string>> = {
  current: 'Current Account',
  'current account': 'Current Account',
  savings: 'Savings',
  'cash credit': 'Cash Credit',
  overdraft: 'Overdraft',
  others: 'Others',
};

/** "Type of registration" in the existing registrations table. */
export const GST_EXISTING_REGISTRATION = {
  cin: 'Corporate Identity Number/Foreign Company Registration Number',
  iec: 'Importer/Exporter Code Number',
  udyam: 'Udyog Aadhaar / Udyam Registration',
  pt: 'Registration under State Professional Tax Act',
  shops: 'Shop & Establishment Registration Number',
  others: 'Others (Please specify)',
} as const;

/** Look up a Suite value in a vocabulary table; undefined when it has no portal equivalent. */
export function gstTerm(table: Readonly<Record<string, string>>, value: string | null | undefined): string | undefined {
  const key = (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return undefined;
  if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  // The portal's own label typed back in is accepted as is.
  return Object.values(table).find((label) => label.toLowerCase() === key);
}

// ---------- the profile ----------

export interface GstAddress {
  building?: string;
  floor?: string;
  premises?: string;
  road?: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
  /** The whole address as Suite stores it, for display and for typing the parts by hand. */
  full?: string;
}

export interface GstPerson {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fatherFirstName?: string;
  fatherMiddleName?: string;
  fatherLastName?: string;
  /** DD/MM/YYYY. */
  dob?: string;
  /** Ten digits, no country code. */
  mobile?: string;
  email?: string;
  gender?: string;
  designation?: string;
  din?: string;
  citizenOfIndia?: boolean;
  pan?: string;
  passport?: string;
  /** Display only: the person types the full Aadhaar number on the portal. */
  aadhaarLast4?: string;
  aadhaarOnFile?: boolean;
  address?: GstAddress;
  /** Document key of the photograph (`promoter.N.photo`). */
  photo?: string;
}

export interface GstPromoter extends GstPerson {
  /** 1-based; equals the array position + 1. */
  index: number;
  /** Stable Suite id of the director entry. */
  id: string;
  isPrimarySignatory?: boolean;
}

export interface GstSignatory extends GstPerson {
  promoterIndex?: number;
  /** The signatory tab's own "Primary Authorized Signatory" tick. */
  isPrimarySignatory?: boolean;
  /** Document type of the proof of appointment (`GST_SIGNATORY_PROOF`). */
  proofDocType?: string;
  /** Document key of the proof of appointment (`signatory.proof`). */
  proofOfAppointment?: string;
}

export interface GstPlace {
  address?: GstAddress;
  latitude?: number;
  longitude?: number;
  email?: string;
  officePhone?: string;
  mobile?: string;
  possession?: string;
  proofDocType?: string;
  /** Document key (`place.proof`, `place.N.proof`). */
  proofDocument?: string;
  /** Document key of the owner's NOC / consent letter (`place.noc`). */
  nocDocument?: string;
  activities?: string[];
}

export interface GstPrincipalPlace extends GstPlace {
  hasAdditionalPlaces?: boolean;
}

export interface GstCode {
  code: string;
  description?: string;
}

export interface GstProfile {
  partA: {
    applicantType: 'Taxpayer';
    state?: string;
    district?: string;
    legalName?: string;
    pan?: string;
    email?: string;
    mobile?: string;
  };
  business: {
    tradeName?: string;
    constitution?: string;
    /** Document type of the constitution proof; the portal's upload stays disabled until it is chosen. */
    constitutionProofType?: string;
    jurisdiction: {
      type: 'state';
      stateDistrict?: string;
      sector?: string;
      circle?: string;
      ward?: string;
      commissionerate?: string;
      division?: string;
      range?: string;
    };
    compositionOpted: boolean;
    casualTaxable: boolean;
    commencementDate?: string;
    liabilityDate?: string;
    reason?: string;
    reasonOther?: string;
    cin?: string;
    incorporationDate?: string;
  };
  existingRegistrations: Array<{ type: string; number: string; date?: string }>;
  promoters: GstPromoter[];
  signatory?: GstSignatory;
  principalPlace: GstPrincipalPlace;
  additionalPlaces: GstPlace[];
  goods: Array<{ hsn: string; description?: string }>;
  services: Array<{ sac: string; description?: string }>;
  bank?: { accountNumber?: string; ifsc?: string; accountType?: string; proofDocument?: string };
  stateSpecific: { professionalTaxEc?: string; professionalTaxRc?: string; stateExciseLicence?: string; stateExciseLicenceHolder?: string };
  aadhaar: { optIn: boolean; persons: number[] };
  verification: { signatoryName?: string; place?: string };
  /** Where the result is posted back, and counts the portal asks for. */
  meta: { subjectKind: 'registration'; subjectKey: string; additionalPlacesCount: number };
}

/** Where a missing value can come from, in the order the chain tries. */
export type GstSource = 'tool' | 'sharepoint' | 'zoho' | 'client' | 'portal';

export interface GstMissing {
  /** The `sourceField` (or document key) that is missing. */
  key: string;
  label: string;
  kind: 'value' | 'document';
  /** The best place to get it. */
  source: GstSource;
  /** One plain line: where in the tool it is typed, or which paper it is read from. */
  where: string;
  /** The tool's step that holds it, for the "Fix in Suite" link. */
  stepId: string;
  tabId?: string;
  /** Set when Suite cannot hold the value at all (it is typed on the portal). */
  reason?: string;
  /** Required on REG-01; optional ones never block readiness. */
  required: boolean;
}

export interface GstDocumentRef {
  key: string;
  label: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  /** The stored path or object key (`documentStorageKey` resolves it); never sent to the extension, the signed URL is. */
  storageKey: string;
  source: 'checklist' | 'request' | 'vault';
  portalLimitKb: number;
}

export interface GstDocument extends Omit<GstDocumentRef, 'storageKey'> {
  /** Signed S3 URL, short-lived. The extension does not use it (no egress but Suite). */
  url: string;
  /** Same-origin path the extension reads the file from: the Assist attachments route. */
  attachmentPath?: string;
  expiresAt: string;
}

export interface GstReadiness {
  ready: boolean;
  missingValues: number;
  missingDocuments: number;
}

export interface GstProfileResult {
  schemaVersion: typeof GST_PROFILE_SCHEMA_VERSION;
  form: typeof GST_FORM_ID;
  companyName: string;
  profile: GstProfile;
  /** Flat `sourceField` → value (repeat rows `section.N.key`, N 1-based). */
  fields: Record<string, string | number | boolean>;
  documents: GstDocumentRef[];
  missing: GstMissing[];
  notes: Array<{ key: string; note: string }>;
  readiness: GstReadiness;
  /**
   * GST step values the client entered that the project lead has not confirmed yet ("Confirm" on
   * the GST step's "From the client" card). They are used as they stand and do not block the
   * application; the lead is asked to confirm them.
   */
  confirm: Array<{ key: string; label: string }>;
}

// ---------- the sourceField vocabulary ----------

const PERSON_KEYS = [
  'firstName',
  'middleName',
  'lastName',
  'fatherFirstName',
  'fatherMiddleName',
  'fatherLastName',
  'dob',
  'mobile',
  'email',
  'gender',
  'designation',
  'din',
  'citizenOfIndia',
  'pan',
  'passport',
  'aadhaarLast4',
  'aadhaarOnFile',
  'photo',
] as const;
const ADDRESS_KEYS = ['building', 'floor', 'premises', 'road', 'locality', 'city', 'district', 'state', 'pincode', 'country', 'full'] as const;
const PLACE_KEYS = [
  ...ADDRESS_KEYS.map((k) => `address.${k}`),
  'latitude',
  'longitude',
  'email',
  'officePhone',
  'mobile',
  'possession',
  'proofDocType',
  'proofDocument',
  'nocDocument',
  'activities',
] as const;

/**
 * Every `sourceField` the extension may read. Repeat sections use `N` for the 1-based row
 * (`promoters.N.pan`); `isGstSourceField` accepts any row number.
 */
export const GST_SOURCE_FIELDS: readonly string[] = [
  'partA.applicantType',
  'partA.state',
  'partA.district',
  'partA.legalName',
  'partA.pan',
  'partA.email',
  'partA.mobile',
  'business.tradeName',
  'business.constitution',
  'business.constitutionProofType',
  'business.jurisdiction.type',
  'business.jurisdiction.stateDistrict',
  'business.jurisdiction.sector',
  'business.jurisdiction.circle',
  'business.jurisdiction.ward',
  'business.jurisdiction.commissionerate',
  'business.jurisdiction.division',
  'business.jurisdiction.range',
  'business.compositionOpted',
  'business.casualTaxable',
  'business.commencementDate',
  'business.liabilityDate',
  'business.reason',
  'business.reasonOther',
  'business.cin',
  'business.incorporationDate',
  'existingRegistrations.N.type',
  'existingRegistrations.N.number',
  'existingRegistrations.N.date',
  ...PERSON_KEYS.map((k) => `promoters.N.${k}`),
  ...ADDRESS_KEYS.map((k) => `promoters.N.address.${k}`),
  'promoters.N.isPrimarySignatory',
  'signatory.promoterIndex',
  'signatory.proofOfAppointment',
  'signatory.proofDocType',
  'signatory.isPrimarySignatory',
  ...PERSON_KEYS.map((k) => `signatory.${k}`),
  ...ADDRESS_KEYS.map((k) => `signatory.address.${k}`),
  ...PLACE_KEYS.map((k) => `principalPlace.${k}`),
  'principalPlace.hasAdditionalPlaces',
  ...PLACE_KEYS.map((k) => `additionalPlaces.N.${k}`),
  'goods.N.hsn',
  'goods.N.description',
  'services.N.sac',
  'services.N.description',
  'bank.accountNumber',
  'bank.ifsc',
  'bank.accountType',
  'bank.proofDocument',
  'stateSpecific.professionalTaxEc',
  'stateSpecific.professionalTaxRc',
  'stateSpecific.stateExciseLicence',
  'stateSpecific.stateExciseLicenceHolder',
  'aadhaar.optIn',
  'aadhaar.persons',
  'verification.signatoryName',
  'verification.place',
  'meta.subjectKind',
  'meta.subjectKey',
  'meta.additionalPlacesCount',
];

const SOURCE_FIELD_SET = new Set(GST_SOURCE_FIELDS);

/** Whether a flat key (`promoters.2.pan`) is in the vocabulary. */
export function isGstSourceField(key: string): boolean {
  return SOURCE_FIELD_SET.has(key.replace(/\.\d+(?=\.|$)/g, '.N'));
}

/** Document keys the profile can carry (`N` is a 1-based row). */
export const GST_DOCUMENT_KEYS: readonly string[] = [
  'company.pan',
  'company.coi',
  'promoter.N.photo',
  'promoter.N.pan',
  'signatory.proof',
  'place.proof',
  'place.noc',
  'place.N.proof',
  'bank.proof',
];

export function isGstDocumentKey(key: string): boolean {
  return GST_DOCUMENT_KEYS.includes(key.replace(/\.\d+(?=\.|$)/g, '.N'));
}

// ---------- the reg-4 fields the GST application adds (compliance_subject_fields) ----------

/**
 * Client-side keys on `reg-4` that hold what REG-01 asks and the checklist does not. The labels
 * live in `src/data/compliance-inputs.ts`; these are the keys the builder reads.
 */
export const GST_CLIENT_KEY = {
  business: 'business',
  place: 'place',
  /** The GST copy of the principal place's state, for a finished registered office step. */
  placeState: 'place-state',
  turnover: 'turnover',
  district: 'district',
  tradeName: 'trade-name',
  commencementDate: 'commencement-date',
  reason: 'reason',
  possession: 'possession',
  activities: 'activities',
  hsn: 'hsn',
  sac: 'sac',
  latitude: 'latitude',
  longitude: 'longitude',
  additionalPlaces: 'additional-places',
  bankAccount: 'bank-account',
  bankIfsc: 'bank-ifsc',
  ptEc: 'pt-ec',
  aadhaarOptIn: 'aadhaar-opt-in',
} as const;

/** SBC-side keys on `reg-4` the GST application adds (the tracker's own keys are in `gst-tracker.ts`). */
export const GST_SBC_KEY = {
  jurisdiction: 'jurisdiction',
  sector: 'jurisdiction-sector',
  circle: 'jurisdiction-circle',
  ward: 'jurisdiction-ward',
  commissionerate: 'centre-commissionerate',
  division: 'centre-division',
  range: 'centre-range',
  signatory: 'signatory',
} as const;
