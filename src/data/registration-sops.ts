/**
 * Registration SOPs — the client portal's Process and After tabs for the
 * Phase 4 (Registration) steps.
 *
 * Source: the SBC Registration & Compliance Manual (sbc-vcfo-local,
 * docs/compliance-manual.md), 14 SOPs in the manual's order. Wording and names
 * are the manual's own: the document checklist is the manual's "Company"
 * column (plus the rented-premises address proof and bank documents where the
 * SOP lists them), the process chain is the SOP's registration process, and
 * "after" is the SOP's post-registration compliances with their due dates.
 *
 * Each SOP is mapped to the checklist step that delivers it (src/data/checklist.ts,
 * phase 4). The manual's Labour Welfare Fund SOP (06) has no checklist step, so it
 * is not here. Steps without a manual SOP (MSME, ICEGATE, trademark renewal,
 * patent, ICDR, the FEMA filings) have no entry — the portal says so plainly
 * rather than inventing a procedure.
 *
 * Who does each process step: YOU = the client, SBC = SBC's team, GOVT = the
 * department / portal. The tagging follows the prototype's reading of the manual
 * (a35_regs.js).
 */

export type SopWho = 'YOU' | 'SBC' | 'GOVT';

export interface SopDocumentGroup {
  group: string;
  items: string[];
}

export interface SopProcessStep {
  who: SopWho;
  name: string;
}

export interface SopAfterRow {
  compliance: string;
  due: string;
}

export interface RegistrationSop {
  /** Checklist step id (phase 4). */
  stepId: string;
  /** Manual S.No, "01". */
  no: string;
  /** Manual SOP title. */
  name: string;
  /** The Act / scheme in full, when the manual names it. */
  full?: string;
  /** Responsible team (manual table of contents). */
  team: string;
  /** Manual "Applicability" row, in one line. */
  applicability: string;
  /** Manual document checklist, the company's column. */
  documents: SopDocumentGroup[];
  /** Manual registration process, in order. */
  process: SopProcessStep[];
  /** Manual post-registration compliances and due dates. */
  after: SopAfterRow[];
  /** Manual conclusion, one line. */
  conclusion: string;
}

export const REGISTRATION_SOPS: RegistrationSop[] = [
  {
    stepId: 'reg-4',
    no: '01',
    name: 'GST Registration',
    team: 'Indirect Tax Team',
    applicability:
      'Supply of goods or services exceeding the threshold limit (₹40 lakhs goods · ₹20 lakhs services), interstate taxable supply, e-commerce, or voluntary registration.',
    documents: [
      { group: 'Entity documents', items: ['PAN', 'Aadhaar of Authorized Person', 'Certificate of Incorporation', 'MOA', 'AOA', 'Authorization Letter', 'Board Resolution'] },
      { group: 'Address proof · rented premises', items: ['Rent Agreement', 'Lease Agreement', 'NOC from Owner', 'Utility Bill'] },
      { group: 'Bank documents', items: ['Cancelled Cheque', 'Bank Statement', 'Bank Verification Letter'] },
    ],
    process: [
      { who: 'SBC', name: 'Eligibility Review' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'Document Verification' },
      { who: 'SBC', name: 'GST REG-01 Preparation' },
      { who: 'SBC', name: 'Portal Submission' },
      { who: 'GOVT', name: 'ARN Generation' },
      { who: 'GOVT', name: 'Department Verification' },
      { who: 'GOVT', name: 'GSTIN Approval' },
      { who: 'SBC', name: 'Registration Certificate Download' },
    ],
    after: [
      { compliance: 'GSTR-1 (Monthly)', due: '11th of Following Month' },
      { compliance: 'GSTR-1 (Quarterly QRMP)', due: '13th of Following Quarter' },
      { compliance: 'GSTR-3B (Monthly)', due: '20th of Following Month' },
      { compliance: 'Annual Return (GSTR-9)', due: '31st December of Following Financial Year' },
      { compliance: 'LUT Renewal', due: 'Before Start of Financial Year' },
      { compliance: 'E-Way Bill', due: 'Before Movement of Goods' },
    ],
    conclusion: 'GST Registration is not the end of the compliance process — it is the beginning of ongoing GST obligations.',
  },
  {
    stepId: 'reg-13',
    no: '02',
    name: 'CLRA Registration',
    full: 'Contract Labour (Regulation & Abolition) Act',
    team: 'HR, Legal & Compliance Team',
    applicability: 'Principal employers engaging contract labour — 50 or more workers (subject to state-specific labour law provisions).',
    documents: [
      {
        group: 'Principal employer documents',
        items: ['PAN', 'GST Registration', 'Certificate of Incorporation', 'Shops & Establishment Registration', 'Address Proof', 'Employee Details', 'Contractor Agreement'],
      },
      { group: 'Contractor documents', items: ['PAN', 'GST Registration', 'Labour License', 'PF Registration', 'ESI Registration', 'Employee List'] },
    ],
    process: [
      { who: 'YOU', name: 'Contract Labour Requirement' },
      { who: 'SBC', name: 'Applicability Review' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'CLRA Registration Application' },
      { who: 'GOVT', name: 'Verification' },
      { who: 'GOVT', name: 'Registration Certificate' },
    ],
    after: [
      { compliance: 'Contractor Compliance Review', due: 'Monthly' },
      { compliance: 'Labour License Renewal', due: 'As Applicable' },
      { compliance: 'Register Maintenance', due: 'Continuous' },
    ],
    conclusion: 'CLRA compliance protects organizations from labour law risks arising from contractor engagements.',
  },
  {
    stepId: 'reg-1',
    no: '03',
    name: 'EPF Registration',
    full: "Employees' Provident Fund",
    team: 'Payroll & Compliance Team',
    applicability: 'Employing 20 or more employees, or voluntary registration. Mandatory for basic salary up to ₹15,000 and for international workers.',
    documents: [
      { group: 'Entity documents', items: ['PAN', 'Address Proof', 'Bank Proof', 'COI', 'MOA', 'AOA'] },
      { group: 'Authorized signatory documents', items: ['PAN', 'Aadhaar', 'Mobile Number', 'Email ID', 'DSC (Class III)', 'Photograph'] },
    ],
    process: [
      { who: 'SBC', name: 'Eligibility Check' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'Employer Registration' },
      { who: 'SBC', name: 'DSC Registration' },
      { who: 'SBC', name: 'EPFO Portal Application' },
      { who: 'GOVT', name: 'Establishment Code Generation' },
      { who: 'SBC', name: 'UAN Creation/Seeding' },
      { who: 'SBC', name: 'Monthly Compliance Setup' },
    ],
    after: [
      { compliance: 'PF Payment', due: '15th of Following Month' },
      { compliance: 'ECR Filing', due: '15th of Following Month' },
      { compliance: 'KYC Updates', due: 'As Applicable' },
      { compliance: 'Employee Exit Updates', due: 'Within Prescribed Timelines' },
      { compliance: 'Contribution', due: 'Employee 12% · Employer 12%' },
    ],
    conclusion: 'EPF Registration is the beginning of recurring payroll compliance obligations.',
  },
  {
    stepId: 'reg-3',
    no: '04',
    name: 'ESI Registration',
    full: "Employees' State Insurance",
    team: 'Payroll & Compliance Team',
    applicability: 'Employing 10 or more employees (threshold may vary by state). Mandatory for gross salary up to ₹21,000 p.m. (₹25,000 for persons with disability).',
    documents: [
      { group: 'Entity documents', items: ['PAN', 'GST Registration (if applicable)', 'Address Proof', 'Bank Proof', 'COI'] },
      { group: 'Authorized signatory documents', items: ['PAN', 'Aadhaar', 'Mobile Number', 'Email ID', 'Photograph'] },
    ],
    process: [
      { who: 'SBC', name: 'Eligibility Check' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'Employer Registration' },
      { who: 'SBC', name: 'ESIC Portal Filing' },
      { who: 'GOVT', name: 'Employer Code Generation' },
      { who: 'SBC', name: 'Employee Registration' },
      { who: 'GOVT', name: 'IP Number Generation' },
      { who: 'SBC', name: 'Monthly Compliance Setup' },
    ],
    after: [
      { compliance: 'Monthly ESI Payment', due: '15th of Following Month' },
      { compliance: 'Employee Registration', due: 'Immediate' },
      { compliance: 'Exit Declaration', due: 'As Applicable' },
      { compliance: 'Contribution', due: 'Employee 0.75% · Employer 3.25%' },
    ],
    conclusion: 'ESI Registration ensures medical and social security benefits for eligible employees.',
  },
  {
    stepId: 'reg-8',
    no: '05',
    name: 'IEC Registration',
    full: 'Import Export Code',
    team: 'Finance & Compliance Team',
    applicability: 'Businesses engaged in import or export of goods and services. One-time registration, valid for the lifetime of the entity, subject to annual updation.',
    documents: [{ group: 'Documents', items: ['PAN', 'Aadhaar of Applicant', 'Certificate of Incorporation', 'Address Proof', 'Bank Certificate / Cancelled Cheque', 'Mobile Number', 'Email ID'] }],
    process: [
      { who: 'YOU', name: 'Business Requirement Identified' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'DGFT Portal Registration' },
      { who: 'SBC', name: 'IEC Application Filing' },
      { who: 'GOVT', name: 'Verification' },
      { who: 'GOVT', name: 'IEC Allotment' },
    ],
    after: [
      { compliance: 'IEC Profile Update', due: 'Annual (April–June)' },
      { compliance: 'Maintain Import/Export Records', due: 'Ongoing' },
      { compliance: 'FEMA Compliance', due: 'Ongoing' },
    ],
    conclusion: 'IEC is mandatory for international trade transactions and serves as the primary business identification for imports and exports.',
  },
  {
    stepId: 'reg-6',
    no: '07',
    name: 'Legal Entity Identifier (LEI)',
    team: 'Finance & Treasury Team',
    applicability: 'Entities involved in high-value financial transactions — RBI mandates LEI for specified banking, treasury, derivative and large-value transactions.',
    documents: [{ group: 'Documents', items: ['PAN', 'Certificate of Incorporation', 'GST Registration (if applicable)', 'Board Resolution', 'Authorized Signatory Details', 'Entity Constitution Documents'] }],
    process: [
      { who: 'SBC', name: 'Eligibility Review' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'LEI Portal Registration' },
      { who: 'SBC', name: 'Application Submission' },
      { who: 'GOVT', name: 'Validation' },
      { who: 'GOVT', name: 'LEI Issuance' },
    ],
    after: [
      { compliance: 'LEI Renewal', due: '30th June' },
      { compliance: 'Update Entity Information', due: 'As they change' },
      { compliance: 'Banking Compliance', due: 'Ongoing' },
    ],
    conclusion: 'LEI enhances transparency in financial transactions and is mandatory for specified entities dealing with banks and financial institutions.',
  },
  {
    stepId: 'reg-5',
    no: '08',
    name: 'Letter of Undertaking (LUT)',
    team: 'Indirect Tax Team',
    applicability: 'Exporters of goods and services — to export without payment of Integrated GST (IGST). Renewed every financial year.',
    documents: [{ group: 'Documents', items: ['GST Registration Certificate', 'PAN', 'IEC (recommended)', 'Authorized Signatory Details', 'Previous LUT (if applicable)'] }],
    process: [
      { who: 'SBC', name: 'GST Registration' },
      { who: 'YOU', name: 'Export Activity Identification' },
      { who: 'SBC', name: 'LUT Preparation' },
      { who: 'SBC', name: 'GST Portal Filing' },
      { who: 'GOVT', name: 'ARN Generation' },
      { who: 'GOVT', name: 'LUT Approval' },
    ],
    after: [
      { compliance: 'LUT Filing', due: 'Before commencement of exports or beginning of financial year' },
      { compliance: 'LUT Renewal', due: 'Annually' },
      { compliance: 'Export Invoices · Foreign Remittance Tracking', due: 'Ongoing' },
    ],
    conclusion: 'LUT allows exporters to avoid blockage of working capital by exporting without payment of IGST.',
  },
  {
    stepId: 'reg-11',
    no: '09',
    name: 'Non-STPI Registration',
    team: 'Finance & Compliance Team',
    applicability: 'IT/ITES export units operating outside the STPI scheme — for export reporting and banking compliance under RBI and FEMA regulations.',
    documents: [
      { group: 'Documents', items: ['Certificate of Incorporation', 'PAN', 'GST Registration', 'IEC', 'Bank Details', 'Board Resolution', 'Authorized Signatory Details', 'Export Service Details'] },
    ],
    process: [
      { who: 'YOU', name: 'Export Business Setup' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'Application Preparation' },
      { who: 'SBC', name: 'Submission to Concerned Authority' },
      { who: 'GOVT', name: 'Verification' },
      { who: 'GOVT', name: 'Registration Approval' },
    ],
    after: [
      { compliance: 'Export Reporting', due: 'As Applicable' },
      { compliance: 'FEMA Compliance', due: 'Ongoing' },
      { compliance: 'Inward Remittance Monitoring · Bank Reporting', due: 'Ongoing' },
    ],
    conclusion: 'Non-STPI Registration helps IT/ITES exporters establish compliance frameworks for export transactions and banking requirements.',
  },
  {
    stepId: 'reg-14',
    no: '10',
    name: 'POSH Compliance',
    full: 'Prevention of Sexual Harassment',
    team: 'HR & Legal Team',
    applicability: 'All employers having 10 or more employees.',
    documents: [
      {
        group: 'Mandatory requirements',
        items: ['POSH Policy', 'Internal Committee (IC) Constitution', 'External Member Appointment', 'Employee Awareness Program', 'Complaint Handling Procedure', 'Annual Report Preparation'],
      },
      { group: 'Internal Committee composition', items: ['Presiding Officer — Senior Female Employee', 'Employee Members — Minimum 2', 'External Member — Mandatory'] },
    ],
    process: [
      { who: 'SBC', name: 'Applicability Review' },
      { who: 'SBC', name: 'POSH Policy Drafting' },
      { who: 'YOU', name: 'IC Constitution' },
      { who: 'YOU', name: 'External Member Appointment' },
      { who: 'SBC', name: 'Employee Awareness Session' },
      { who: 'SBC', name: 'Complaint Redressal Framework' },
      { who: 'SBC', name: 'Annual Compliance Monitoring' },
    ],
    after: [
      { compliance: 'POSH Annual Report', due: 'Annually' },
      { compliance: 'Awareness Program', due: 'At Least Once Every Year' },
      { compliance: 'IC Reconstitution', due: 'As Required' },
    ],
    conclusion: 'POSH compliance is not merely a statutory requirement but a critical workplace governance mechanism.',
  },
  {
    stepId: 'reg-7',
    no: '11',
    name: 'Professional Tax Registration',
    team: 'Payroll & Compliance Team',
    applicability: 'Employers and professionals in states where PT is applicable. Applicability, rates and due dates vary from state to state.',
    documents: [{ group: 'Documents', items: ['PAN', 'GST Registration (if available)', 'Address Proof', 'Bank Proof', 'COI', 'Employee Details'] }],
    process: [
      { who: 'SBC', name: 'Eligibility Check' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'State PT Portal Registration' },
      { who: 'SBC', name: 'Application Filing' },
      { who: 'GOVT', name: 'Verification' },
      { who: 'GOVT', name: 'PT Registration Number Generation' },
    ],
    after: [
      { compliance: 'PT Deduction · PT Payment', due: 'Monthly' },
      { compliance: 'PT Return Filing', due: 'Monthly / Quarterly / Annual' },
      { compliance: 'Annual Renewal', due: 'Where applicable' },
    ],
    conclusion: 'Professional Tax compliance is payroll-driven and state-specific.',
  },
  {
    stepId: 'reg-9',
    no: '12',
    name: 'Shops & Establishment Registration',
    team: 'HR & Compliance Team',
    applicability: 'Every office and commercial establishment — generally the first labour registration obtained after setting up an office.',
    documents: [
      {
        group: 'Documents',
        items: ['PAN', 'GST Certificate (if available)', 'COI', 'Address Proof', 'Rent Agreement / Lease Deed', 'Electricity Bill', 'Employee Details', 'Authorized Signatory ID Proof'],
      },
    ],
    process: [
      { who: 'YOU', name: 'Business Setup' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'State Labour Portal Registration' },
      { who: 'SBC', name: 'Application Submission' },
      { who: 'GOVT', name: 'Verification' },
      { who: 'GOVT', name: 'Registration Certificate Issuance' },
    ],
    after: [
      { compliance: 'Renewal', due: 'State Specific' },
      { compliance: 'Employee Record Maintenance', due: 'Ongoing' },
      { compliance: 'Display Registration Certificate', due: 'At the premises' },
    ],
    conclusion: 'Shops & Establishment Registration is generally the first labour registration obtained after setting up an office and acts as proof of business establishment.',
  },
  {
    stepId: 'reg-10',
    no: '13',
    name: 'Trade License',
    team: 'Legal & Compliance Team',
    applicability: 'Commercial establishments, offices, warehouses and business premises — permission from the local municipal authority to operate from a specified location.',
    documents: [{ group: 'Documents', items: ['PAN', 'GST Registration', 'Shops & Establishment Registration', 'Address Proof', 'Rent Agreement / Lease Deed', 'Electricity Bill', 'Occupancy Certificate (where applicable)'] }],
    process: [
      { who: 'YOU', name: 'Business Location Identified' },
      { who: 'YOU', name: 'Document Collection' },
      { who: 'SBC', name: 'Municipal Portal Application' },
      { who: 'GOVT', name: 'Inspection (if applicable)' },
      { who: 'GOVT', name: 'Approval' },
      { who: 'GOVT', name: 'Trade License Issuance' },
    ],
    after: [
      { compliance: 'Renewal', due: 'Annual / Local Authority Specific' },
      { compliance: 'Display of License', due: 'At the premises' },
      { compliance: 'Compliance with Municipal Rules', due: 'Ongoing' },
    ],
    conclusion: 'Trade License authorizes lawful business operations at a specified location and helps avoid municipal penalties.',
  },
  {
    stepId: 'reg-12',
    no: '14',
    name: 'Trademark Registration',
    team: 'Legal & Secretarial Team',
    applicability: 'Protects the brand name, logo, slogan or device mark under the Trade Marks Act, 1999 — exclusive ownership rights and legal protection against infringement.',
    documents: [
      { group: 'Entity documents', items: ['PAN', 'GST Registration (if available)', 'Certificate of Incorporation', 'Address Proof'] },
      {
        group: 'Trademark documents',
        items: ['Brand Name', 'Logo (if applicable)', 'Description of Goods / Services', 'Trademark Class Selection', 'User Affidavit (if prior use claimed)', 'Power of Attorney (TM-48)'],
      },
    ],
    process: [
      { who: 'YOU', name: 'Brand Finalization' },
      { who: 'SBC', name: 'Trademark Search' },
      { who: 'SBC', name: 'Class Identification' },
      { who: 'SBC', name: 'Application Filing' },
      { who: 'GOVT', name: 'Examination' },
      { who: 'SBC', name: 'Reply to Objections (if any)' },
      { who: 'GOVT', name: 'Advertisement in Journal' },
      { who: 'GOVT', name: 'Registration Certificate' },
    ],
    after: [
      { compliance: 'Trademark Renewal', due: 'Every 10 Years' },
      { compliance: 'Opposition Response', due: 'As Prescribed' },
      { compliance: 'Trademark Monitoring', due: 'Ongoing' },
    ],
    conclusion: 'Trademark Registration protects the business identity and grants exclusive rights to use the registered mark in India.',
  },
];

const BY_STEP: Record<string, RegistrationSop> = Object.fromEntries(REGISTRATION_SOPS.map((s) => [s.stepId, s]));

/** The manual's SOP for a registration step, if the manual has one. */
export function registrationSopFor(stepId: string): RegistrationSop | undefined {
  return BY_STEP[stepId];
}

/**
 * Registration groups in the agreed order (prototype REG_ORDER): the portal lists
 * the phase-4 steps under these headings. A step not named here lands in "Other".
 */
export const REGISTRATION_GROUPS: Array<{ name: string; stepIds: string[] }> = [
  { name: 'General', stepIds: ['reg-4', 'reg-1', 'reg-3', 'reg-7', 'reg-6', 'reg-15'] },
  { name: 'Customs', stepIds: ['reg-16', 'reg-8', 'reg-5'] },
  { name: 'Foreign trade', stepIds: ['reg-11'] },
  { name: 'Labour', stepIds: ['reg-9', 'reg-13', 'reg-14'] },
  { name: 'Local compliance', stepIds: ['reg-10'] },
  { name: 'IP / Brand', stepIds: ['reg-12', 'reg-17', 'reg-18', 'reg-19'] },
  { name: 'FEMA', stepIds: ['reg-20', 'reg-21', 'reg-22', 'reg-23', 'reg-24'] },
];

/** The authority behind each registration and, when it has one, its portal. */
export const REGISTRATION_AUTHORITY: Record<string, { authority: string; portal?: { label: string; url: string } }> = {
  'reg-4': { authority: 'GSTN', portal: { label: 'gst.gov.in', url: 'https://www.gst.gov.in' } },
  'reg-5': { authority: 'GSTN', portal: { label: 'gst.gov.in', url: 'https://www.gst.gov.in' } },
  'reg-1': { authority: 'EPFO', portal: { label: 'epfindia.gov.in', url: 'https://unifiedportal-emp.epfindia.gov.in' } },
  'reg-3': { authority: 'ESIC', portal: { label: 'esic.gov.in', url: 'https://www.esic.gov.in' } },
  'reg-7': { authority: 'State PT department' },
  'reg-9': { authority: 'State Labour Department' },
  'reg-13': { authority: 'Labour Department' },
  'reg-14': { authority: 'SHe-Box', portal: { label: 'shebox.wcd.gov.in', url: 'https://shebox.wcd.gov.in' } },
  'reg-15': { authority: 'Ministry of MSME', portal: { label: 'udyamregistration.gov.in', url: 'https://udyamregistration.gov.in' } },
  'reg-8': { authority: 'DGFT', portal: { label: 'dgft.gov.in', url: 'https://www.dgft.gov.in' } },
  'reg-10': { authority: 'Municipal corporation' },
  'reg-6': { authority: 'LEIL', portal: { label: 'ccilindia-lei.co.in', url: 'https://www.ccilindia-lei.co.in' } },
  'reg-16': { authority: 'CBIC · ICEGATE', portal: { label: 'icegate.gov.in', url: 'https://www.icegate.gov.in' } },
  'reg-11': { authority: 'STPI', portal: { label: 'stpi.in', url: 'https://stpi.in' } },
  'reg-19': { authority: 'SEBI' },
  'reg-12': { authority: 'IP India', portal: { label: 'ipindia.gov.in', url: 'https://ipindia.gov.in' } },
  'reg-17': { authority: 'IP India', portal: { label: 'ipindia.gov.in', url: 'https://ipindia.gov.in' } },
  'reg-18': { authority: 'IP India', portal: { label: 'ipindia.gov.in', url: 'https://ipindia.gov.in' } },
  'reg-20': { authority: 'RBI · FIRMS', portal: { label: 'firms.rbi.org.in', url: 'https://firms.rbi.org.in' } },
  'reg-21': { authority: 'RBI · FIRMS', portal: { label: 'firms.rbi.org.in', url: 'https://firms.rbi.org.in' } },
  'reg-22': { authority: 'RBI · FIRMS', portal: { label: 'firms.rbi.org.in', url: 'https://firms.rbi.org.in' } },
  'reg-23': { authority: 'RBI · FLAIR', portal: { label: 'flair.rbi.org.in', url: 'https://flair.rbi.org.in' } },
  'reg-24': { authority: 'RBI · FIRMS', portal: { label: 'firms.rbi.org.in', url: 'https://firms.rbi.org.in' } },
};
