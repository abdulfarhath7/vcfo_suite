import type { FieldFormat, FieldSensitivity, FieldSubject } from './types';

/** Labels compare in lower case, without punctuation or anything in brackets. */
export const normalizeLabel = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * What the source files do not say: which fields hold the same fact, what people call it and what
 * shape it has. `fields` names `<step>/<field>`, with `#` for a slot number and `group.field` for a
 * field on a repeating list. Any field not named here still gets an entry of its own, from its label.
 */
export interface CanonicalRule {
  key: string;
  label: string;
  format?: FieldFormat;
  sensitivity?: FieldSensitivity;
  subject: FieldSubject;
  synonyms: string[];
  fields: string[];
  /**
   * Names used on the compliance input lists: a bare `key` on any list, or `<subject>/<key>` on one
   * registration or obligation only, with `#` for a director number (`reg-4/promoter-#-address`).
   */
  inputs?: string[];
  expands?: string[];
  /** See `CatalogEntry.foundIn`. */
  foundIn?: string[];
  /** See `CatalogEntry.extract`. */
  extract?: string;
  /** See `CatalogEntry.fills`. */
  fills?: string;
  /** See `CatalogEntry.onlyFrom`. */
  onlyFrom?: string[];
  /** See `CatalogEntry.valueMatches`. */
  valueMatches?: string;
}

/** Where the targeted read looks for each fact (`CatalogEntry.foundIn`). */
/**
 * The client's own details sheet (`incorporation_data`) holds every Client Details fact, so it is read
 * for each of them, as the foreign parent's board resolution is.
 */
const IN_RESOLUTION = ['board_resolution', 'incorporation_data'];
const IN_CONSTITUTION = ['board_resolution', 'moa', 'aoa', 'incorporation_data'];
const IN_COI = ['incorporation_certificate'];
const IN_OFFICE_PROOF = ['board_resolution', 'noc', 'address_proof', 'rent_agreement', 'incorporation_data'];
const ON_PAN_CARD = ['pan_card'];
/** Where a proposed director is named: the resolution, a consent letter (DIR-2) or the details sheet. */
const DIRECTOR_NAMED_IN = ['board_resolution', 'consent_letter', 'incorporation_data'];
/** The foreign parent's country and state: its resolution, the details sheet or its own certificate. */
const PARENT_FACTS_IN = ['board_resolution', 'incorporation_data', 'incorporation_certificate'];
/** Facts of record: only the certificate, a PAN card or the client's own details sheet states them (`onlyFrom`). */
const OF_RECORD = ['incorporation_certificate', 'pan_card', 'form', 'incorporation_data'];
/** How the premises are held: only a paper about the premises, or the client's details sheet. */
const ON_PREMISES = ['rent_agreement', 'noc', 'address_proof', 'utility_bill', 'form', 'incorporation_data'];

const person = (key: string, label: string, synonyms: string[], fields: string[], extra: Partial<CanonicalRule> = {}): CanonicalRule => ({
  key: `director.${key}`,
  label,
  subject: 'director',
  synonyms,
  fields: fields.map((f) => (f.includes('/') ? f : `pre-15/directors.${f}`)),
  ...extra,
});

export const CANONICAL_RULES: readonly CanonicalRule[] = [
  person('name', 'Director name (whole)', ['name', 'full name', 'name of director', 'director name', 'applicant name', 'name of card holder', 'holder name'], [], {
    foundIn: [...ON_PAN_CARD, ...DIRECTOR_NAMED_IN],
    extract: 'The full name of each proposed director (on a PAN card, the card holder), as printed. Give one value per person, with person set to that name.',
    expands: ['director.first_name', 'director.middle_name', 'director.last_name'],
  }),
  person('first_name', 'Director first name', ['first name', 'given name', 'forename'], ['firstName', 'pre-1/director#FirstName']),
  person('middle_name', 'Director middle name', ['middle name'], ['middleName', 'pre-1/director#MiddleName']),
  person('last_name', 'Director last name', ['last name', 'surname', 'family name'], ['lastName', 'pre-1/director#LastName']),
  person('gender', 'Director gender', ['gender', 'sex'], ['gender', 'pre-1/director#Gender'], { format: 'choice', foundIn: DIRECTOR_NAMED_IN, extract: 'Each proposed director\'s gender (male, female or other), only when stated.' }),
  person('india_resident', 'Director resident of India', ['resident of india', 'india resident', 'residential status', 'resident'], ['indiaResident', 'pre-1/director#IndiaResident'], { format: 'choice', foundIn: DIRECTOR_NAMED_IN, extract: 'Whether each proposed director is resident in India (yes or no), only when stated.' }),
  person('nationality', 'Director nationality', ['nationality', 'citizenship', 'country of citizenship'], ['nationality'], { format: 'choice', foundIn: DIRECTOR_NAMED_IN, extract: 'Each proposed director\'s nationality, only when stated.' }),
  person('din', 'Director DIN', ['din', 'din number', 'director identification number'], ['din'], { format: 'din', sensitivity: 'identity', inputs: ['din'] }),
  person('dob', 'Director date of birth', ['date of birth', 'dob', 'birth date', 'd o b', 'born on'], ['dob'], { format: 'date', foundIn: ON_PAN_CARD, extract: 'The date of birth as printed.' }),
  person('father_name', "Director father's name", ["father's name", 'fathers name', 'father name', 'name of father'], ['fatherName'], { foundIn: ON_PAN_CARD, extract: "The father's name as printed." }),
  person('qualification', 'Director qualification', ['qualification', 'highest qualification', 'education', 'highest educational qualification'], ['highestEducationalQualification'], { format: 'choice' }),
  person('occupation', 'Director occupation', ['occupation', 'occupation type', 'profession'], ['occupationType'], { format: 'choice' }),
  person('mobile', 'Director mobile number', ['mobile', 'mobile number', 'mobile no', 'phone', 'phone number', 'contact number'], ['mobileNumber'], { format: 'mobile', inputs: ['mobile'] }),
  person('email', 'Director personal e-mail', ['email', 'e mail', 'email id', 'email address', 'e mail address', 'personal email', 'personal e mail'], ['personalMailId'], { format: 'email', inputs: ['email'] }),
  person('email_official', 'Director official e-mail', ['official email', 'official e mail', 'work email'], ['officialMailId'], { format: 'email' }),
  person('aadhaar', 'Director Aadhaar number', ['aadhaar', 'aadhar', 'aadhaar number', 'aadhaar no', 'uid', 'uidai number'], ['aadhaarNumber'], { format: 'aadhaar', sensitivity: 'identity' }),
  person('pan', 'Director PAN', ['pan', 'pan number', 'pan no', 'permanent account number', 'income tax pan'], ['panNumber'], { format: 'pan', sensitivity: 'identity', foundIn: ON_PAN_CARD, extract: 'The 10-character PAN.' }),
  person('passport', 'Director passport number', ['passport', 'passport number', 'passport no'], ['passportNumber'], { format: 'passport', sensitivity: 'identity' }),
  person('driving_licence', 'Director driving licence number', ['driving licence', 'driving license', 'dl number', 'licence number'], ['drivingLicenceNumber'], { sensitivity: 'identity' }),
  person('utility_bill_type', 'Director utility bill type', ['utility bill type', 'bill type'], ['utilityBillType'], { format: 'choice' }),
  person('utility_bill_number', 'Director utility bill number', ['utility bill number', 'bill number', 'consumer number', 'account number on the bill'], ['utilityBillNumber']),
  // `reg-4/promoter-#-address` is the GST copy, written when the directors step is finished.
  person('address', 'Director address', ['address', 'residential address', 'address as per utility bill', 'present address', 'permanent address'], ['utilityBillAddress'], { inputs: ['reg-4/promoter-#-address'] }),
  person('pan_copy', 'Copy of PAN card', [], ['panCopyUrl'], { format: 'file' }),
  person('aadhaar_copy', 'Copy of Aadhaar card', [], ['aadhaarCopyUrl'], { format: 'file' }),
  person('passport_copy', 'Copy of passport', [], ['passportCopyUrl'], { format: 'file' }),
  person('driving_licence_copy', 'Copy of driving licence', [], ['drivingLicenceCopyUrl'], { format: 'file' }),
  person('utility_bill_copy', 'Copy of utility bill', [], ['utilityBillCopyUrl'], { format: 'file' }),

  { key: 'company.name', label: 'Company name', subject: 'company', synonyms: ['company name', 'name of the company', 'incorporated company name'], fields: ['pre-12/incorporatedCompanyName'] },
  { key: 'company.approved_name', label: 'Approved company name', subject: 'company', synonyms: ['approved company name', 'approved name'], fields: ['pre-5/approvedCompanyName'] },
  { key: 'company.cin', label: 'Company CIN', format: 'cin', subject: 'company', synonyms: ['cin', 'corporate identification number', 'corporate identity number', 'company cin'], fields: ['pre-12/cin'], inputs: ['cin'], foundIn: IN_COI, onlyFrom: OF_RECORD, extract: 'The 21-character corporate identity number (CIN).' },
  { key: 'company.pan', label: 'Company PAN', format: 'pan', sensitivity: 'identity', subject: 'company', synonyms: ['company pan', 'pan of the company', 'permanent account number', 'pan'], fields: ['pre-12/pan'], inputs: ['pan'], foundIn: IN_COI, onlyFrom: OF_RECORD, extract: "The company's PAN, when the certificate states it." },
  { key: 'company.tan', label: 'Company TAN', format: 'tan', subject: 'company', synonyms: ['tan', 'tan number', 'tax deduction account number', 'tax deduction and collection account number'], fields: ['pre-12/tan'], inputs: ['tan'], foundIn: IN_COI, onlyFrom: OF_RECORD, extract: "The company's TAN, when the certificate states it." },
  { key: 'company.gstin', label: 'Company GSTIN', format: 'gstin', subject: 'company', synonyms: ['gstin', 'gst number', 'gst registration number', 'gst no'], fields: ['reg-4/gstinNumber'], inputs: ['gstin'] },
  { key: 'company.incorporation_date', label: 'Date of incorporation', format: 'date', subject: 'company', synonyms: ['date of incorporation', 'incorporation date', 'incorporated on'], fields: ['pre-12/dateOfIncorporation'], foundIn: IN_COI, onlyFrom: OF_RECORD, extract: 'The date of incorporation.' },
  { key: 'company.pf_code', label: 'PF establishment code', subject: 'company', synonyms: ['pf code', 'pf establishment code', 'provident fund code'], fields: ['pre-12/pfCode'], inputs: ['pf-code'] },
  { key: 'company.esi_code', label: 'ESI code', subject: 'company', synonyms: ['esi code', 'esic code', 'employees state insurance code'], fields: ['pre-12/esiCode'], inputs: ['esi-code'] },
  { key: 'company.proposed_name_1', label: 'Proposed company name 1', subject: 'company', synonyms: ['proposed name 1', 'first proposed name', 'proposed company name 1'], fields: ['pre-1/proposedName1'], foundIn: IN_RESOLUTION, extract: 'The first name proposed for the new company, in full.' },
  { key: 'company.proposed_name_2', label: 'Proposed company name 2', subject: 'company', synonyms: ['proposed name 2', 'second proposed name', 'proposed company name 2'], fields: ['pre-1/proposedName2'], foundIn: IN_RESOLUTION, extract: 'The second name proposed for the new company, in full.' },
  { key: 'company.nic_code', label: 'Main NIC code', subject: 'company', synonyms: ['nic code', 'main nic code', 'nic', 'national industrial classification'], fields: ['pre-1/nicCode'], foundIn: ['board_resolution', 'moa', 'incorporation_data'], extract: 'The main NIC-2008 code of the business: five digits only.' },
  { key: 'company.business_type', label: 'Business type', subject: 'company', synonyms: ['business type'], fields: ['pre-1/nicBusinessType'] },
  { key: 'company.business_description', label: 'Business description', format: 'longtext', subject: 'company', synonyms: ['business description', 'description of business', 'nature of business', 'business activity'], fields: ['pre-1/businessDescription'], foundIn: ['board_resolution', 'company_letter', 'incorporation_data'], extract: 'What the business will do and how it will operate in India, as a clean summary of at most 100 words in plain sentences.' },
  {
    key: 'company.main_objects',
    label: 'Main objects',
    format: 'longtext',
    subject: 'company',
    synonyms: ['main objects', 'main objects of the company', 'objects to be pursued by the company', 'objects clause', 'main object'],
    fields: [],
    foundIn: ['moa'],
    extract: 'The main objects the company is set up to pursue (the main objects clause), as a clean summary of at most 100 words in plain sentences.',
    // There is no field for the objects clause; it says what the business is, so it fills the business description.
    fills: 'company.business_description',
  },
  { key: 'capital.authorised', label: 'Authorised share capital', format: 'amount', subject: 'company', synonyms: ['authorised share capital', 'authorized share capital', 'authorised capital', 'authorized capital'], fields: ['pre-1/authorisedShareCapital'], foundIn: IN_CONSTITUTION, extract: 'The authorised share capital in rupees, as printed.' },
  { key: 'capital.paid_up', label: 'Paid-up share capital', format: 'amount', subject: 'company', synonyms: ['paid up share capital', 'paid up capital', 'initial paid up share capital'], fields: ['pre-1/paidUpShareCapital'], foundIn: IN_RESOLUTION, extract: 'The initial paid-up share capital in rupees, as printed.' },
  { key: 'capital.nominal', label: 'Nominal value per equity share', subject: 'company', synonyms: ['nominal value per equity share', 'nominal value', 'face value', 'face value per share', 'nominal value of each equity share'], fields: ['pre-1/nominalValuePerEquityShare', 'pre-13/equityNominalValue'], foundIn: IN_CONSTITUTION, extract: 'The nominal (face) value of one equity share, as printed.' },
  { key: 'capital.equity_quantity', label: 'Number of equity shares', subject: 'company', synonyms: ['number of equity shares', 'equity shares', 'no of equity shares'], fields: ['pre-13/equityQuantity'], foundIn: ['moa', 'incorporation_data'], extract: 'The number of equity shares the company will issue at first, as printed.' },

  // The GST step keeps its own copy of the principal place (`reg-4/place`, `reg-4/place-state`),
  // written there when the registered office step is finished.
  { key: 'office.address', label: 'Registered office address', format: 'longtext', subject: 'office', synonyms: ['registered office', 'registered office address', 'complete address of the proposed registered office', 'office address', 'principal place of business', 'address of the principal place of business'], fields: ['pre-14/registeredOfficeCompleteAddress'], inputs: ['reg-4/place'], foundIn: IN_OFFICE_PROOF, extract: 'The complete address of the registered office (or the premises), as printed.' },
  { key: 'office.state', label: 'Registered office state', format: 'choice', subject: 'office', synonyms: ['registered office state', 'state of registered office', 'state', 'state of the principal place', 'principal place state'], fields: ['pre-14/registeredOfficeState'], inputs: ['reg-4/place-state'] },

  // What GST REG-01 asks that no checklist step holds: the GST step's own fields (`reg-4`).
  { key: 'gst.district', label: 'District of the principal place', subject: 'office', synonyms: ['district', 'district of the principal place', 'district of principal place of business', 'principal place district'], fields: [], inputs: ['reg-4/district'] },
  { key: 'gst.trade_name', label: 'Trade name', subject: 'company', synonyms: ['trade name', 'trade name of the business'], fields: [], inputs: ['reg-4/trade-name'] },
  { key: 'gst.commencement_date', label: 'Date of commencement of business', format: 'date', subject: 'company', synonyms: ['date of commencement of business', 'date of commencement', 'commencement date', 'business commencement date'], fields: [], inputs: ['reg-4/commencement-date'] },
  { key: 'gst.reason', label: 'Reason for GST registration', subject: 'company', synonyms: ['reason for registration', 'reason to obtain registration', 'reason for gst registration'], fields: [], inputs: ['reg-4/reason'] },
  { key: 'gst.possession', label: 'Nature of possession of the premises', subject: 'office', synonyms: ['premises', 'nature of possession', 'nature of possession of the premises', 'possession of the premises', 'possession'], fields: [], inputs: ['reg-4/possession'], onlyFrom: ON_PREMISES, valueMatches: '\\b(own|owned|ownership|rent|rented|lease|leased|licen[cs]e|consent|shared)\\b' },
  { key: 'gst.activities', label: 'Business activity at the premises', subject: 'office', synonyms: ['nature of business activity', 'nature of business activity at the premises', 'activities at the premises', 'business activity at the premises'], fields: [], inputs: ['reg-4/activities'] },
  { key: 'gst.hsn', label: 'HSN codes of the main goods', subject: 'company', synonyms: ['hsn', 'hsn code', 'hsn codes', 'hsn codes of the goods', 'hsn codes of the main goods'], fields: [], inputs: ['reg-4/hsn'] },
  { key: 'gst.sac', label: 'SAC codes of the main services', subject: 'company', synonyms: ['sac', 'sac code', 'sac codes', 'sac codes of the services', 'sac codes of the main services'], fields: [], inputs: ['reg-4/sac'] },
  { key: 'office.utility_bill_type', label: 'Office utility bill type', format: 'choice', subject: 'office', synonyms: ['office utility bill type', 'registered office utility bill type'], fields: ['pre-14/registeredOfficeUtilityBillType'] },
  { key: 'office.utility_bill_number', label: 'Office utility bill number', subject: 'office', synonyms: ['office utility bill number', 'registered office utility bill number'], fields: ['pre-14/registeredOfficeUtilityBillNumber'] },

  { key: 'parent.name', label: 'Foreign entity name', subject: 'parent', synonyms: ['foreign entity', 'foreign entity name', 'name of the foreign entity', 'parent company', 'parent entity', 'holding company'], fields: ['pre-1/parentEntityName'], foundIn: IN_RESOLUTION, extract: 'The name of the foreign or parent company passing the resolution.' },
  { key: 'parent.address', label: 'Foreign entity address', format: 'longtext', subject: 'parent', synonyms: ['foreign entity address', 'parent company address', 'parent entity address'], fields: ['pre-1/parentEntityAddress'], foundIn: IN_RESOLUTION, extract: 'The registered address of the foreign or parent company.' },
  { key: 'parent.country', label: 'Foreign entity country', format: 'choice', subject: 'parent', synonyms: ['country of incorporation', 'foreign entity country', 'parent country'], fields: ['pre-1/parentEntityCountry'], foundIn: PARENT_FACTS_IN, extract: 'The country the foreign or parent company is incorporated in.' },
  { key: 'parent.state', label: 'Foreign entity state', subject: 'parent', synonyms: ['state of incorporation', 'foreign entity state', 'parent state'], fields: ['pre-1/parentEntityState'], foundIn: PARENT_FACTS_IN, extract: 'The state or province the foreign or parent company is incorporated in, when stated.' },

  { key: 'signatory.first_name', label: 'Signatory first name', subject: 'signatory', synonyms: ['signatory first name', 'person signing first name'], fields: ['pre-1/signatoryFirstName'], foundIn: IN_RESOLUTION, extract: 'The first name of the person the resolution authorises to sign.' },
  { key: 'signatory.middle_name', label: 'Signatory middle name', subject: 'signatory', synonyms: ['signatory middle name'], fields: ['pre-1/signatoryMiddleName'], foundIn: IN_RESOLUTION, extract: 'The middle name of the person the resolution authorises to sign, only when printed.' },
  { key: 'signatory.last_name', label: 'Signatory last name', subject: 'signatory', synonyms: ['signatory last name', 'person signing last name'], fields: ['pre-1/signatoryLastName'], foundIn: IN_RESOLUTION, extract: 'The last name of the person the resolution authorises to sign.' },
  { key: 'signatory.designation', label: 'Signatory designation', subject: 'signatory', synonyms: ['signatory designation', 'designation of the person signing', 'designation'], fields: ['pre-1/signatoryDesignation'], foundIn: IN_RESOLUTION, extract: 'The designation of the person the resolution authorises to sign.' },
  { key: 'signatory.resolution_date', label: 'Board resolution date', format: 'date', subject: 'signatory', synonyms: ['date of the board resolution', 'board resolution date', 'resolution date', 'date of resolution'], fields: ['pre-1/boardResolutionDate'], foundIn: IN_RESOLUTION, extract: 'The date the board resolution was passed or signed.' },

  { key: 'subscriber.name', label: 'Subscriber name', subject: 'subscriber', synonyms: ['subscriber', 'subscriber name', 'name of subscriber'], fields: ['pre-16/subscribers.name'] },
  { key: 'subscriber.type', label: 'Subscriber type', format: 'choice', subject: 'subscriber', synonyms: ['subscriber type'], fields: ['pre-16/subscribers.type'] },
  { key: 'subscriber.cin', label: 'Subscriber CIN', format: 'cin', subject: 'subscriber', synonyms: ['subscriber cin'], fields: ['pre-16/subscribers.cin'] },
  { key: 'subscriber.address', label: 'Subscriber address', format: 'longtext', subject: 'subscriber', synonyms: ['subscriber address', 'registered address of the body corporate', 'registered office address or principal place of business'], fields: ['pre-16/subscribers.address'] },
  { key: 'subscriber.shares', label: 'Subscriber shares', subject: 'subscriber', synonyms: ['number of shares', 'shares subscribed', 'shares'], fields: ['pre-16/subscribers.shares'] },
  { key: 'subscriber.share_value', label: 'Subscriber share value', format: 'amount', subject: 'subscriber', synonyms: ['value of shares', 'subscription amount'], fields: ['pre-16/subscribers.shareValue'] },
  { key: 'subscriber.authorised_person', label: 'Subscriber authorised person', subject: 'subscriber', synonyms: ['authorised person', 'authorized person', 'authorised signatory'], fields: ['pre-16/subscribers.authorisedPerson'] },
];

/** A field whose id ends this way holds this format, even with no rule above. */
export const FORMAT_BY_FIELD_ID: ReadonlyArray<readonly [RegExp, FieldFormat]> = [
  [/gstin/i, 'gstin'],
  [/ifsc/i, 'ifsc'],
  [/llpin$/i, 'llpin'],
  [/(^|[a-z])Cin$/, 'cin'],
];

/** Workflow stamps and code-written fields: a document never fills these. */
export const NOT_WRITABLE = /(GeneratedAt|SharedAt|reviewStatus|Confirmation$|coiSignatureVerified)/;
