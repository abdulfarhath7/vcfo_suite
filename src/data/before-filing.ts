/**
 * BEFORE FILING — the short staff checklists on the obligation and registration records
 * (S-783, S-816). Ticks are stored per engagement in `compliance_checklist_checks`
 * (migration 0028); this file only holds the lines. A line key must stay stable once ticks
 * exist, because the stored tick names it.
 *
 * Obligations: a list for the obligation id when it has its own, else the list of its
 * compliance area. Registrations: the list of the registration's category.
 *
 * Pure data: no imports from the database or the UI.
 */

export interface BeforeFilingLine {
  key: string;
  label: string;
}

const line = (key: string, label: string): BeforeFilingLine => ({ key, label });

const GST_RETURN = [
  line('books', 'Sales and purchase registers closed for the period'),
  line('2b', 'Input tax credit matched with GSTR-2B'),
  line('rcm', 'Reverse charge and blocked credits checked'),
  line('client-ok', 'Return summary approved by the client'),
];

const TDS_RETURN = [
  line('challans', 'Challans for the quarter matched with deductions'),
  line('pan', 'Deductee PANs checked'),
  line('rates', 'Section and rate checked for each payment'),
  line('fvu', 'Return file validated with the FVU utility'),
];

const BY_OBLIGATION: Record<string, BeforeFilingLine[]> = {
  'gst-gstr-1': [
    line('invoices', 'Every invoice and credit note of the period entered'),
    line('hsn', 'HSN summary checked'),
    line('b2b', 'Buyer GSTINs checked for B2B invoices'),
    line('client-ok', 'Outward supply summary approved by the client'),
  ],
  'gst-gstr-3b': GST_RETURN,
  'gst-gstr-9': [
    line('returns', 'GSTR-1 and GSTR-3B of the year reconciled'),
    line('books', 'Turnover and tax reconciled with the books'),
    line('itc', 'Input tax credit reconciled with GSTR-2B'),
    line('client-ok', 'Annual summary approved by the client'),
  ],
  'it-tds-payment': [
    line('deductions', 'Deductions of the month listed'),
    line('rates', 'Section and rate checked for each payment'),
    line('challan', 'Challan prepared for each section'),
  ],
  'it-tds-return-q1': TDS_RETURN,
  'it-tds-return-q2': TDS_RETURN,
  'it-tds-return-q3': TDS_RETURN,
  'it-tds-return-q4': TDS_RETURN,
  'it-itr': [
    line('accounts', 'Accounts for the year finalised'),
    line('26as', 'Form 26AS and AIS reconciled'),
    line('tax', 'Tax computed and balance paid'),
    line('client-ok', 'Computation approved by the client'),
  ],
  'mca-aoc-4': [
    line('accounts', 'Financial statements signed by the board'),
    line('audit', 'Auditor’s report attached'),
    line('agm', 'Adopted at the annual general meeting'),
    line('dsc', 'Director’s digital signature valid'),
  ],
  'mca-mgt-7': [
    line('register', 'Register of members up to date'),
    line('agm', 'Annual general meeting held'),
    line('meetings', 'Board meeting dates for the year listed'),
    line('dsc', 'Director’s digital signature valid'),
  ],
  'mca-dir3-kyc': [
    line('mobile', 'Director’s mobile and email verified'),
    line('pan', 'PAN and address proof checked'),
    line('dsc', 'Director’s digital signature valid'),
  ],
};

const MCA_FORM = [
  line('documents', 'Board or partner approvals and attachments ready'),
  line('form', 'Form filled and checked against the records'),
  line('dsc', 'Digital signature valid'),
  line('fee', 'Filing fee worked out'),
];

const BY_AREA: Record<string, BeforeFilingLine[]> = {
  GST: GST_RETURN,
  'Income Tax': [
    line('data', 'Data for the period received from the client'),
    line('computed', 'Amount computed and checked'),
    line('challan', 'Challan or form prepared'),
    line('client-ok', 'Approved by the client'),
  ],
  'Companies Act, 2013': MCA_FORM,
  'LLP Act': MCA_FORM,
};

const GENERIC: BeforeFilingLine[] = [
  line('data', 'Data for the period received from the client'),
  line('checked', 'Working checked by a second person'),
  line('client-ok', 'Approved by the client'),
  line('portal', 'Portal login and signature ready'),
];

/** The checklist of one obligation: its own list, else its area's, else the general one. */
export function obligationChecklist(obligationId: string, area?: string | null): BeforeFilingLine[] {
  return BY_OBLIGATION[obligationId] ?? (area ? BY_AREA[area] : undefined) ?? GENERIC;
}

const REG_BY_CATEGORY: Record<string, BeforeFilingLine[]> = {
  Tax: [
    line('documents', 'PAN, address proof and bank proof received'),
    line('premises', 'Proof of the place of business received'),
    line('signatory', 'Authorised signatory and their KYC checked'),
    line('dsc', 'Signature or EVC ready'),
  ],
  Labour: [
    line('employees', 'Employee list with wages received'),
    line('establishment', 'Establishment details and start date confirmed'),
    line('signatory', 'Employer’s authorised person and KYC checked'),
    line('dsc', 'Signature ready'),
  ],
  FEMA: [
    line('inflow', 'Bank remittance and FIRC received'),
    line('kyc', 'KYC of the foreign investor received'),
    line('valuation', 'Valuation report ready'),
    line('allotment', 'Allotment or transfer details confirmed'),
  ],
  IP: [
    line('mark', 'Mark, work or design and its class confirmed'),
    line('search', 'Search for earlier filings done'),
    line('user', 'Date of first use confirmed'),
    line('poa', 'Power of attorney signed'),
  ],
};

const REG_GENERIC: BeforeFilingLine[] = [
  line('documents', 'Documents from the client received'),
  line('details', 'Application details checked against the records'),
  line('signatory', 'Authorised signatory and their KYC checked'),
  line('fee', 'Fee worked out'),
];

/** The checklist of one registration, by its category. */
export function registrationChecklist(category: string): BeforeFilingLine[] {
  return REG_BY_CATEGORY[category] ?? REG_GENERIC;
}
