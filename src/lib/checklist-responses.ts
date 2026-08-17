import { addDays, format } from 'date-fns';
import { checklist, type ChecklistField, type ChecklistItem } from '@/data/checklist';
import {
  getPre1VisibleFields,
  parseDirectorCount,
  parsePre1BoardResolutionDate,
  pre1GenderLabel,
  PRE1_GENDER_OPTIONS,
  PRE1_INDIA_RESIDENT_OPTIONS,
  PRE1_MOBILE_COUNTRY_OPTIONS,
} from '@/lib/checklist-pre1-validation';
import {
  getPre6DirectorNameOptions,
  getPre6VisibleFields,
  PRE6_CLIENT_RESPONSE_FIELDS,
  PRE6_UTILITY_BILL_OPTIONS,
} from '@/lib/checklist-pre6-validation';
import { resolveDirectorDisplayName } from '@/lib/person-name';

/** MCA name approval is valid for 20 calendar days from the approval date. */
export const MCA_NAME_APPROVAL_VALIDITY_DAYS = 20;

export function computeMcaNameApprovalExpiryDate(approvalDate: string): string {
  const parsed = parsePre1BoardResolutionDate(approvalDate);
  if (!parsed) return '';
  return format(addDays(parsed, MCA_NAME_APPROVAL_VALIDITY_DAYS), 'yyyy-MM-dd');
}

/** Structured client-input fields keyed by checklist item id (pre/post incorporation). */
export const CLIENT_RESPONSE_FIELDS: Record<string, ChecklistField[]> = {
  'pre-1': [
    {
      id: 'parentEntityName',
      label: 'Name',
      type: 'text',
      section: 'Foreign Entity',
      required: true,
    },
    {
      id: 'parentEntityRegistrationNumber',
      label: 'Registration Number',
      type: 'text',
      section: 'Foreign Entity',
      required: true,
    },
    {
      id: 'parentEntityAddress',
      label: 'Complete Address',
      type: 'textarea',
      section: 'Foreign Entity',
      required: true,
    },
    {
      id: 'parentEntityHasTrademark',
      label: 'Does the parent entity have a trademark?',
      type: 'select',
      section: 'Foreign Entity',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: false,
    },
    {
      id: 'parentEntityTrademarkUrl',
      label: 'Trademark document (optional)',
      type: 'file',
      section: 'Foreign Entity',
      accept: '.pdf,image/*',
      required: false,
    },
    {
      id: 'certificateOfIncorporationUrl',
      label: 'Certificate of Incorporation',
      type: 'file',
      section: 'Foreign Entity Proof',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'signatoryFirstName',
      label: 'First name',
      type: 'text',
      section: 'Authorized Signatory',
      required: true,
    },
    {
      id: 'signatoryMiddleName',
      label: 'Middle name (optional)',
      type: 'text',
      section: 'Authorized Signatory',
      required: false,
    },
    {
      id: 'signatoryLastName',
      label: 'Last name',
      type: 'text',
      section: 'Authorized Signatory',
      required: true,
    },
    {
      id: 'signatoryDesignation',
      label: 'Designation',
      type: 'text',
      section: 'Authorized Signatory',
      required: true,
    },
    {
      id: 'signatoryGender',
      label: 'Gender',
      type: 'select',
      section: 'Authorized Signatory',
      options: [...PRE1_GENDER_OPTIONS],
      required: true,
    },
    {
      id: 'passportUrl',
      label: 'Passport',
      type: 'file',
      section: 'Signatory KYC',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'drivingLicenseUrl',
      label: 'Driving Licence',
      type: 'file',
      section: 'Signatory KYC',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'utilityBillUrl',
      label: 'Utility Bill <2 months',
      type: 'file',
      section: 'Signatory KYC',
      accept: '.pdf,image/*',
      helperText:
        'Electricity, water, gas, telephone bill, or bank statement dated within the last two months.',
      required: true,
    },
    {
      id: 'proposedName1',
      label: 'Proposed name 1',
      type: 'text',
      section: 'Proposed Company Names',
      placeholder: 'e.g. ABC India Private Limited',
      validationHint: 'Must end with "India Private Limited"',
      required: true,
    },
    {
      id: 'proposedName2',
      label: 'Proposed name 2',
      type: 'text',
      section: 'Proposed Company Names',
      placeholder: 'e.g. ABC India Private Limited',
      validationHint: 'Must end with "India Private Limited"',
      required: true,
    },
    {
      id: 'companyMailId',
      label: 'Company Mail ID',
      type: 'text',
      section: 'Company Mail ID',
      placeholder: 'company@example.com',
      required: true,
    },
    {
      id: 'companyMobileCountryCode',
      label: 'Country code',
      type: 'select',
      section: 'Company Mobile Number',
      options: [...PRE1_MOBILE_COUNTRY_OPTIONS],
      required: true,
    },
    {
      id: 'companyMobileNumber',
      label: 'Mobile number',
      type: 'text',
      section: 'Company Mobile Number',
      placeholder: 'e.g. 9876543210',
      helperText: 'Digits only, without the country code prefix.',
      required: true,
    },
    {
      id: 'businessDescription',
      label:
        'Brief description of the business and operations to be carried out by the entity in India. (One Text Box – up to 100 words)',
      type: 'textarea',
      section: 'Business Description',
      maxWords: 100,
      required: true,
    },
    {
      id: 'directorCount',
      label: 'Number of proposed directors',
      type: 'select',
      section: 'Proposed Directors',
      options: [
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
      ],
      helperText:
        'Minimum 2 directors; at least one must be a resident of India. DIN is optional if already allotted.',
      required: true,
    },
    {
      id: 'director1FirstName',
      label: 'Director 1 — First name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director1MiddleName',
      label: 'Director 1 — Middle name (optional)',
      type: 'text',
      section: 'Proposed Directors',
      required: false,
    },
    {
      id: 'director1LastName',
      label: 'Director 1 — Last name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director1Gender',
      label: 'Director 1 — Gender',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_GENDER_OPTIONS],
      required: true,
    },
    {
      id: 'director1IndiaResident',
      label: 'Director 1 — Resident of India',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: true,
    },
    {
      id: 'director1Din',
      label: 'Director 1 — DIN (optional)',
      type: 'text',
      section: 'Proposed Directors',
      placeholder: 'e.g. 01234567',
      required: false,
    },
    {
      id: 'director1HasDsc',
      label: 'Director 1 — Do you have a DSC (Digital Signature Certificate)?',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: false,
    },
    {
      id: 'director1DscExpiryDate',
      label: 'Director 1 — DSC expiry date',
      type: 'date',
      section: 'Proposed Directors',
      placeholder: 'YYYY-MM-DD',
      required: true,
      showWhen: { field: 'director1HasDsc', value: 'yes' },
    },
    {
      id: 'director2FirstName',
      label: 'Director 2 — First name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director2MiddleName',
      label: 'Director 2 — Middle name (optional)',
      type: 'text',
      section: 'Proposed Directors',
      required: false,
    },
    {
      id: 'director2LastName',
      label: 'Director 2 — Last name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director2Gender',
      label: 'Director 2 — Gender',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_GENDER_OPTIONS],
      required: true,
    },
    {
      id: 'director2IndiaResident',
      label: 'Director 2 — Resident of India',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: true,
    },
    {
      id: 'director2Din',
      label: 'Director 2 — DIN (optional)',
      type: 'text',
      section: 'Proposed Directors',
      placeholder: 'e.g. 01234567',
      required: false,
    },
    {
      id: 'director2HasDsc',
      label: 'Director 2 — Do you have a DSC (Digital Signature Certificate)?',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: false,
    },
    {
      id: 'director2DscExpiryDate',
      label: 'Director 2 — DSC expiry date',
      type: 'date',
      section: 'Proposed Directors',
      placeholder: 'YYYY-MM-DD',
      required: true,
      showWhen: { field: 'director2HasDsc', value: 'yes' },
    },
    {
      id: 'director3FirstName',
      label: 'Director 3 — First name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director3MiddleName',
      label: 'Director 3 — Middle name (optional)',
      type: 'text',
      section: 'Proposed Directors',
      required: false,
    },
    {
      id: 'director3LastName',
      label: 'Director 3 — Last name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director3Gender',
      label: 'Director 3 — Gender',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_GENDER_OPTIONS],
      required: true,
    },
    {
      id: 'director3IndiaResident',
      label: 'Director 3 — Resident of India',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: true,
    },
    {
      id: 'director3Din',
      label: 'Director 3 — DIN (optional)',
      type: 'text',
      section: 'Proposed Directors',
      placeholder: 'e.g. 01234567',
      required: false,
    },
    {
      id: 'director3HasDsc',
      label: 'Director 3 — Do you have a DSC (Digital Signature Certificate)?',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: false,
    },
    {
      id: 'director3DscExpiryDate',
      label: 'Director 3 — DSC expiry date',
      type: 'date',
      section: 'Proposed Directors',
      placeholder: 'YYYY-MM-DD',
      required: true,
      showWhen: { field: 'director3HasDsc', value: 'yes' },
    },
    {
      id: 'director4FirstName',
      label: 'Director 4 — First name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director4MiddleName',
      label: 'Director 4 — Middle name (optional)',
      type: 'text',
      section: 'Proposed Directors',
      required: false,
    },
    {
      id: 'director4LastName',
      label: 'Director 4 — Last name',
      type: 'text',
      section: 'Proposed Directors',
      required: true,
    },
    {
      id: 'director4Gender',
      label: 'Director 4 — Gender',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_GENDER_OPTIONS],
      required: true,
    },
    {
      id: 'director4IndiaResident',
      label: 'Director 4 — Resident of India',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: true,
    },
    {
      id: 'director4Din',
      label: 'Director 4 — DIN (optional)',
      type: 'text',
      section: 'Proposed Directors',
      placeholder: 'e.g. 01234567',
      required: false,
    },
    {
      id: 'director4HasDsc',
      label: 'Director 4 — Do you have a DSC (Digital Signature Certificate)?',
      type: 'select',
      section: 'Proposed Directors',
      options: [...PRE1_INDIA_RESIDENT_OPTIONS],
      required: false,
    },
    {
      id: 'director4DscExpiryDate',
      label: 'Director 4 — DSC expiry date',
      type: 'date',
      section: 'Proposed Directors',
      placeholder: 'YYYY-MM-DD',
      required: true,
      showWhen: { field: 'director4HasDsc', value: 'yes' },
    },
    {
      id: 'authorisedShareCapital',
      label: 'Authorized Share Capital (INR) (ex: 10,00,000)',
      type: 'text',
      section: 'Share Capital Details',
      placeholder: '10,00,000',
      required: true,
    },
    {
      id: 'paidUpShareCapital',
      label: 'Initial Paid-up Share Capital (INR) (ex: 1,00,000)',
      type: 'text',
      section: 'Share Capital Details',
      placeholder: '1,00,000',
      required: true,
    },
    {
      id: 'nominalValuePerEquityShare',
      label: 'Nominal Value of Each Equity Share (ex: INR 10)',
      type: 'text',
      section: 'Share Capital Details',
      placeholder: '10',
      required: true,
    },
    {
      id: 'boardResolutionDate',
      label: 'Date of Board Resolution',
      type: 'date',
      section: 'Share Capital Details',
      placeholder: 'YYYY-MM-DD',
      helperText:
        'Date the parent entity board passed the resolution to incorporate the Indian subsidiary.',
      required: true,
    },
  ],
  'pre-2': [
    {
      id: 'boardResolutionDraftGeneratedAt',
      label: 'Draft generated on',
      type: 'date',
      section: 'Board Resolution',
      filledBy: 'intern',
    },
    {
      id: 'boardResolutionSharedAt',
      label: 'Shared with client on',
      type: 'date',
      section: 'Board Resolution',
      filledBy: 'intern',
    },
    {
      id: 'boardResolutionWorkflowNotes',
      label: 'Draft/review notes (optional)',
      type: 'textarea',
      section: 'Board Resolution',
      filledBy: 'intern',
      placeholder: 'Edits made, release comments, or client instructions…',
    },
  ],
  'pre-3': [
    {
      id: 'signedBoardResolutionUrl',
      label: 'Signed board resolution',
      type: 'file',
      section: 'Signed Board Resolution',
      accept: '.pdf,.docx,image/*',
      required: true,
    },
  ],
  'pre-4': [
    {
      id: 'nameApplicationAcknowledgementUrl',
      label: 'ROC name application acknowledgement',
      type: 'file',
      section: 'Filing acknowledgement',
      accept: '.pdf,image/*',
      filledBy: 'intern',
      required: true,
    },
    {
      id: 'nameApplicationFilingNotes',
      label: 'Filing notes (optional)',
      type: 'textarea',
      section: 'Filing acknowledgement',
      filledBy: 'intern',
      placeholder: 'SRN, filing reference, or remarks for the client…',
    },
  ],
  'pre-5': [
    {
      id: 'approvedCompanyName',
      label: 'Approved company name',
      type: 'text',
      section: 'Name Approval',
      filledBy: 'intern',
      required: true,
    },
    {
      id: 'nameApprovalDate',
      label: 'Name approval date',
      type: 'date',
      section: 'Name Approval',
      filledBy: 'intern',
      required: true,
    },
    {
      id: 'nameApprovalExpiryDate',
      label: 'Name approval expiry date',
      type: 'date',
      section: 'Name Approval',
      filledBy: 'intern',
      required: true,
      helperText: `Valid for ${MCA_NAME_APPROVAL_VALIDITY_DAYS} days from the approval date (set automatically).`,
    },
    {
      id: 'mcaApprovalLetterUrl',
      label: 'MCA name approval letter',
      type: 'file',
      section: 'Name Approval',
      accept: '.pdf,image/*',
      filledBy: 'intern',
      required: true,
    },
  ],
  'pre-6': PRE6_CLIENT_RESPONSE_FIELDS,
  'pre-7': [
    {
      id: 'kycReviewStatus',
      label: 'Know Your Customer (KYC) review status',
      type: 'select',
      section: 'KYC review',
      filledBy: 'intern',
      options: [
        { value: 'approved', label: 'Approved' },
        { value: 'corrections-requested', label: 'Corrections Requested' },
      ],
      required: true,
    },
    {
      id: 'kycReviewNotes',
      label: 'Know Your Customer (KYC) review notes / correction requests',
      type: 'textarea',
      section: 'KYC review',
      filledBy: 'intern',
      required: true,
      placeholder: 'Mention any corrections requested from the client.',
    },
    {
      id: 'nrDirectorDscSuccessMessageUrl',
      label: 'Digital Signature Certificate (DSC) success message - Non-resident Director',
      type: 'file',
      section: 'DSC creation (eMudhra)',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorDscSuccessMessageUrl',
      label: 'Digital Signature Certificate (DSC) success message - Resident Director',
      type: 'file',
      section: 'DSC creation (eMudhra)',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorDir2DraftUrl',
      label: 'DIR-2 draft - Non-resident Director',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorDir2DraftUrl',
      label: 'DIR-2 draft - Resident Director',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorDir8DraftUrl',
      label: 'DIR-8 draft - Non-resident Director',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorDir8DraftUrl',
      label: 'DIR-8 draft - Resident Director',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorInc9DraftUrl',
      label: 'INC-9 draft - Non-resident Director',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorInc9DraftUrl',
      label: 'INC-9 draft - Resident Director',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorPanUndertakingDraftUrl',
      label: 'Permanent Account Number (PAN) undertaking draft - Non-resident Director (if applicable)',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
    },
    {
      id: 'moaDraftUrl',
      label: 'Memorandum of Association (MOA) draft',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'aoaDraftUrl',
      label: 'Articles of Association (AOA) draft',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'authorisationLetterDraftUrl',
      label: 'Authorisation Letter draft',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'acceptanceLetterDraftUrl',
      label: 'Acceptance Letter draft',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'boardResolutionDraftForIncorpUrl',
      label: 'Board Resolution draft',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'moaSubscriptionSheetDraftUrl',
      label: 'Memorandum of Association (MOA) Subscription Sheets draft',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'aoaSubscriptionSheetDraftUrl',
      label: 'Articles of Association (AOA) Subscription Sheets draft',
      type: 'file',
      section: 'Draft Incorporation Docs',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'otherAttachment1Url',
      label: 'Other attachment 1',
      type: 'file',
      section: 'Other attachments (optional)',
      filledBy: 'intern',
      accept: '.pdf,image/*',
    },
    {
      id: 'otherAttachment2Url',
      label: 'Other attachment 2',
      type: 'file',
      section: 'Other attachments (optional)',
      filledBy: 'intern',
      accept: '.pdf,image/*',
    },
    {
      id: 'otherAttachment3Url',
      label: 'Other attachment 3',
      type: 'file',
      section: 'Other attachments (optional)',
      filledBy: 'intern',
      accept: '.pdf,image/*',
    },
  ],
  'pre-8': [
    {
      id: 'nrDirectorPassportSignedUrl',
      label: 'Passport - Non-resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorPassportSignedUrl',
      label: 'Passport - Resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorDrivingLicenceSignedUrl',
      label: 'Driving Licence - Non-resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorDrivingLicenceSignedUrl',
      label: 'Driving Licence - Resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorUtilityBillSignedUrl',
      label: 'Utility Bill - Non-resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorUtilityBillSignedUrl',
      label: 'Utility Bill - Resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorDir2SignedUrl',
      label: 'DIR-2 - Non-resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorDir2SignedUrl',
      label: 'DIR-2 - Resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorDir8SignedUrl',
      label: 'DIR-8 - Non-resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorDir8SignedUrl',
      label: 'DIR-8 - Resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorInc9SignedUrl',
      label: 'INC-9 - Non-resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'residentDirectorInc9SignedUrl',
      label: 'INC-9 - Resident Director (self-signed)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'nrDirectorPanUndertakingSignedUrl',
      label: 'Permanent Account Number (PAN) undertaking - Non-resident Director (if applicable)',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
    },
    {
      id: 'certificateOfIncorporationSignedUrl',
      label: 'Certificate of Incorporation',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'authorisationLetterSignedUrl',
      label: 'Authorisation Letter',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'acceptanceLetterSignedUrl',
      label: 'Acceptance Letter',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'boardResolutionSignedForIncorpUrl',
      label: 'Board Resolution',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'moaSubscriptionSheetSignedUrl',
      label: 'Memorandum of Association (MOA) Subscription Sheet',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'aoaSubscriptionSheetSignedUrl',
      label: 'Articles of Association (AOA) Subscription Sheet',
      type: 'file',
      section: 'Signed Documents',
      accept: '.pdf,image/*',
      required: true,
    },
  ],
  'pre-9': [
    {
      id: 'spicePartBApplicationReview',
      label: 'Application review notes',
      type: 'textarea',
      section: 'SPICe+ Confirmation',
      helperText: 'Summarize your review of the shared SPICe+ Part B application.',
      required: true,
    },
    {
      id: 'spicePartBConfirmation',
      label: 'Confirmation',
      type: 'select',
      section: 'SPICe+ Confirmation',
      options: [
        { value: 'confirmed', label: 'Confirmed — proceed to filing' },
        { value: 'changes-recommended', label: 'Changes recommended' },
      ],
      required: true,
    },
    {
      id: 'spicePartBRecommendedChanges',
      label: 'Recommended changes',
      type: 'textarea',
      section: 'SPICe+ Confirmation',
      showWhen: { field: 'spicePartBConfirmation', value: 'changes-recommended' },
      required: true,
    },
  ],
  'pre-10': [
    {
      id: 'spicePartBAndAgileFiledNotes',
      label: 'SPICe+ Part B and AGILE-PRO-S filing note',
      type: 'textarea',
      section: 'Filing completion',
      filledBy: 'intern',
      required: true,
      helperText: 'Mention that SPICe+ Part B and AGILE-PRO-S were filled and submitted.',
    },
  ],
  'pre-11': [
    {
      id: 'mcaRemarksSummary',
      label: 'MCA remarks summary',
      type: 'textarea',
      section: 'MCA Remarks',
      filledBy: 'intern',
      required: true,
    },
    {
      id: 'clientInformationRequested',
      label: 'Client information or documents requested',
      type: 'textarea',
      section: 'MCA Remarks',
      filledBy: 'intern',
      required: true,
      helperText: 'Enter "None" if no additional client input was required.',
    },
    {
      id: 'clarificationLetterUrl',
      label: 'Clarification letter',
      type: 'file',
      section: 'MCA Remarks',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'resubmissionNotes',
      label: 'Resubmission notes',
      type: 'textarea',
      section: 'MCA Remarks',
      filledBy: 'intern',
      required: true,
    },
  ],
  'pre-12': [
    {
      id: 'incorporatedCompanyName',
      label: 'Company Name',
      type: 'text',
      section: 'MCA Approval',
      filledBy: 'intern',
      required: true,
      helperText:
        'The legal name of the company as approved and registered with the Ministry of Corporate Affairs (MCA). This name will appear on all statutory registrations and official documents.',
    },
    {
      id: 'dateOfIncorporation',
      label: 'Date of Incorporation',
      type: 'date',
      section: 'MCA Approval',
      filledBy: 'intern',
      required: true,
    },
    {
      id: 'cin',
      label: 'Corporate Identification Number (CIN)',
      type: 'text',
      section: 'MCA Approval',
      filledBy: 'intern',
      required: true,
      helperText:
        'A unique 21-character identification number assigned to every company incorporated in India. The CIN contains details such as listing status, industry type, state of registration, and year of incorporation. It serves as the primary reference number for MCA records and filings.',
    },
    {
      id: 'pan',
      label: 'Permanent Account Number (PAN)',
      type: 'text',
      section: 'MCA Approval',
      filledBy: 'intern',
      required: true,
      helperText:
        "The company's tax identification number issued by the Income Tax Department. It is required for filing income tax returns, opening bank accounts, and conducting financial transactions.",
    },
    {
      id: 'tan',
      label: 'Tax Deduction and Collection Account Number (TAN)',
      type: 'text',
      section: 'MCA Approval',
      filledBy: 'intern',
      required: true,
      helperText:
        'A unique number issued for entities responsible for deducting or collecting tax at source (withholding tax). It is mandatory for TDS and TCS compliance under the Income Tax Act. All TDS-related returns and payments must be filed using the TAN.',
    },
    {
      id: 'pfCode',
      label: 'Provident Fund Establishment Code (PF)',
      type: 'text',
      section: 'MCA Approval',
      filledBy: 'intern',
      required: true,
      helperText:
        "The registration number allotted by the Employees' Provident Fund Organisation (EPFO). It enables the company to comply with provident fund regulations for eligible employees. This code is used for PF contributions, filings, and employee benefit management.",
    },
    {
      id: 'esiCode',
      label: "Employees' State Insurance Code (ESI)",
      type: 'text',
      section: 'MCA Approval',
      filledBy: 'intern',
      required: true,
      helperText:
        "The registration number issued under the Employees' State Insurance (ESI) scheme. It is required for companies covered under the ESI Act to provide medical and social security benefits. The code is used for employee enrollment, contributions, and compliance reporting.",
    },
    {
      id: 'coiSignatureVerifiedByMca',
      label: 'Is the Certificate of Incorporation signature verified by MCA?',
      type: 'select',
      section: 'Attachments',
      filledBy: 'intern',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
      required: true,
    },
    {
      id: 'certificateOfIncorporationFinalUrl',
      label: 'Certificate of Incorporation',
      type: 'file',
      section: 'Attachments',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'panCardFinalUrl',
      label: 'Permanent Account Number (PAN) Card',
      type: 'file',
      section: 'Attachments',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'tanCardFinalUrl',
      label: 'Tax Deduction and Collection Account Number (TAN) Card',
      type: 'file',
      section: 'Attachments',
      filledBy: 'intern',
      accept: '.pdf,image/*',
      required: true,
    },
  ],
  'post-1': [
    { id: 'boardMeetingAgenda', label: 'Agenda of first board meeting', type: 'textarea' },
    { id: 'boardMeetingMinutes', label: 'Minutes / resolutions summary', type: 'textarea' },
  ],
  'post-2': [
    { id: 'auditorName', label: 'Proposed auditor / firm name', type: 'text' },
    {
      id: 'auditorDocsNotes',
      label: 'Board resolution & consent letters status',
      type: 'textarea',
    },
  ],
  'post-3': [
    {
      id: 'bankAccountNotes',
      label: 'HDFC bank account opening — documents status',
      type: 'textarea',
      placeholder: 'COI, PAN, rental deed, board resolution for bank account',
    },
  ],
  'post-4': [
    {
      id: 'capitalInfusionNotes',
      label: 'Share capital infusion details',
      type: 'textarea',
      placeholder: 'Bank statement reference, amount, date',
      helperText: 'Notify the Director by email when infusion is ready to proceed.',
    },
  ],
  'post-5': [{ id: 'allotteeDetails', label: 'Details of allottees (Form SH-1)', type: 'textarea' }],
  'post-6': [
    {
      id: 'inc20aNotes',
      label: 'Commencement of business (INC-20A) status',
      type: 'textarea',
    },
  ],
  'post-7': [
    {
      id: 'fcgprFirmsRegistrationNumber',
      label: 'FIRMS Portal Registration Number',
      type: 'text',
      section: 'FC-GPR Filing',
      placeholder: 'e.g. IN202XXXXXXXX',
      required: true,
    },
    {
      id: 'fcgprFircNumber',
      label: 'FIRC Number',
      type: 'text',
      section: 'FC-GPR Filing',
      placeholder: 'Foreign Inward Remittance Certificate number',
      required: true,
    },
    {
      id: 'fcgprRemittanceDate',
      label: 'Remittance Date',
      type: 'date',
      section: 'FC-GPR Filing',
      required: true,
    },
    {
      id: 'fcgprRemittanceAmount',
      label: 'Remittance Amount (INR)',
      type: 'text',
      section: 'FC-GPR Filing',
      placeholder: 'e.g. 1,00,000',
      required: true,
    },
    {
      id: 'fcgprAdBankName',
      label: 'Authorised Dealer (AD) Bank Name',
      type: 'text',
      section: 'FC-GPR Filing',
      required: true,
    },
    {
      id: 'fcgprFilingDate',
      label: 'FCGPR Filing Date with RBI',
      type: 'date',
      section: 'FC-GPR Filing',
      required: true,
    },
    {
      id: 'fcgprSrn',
      label: 'RBI / FIRMS Acknowledgement / SRN',
      type: 'text',
      section: 'FC-GPR Filing',
      placeholder: 'Filing reference or SRN',
      required: true,
    },
    {
      id: 'fcgprNotes',
      label: 'Additional notes (optional)',
      type: 'textarea',
      section: 'FC-GPR Filing',
      placeholder: 'Any remarks about the filing or follow-up required…',
    },
  ],
  'post-9': [
    {
      id: 'letterheadNotes',
      label: 'Letterhead design / print status',
      type: 'textarea',
      placeholder: 'Design, printing, and delivery status for company letterhead…',
    },
  ],
  'post-10': [
    {
      id: 'nameBoardNotes',
      label: 'Name board display status',
      type: 'textarea',
      placeholder: 'Name board fabrication, installation, and display details…',
    },
    {
      id: 'nameBoardPhoto',
      label: 'Photo evidence of name board at registered office',
      type: 'file',
      accept: '.pdf,image/*',
      required: false,
    },
  ],
  'post-11': [
    {
      id: 'inc22NewAddress',
      label: 'Updated registered office address',
      type: 'textarea',
      section: 'INC-22 Filing',
      placeholder: 'Full new registered office address…',
      required: true,
    },
    {
      id: 'inc22FilingDate',
      label: 'INC-22 Filing Date',
      type: 'date',
      section: 'INC-22 Filing',
      required: true,
    },
    {
      id: 'inc22Srn',
      label: 'INC-22 SRN',
      type: 'text',
      section: 'INC-22 Filing',
      placeholder: 'Service Request Number from MCA portal',
      required: true,
    },
    {
      id: 'inc22Notes',
      label: 'Additional notes (optional)',
      type: 'textarea',
      section: 'INC-22 Filing',
      placeholder: 'Proof of address / occupancy status, or remarks…',
    },
  ],
  'post-8': [
    {
      id: 'mgt4FilingDate',
      label: 'MGT-4 Filing Date',
      type: 'date',
      section: 'Nominee Shareholder',
      required: true,
    },
    {
      id: 'mgt4Srn',
      label: 'MGT-4 SRN',
      type: 'text',
      section: 'Nominee Shareholder',
      placeholder: 'Service Request Number from MCA portal',
      required: true,
    },
    {
      id: 'mgt5FilingDate',
      label: 'MGT-5 Filing Date',
      type: 'date',
      section: 'Nominee Shareholder',
      required: true,
    },
    {
      id: 'mgt5Srn',
      label: 'MGT-5 SRN',
      type: 'text',
      section: 'Nominee Shareholder',
      placeholder: 'Service Request Number from MCA portal',
      required: true,
    },
    {
      id: 'mgt6FilingDate',
      label: 'MGT-6 Filing Date',
      type: 'date',
      section: 'Nominee Shareholder',
      required: true,
    },
    {
      id: 'mgt6Srn',
      label: 'MGT-6 SRN',
      type: 'text',
      section: 'Nominee Shareholder',
      placeholder: 'Service Request Number from MCA portal',
      required: true,
    },
    {
      id: 'nomineeShareholderNotes',
      label: 'Additional notes (optional)',
      type: 'textarea',
      section: 'Nominee Shareholder',
      placeholder: 'Beneficial owner details, declarations status, or remarks…',
    },
  ],
  'reg-1': [
    {
      id: 'pfRegistrationNumber',
      label: 'Provident Fund (PF) Registration Number',
      type: 'text',
      section: 'EPF Registration',
      placeholder: 'e.g. APBAN0000000000',
      required: true,
    },
    {
      id: 'pfRegistrationDate',
      label: 'Provident Fund (PF) Registration Date',
      type: 'date',
      section: 'EPF Registration',
      required: true,
    },
    {
      id: 'dscEsignCredentialsNotes',
      label: 'DSC / E-Sign activation notes',
      type: 'textarea',
      section: 'DSC / E-Sign',
      placeholder: 'Credentials status, activation date, or remarks…',
    },
  ],
  'reg-2': [
    {
      id: 'panNumber',
      label: 'Permanent Account Number (PAN)',
      type: 'text',
      section: 'PAN and TAN',
      placeholder: 'e.g. AABCS1429B',
      required: true,
    },
    {
      id: 'tanNumber',
      label: 'Tax Deduction and Collection Account Number (TAN)',
      type: 'text',
      section: 'PAN and TAN',
      placeholder: 'e.g. BLRB01234A',
      required: true,
    },
    {
      id: 'panTanAllotmentDate',
      label: 'Allotment Date',
      type: 'date',
      section: 'PAN and TAN',
      required: true,
    },
  ],
  'reg-3': [
    {
      id: 'esiRegistrationNumber',
      label: "Employees' State Insurance (ESI) Registration Number",
      type: 'text',
      section: 'ESI Registration',
      placeholder: 'e.g. 74000000000000001',
      required: true,
    },
    {
      id: 'esiRegistrationDate',
      label: "Employees' State Insurance (ESI) Registration Date",
      type: 'date',
      section: 'ESI Registration',
      required: true,
    },
  ],
  'reg-4': [
    {
      id: 'gstinNumber',
      label: 'GSTIN',
      type: 'text',
      section: 'GST Registration',
      placeholder: 'e.g. 29AABCS1429B1Z1',
      required: true,
    },
    {
      id: 'gstRegistrationDate',
      label: 'GST Registration Date',
      type: 'date',
      section: 'GST Registration',
      required: true,
    },
    {
      id: 'gstCertificateUrl',
      label: 'GST Certificate',
      type: 'file',
      section: 'GST Registration',
      accept: '.pdf,image/*',
      required: true,
    },
    {
      id: 'lutFilingDate',
      label: 'LUT Filing Date',
      type: 'date',
      section: 'LUT Filing',
    },
    {
      id: 'lutArn',
      label: 'LUT ARN / Acknowledgement',
      type: 'text',
      section: 'LUT Filing',
      placeholder: 'Application Reference Number',
    },
    {
      id: 'lutNotes',
      label: 'LUT notes (optional)',
      type: 'textarea',
      section: 'LUT Filing',
      placeholder: 'Witness KYC status, portal remarks…',
    },
  ],
  'reg-5': [
    {
      id: 'lutFilingDate',
      label: 'LUT Filing Date',
      type: 'date',
      section: 'LUT Filing',
      required: true,
    },
    {
      id: 'lutArn',
      label: 'LUT ARN / Acknowledgement',
      type: 'text',
      section: 'LUT Filing',
      placeholder: 'Application Reference Number',
      required: true,
    },
    {
      id: 'lutNotes',
      label: 'LUT notes (optional)',
      type: 'textarea',
      section: 'LUT Filing',
      placeholder: 'Witness KYC status, portal remarks…',
    },
  ],
  'reg-6': [
    {
      id: 'leiNumber',
      label: 'LEI Number',
      type: 'text',
      section: 'LEI Registration',
      placeholder: '20-character LEI code',
      required: true,
    },
    {
      id: 'leiRegistrationDate',
      label: 'LEI Registration Date',
      type: 'date',
      section: 'LEI Registration',
      required: true,
    },
    {
      id: 'leiExpiryDate',
      label: 'LEI Expiry Date',
      type: 'date',
      section: 'LEI Registration',
      required: true,
    },
  ],
  'reg-7': [
    {
      id: 'ptRegistrationNumberCompany',
      label: 'PT Registration Number — Company',
      type: 'text',
      section: 'Professional Tax',
      required: true,
    },
    {
      id: 'ptRegistrationNumberDirectors',
      label: 'PT Registration Number — Directors',
      type: 'text',
      section: 'Professional Tax',
      required: true,
    },
    {
      id: 'ptRegistrationDate',
      label: 'PT Registration Date',
      type: 'date',
      section: 'Professional Tax',
      required: true,
    },
  ],
  'reg-8': [
    {
      id: 'iecCode',
      label: 'IEC Code',
      type: 'text',
      section: 'IEC Registration',
      placeholder: 'e.g. AABCS1234A',
      required: true,
    },
    {
      id: 'iecRegistrationDate',
      label: 'IEC Registration Date',
      type: 'date',
      section: 'IEC Registration',
      required: true,
    },
    {
      id: 'iecCertificateUrl',
      label: 'IEC Certificate',
      type: 'file',
      section: 'IEC Registration',
      accept: '.pdf,image/*',
      required: true,
    },
  ],
  'reg-9': [],
  'reg-10': [],
  'reg-11': [],
  'reg-12': [],
  'reg-13': [
    {
      id: 'clraRegistrationNumber',
      label: 'CLRA Registration Number',
      type: 'text',
      section: 'CLRA Registration',
      placeholder: 'Registration / licence number',
    },
    {
      id: 'clraNotes',
      label: 'CLRA registration status',
      type: 'textarea',
      section: 'CLRA Registration',
      placeholder: 'Applicability, filing status, and contractor details…',
    },
  ],
  'reg-14': [
    {
      id: 'poshSheBoxId',
      label: 'SHE Box / POSH registration ID',
      type: 'text',
      section: 'POSH / SHE Box',
      placeholder: 'Portal registration or acknowledgement ID',
    },
    {
      id: 'poshNotes',
      label: 'POSH / SHE Box status',
      type: 'textarea',
      section: 'POSH / SHE Box',
      placeholder: 'ICC constitution, portal registration, and policy status…',
    },
  ],
  'reg-15': [
    {
      id: 'msmeUdyamNumber',
      label: 'Udyam / MSME Registration Number',
      type: 'text',
      section: 'MSME Registration',
      placeholder: 'e.g. UDYAM-XX-00-0000000',
      required: true,
    },
    {
      id: 'msmeRegistrationDate',
      label: 'MSME Registration Date',
      type: 'date',
      section: 'MSME Registration',
    },
    {
      id: 'msmeNotes',
      label: 'Additional notes (optional)',
      type: 'textarea',
      section: 'MSME Registration',
      placeholder: 'NIC codes, category (Micro/Small/Medium), or remarks…',
    },
  ],
};

const GENERIC_FIELD: ChecklistField = {
  id: 'details',
  label: 'Your information',
  type: 'textarea',
  placeholder: 'Share the details your engagement team needs for this milestone…',
};

/** Optional notes on any checklist step — shared by client and project lead. */
export const STEP_REMARKS_FIELD_ID = 'stepRemarks';

export const STEP_REMARKS_FIELD: ChecklistField = {
  id: STEP_REMARKS_FIELD_ID,
  label: 'Remarks (optional)',
  type: 'textarea',
  placeholder: 'Add any notes for this step…',
  helperText: 'Optional notes from client or project lead — blank is fine.',
  required: false,
};

export function isStepRemarksField(fieldOrId: ChecklistField | string): boolean {
  const id = typeof fieldOrId === 'string' ? fieldOrId : fieldOrId.id;
  return id === STEP_REMARKS_FIELD_ID;
}

function withStepRemarksField(fields: ChecklistField[]): ChecklistField[] {
  if (fields.some((f) => isStepRemarksField(f))) return fields;
  return [...fields, STEP_REMARKS_FIELD];
}

/** Ensure optional remarks appear after step-specific conditional fields (e.g. pre-6). */
export function appendStepRemarksToVisible(
  visible: ChecklistField[],
  allFields: ChecklistField[],
): ChecklistField[] {
  const remarks = allFields.find((f) => isStepRemarksField(f));
  if (!remarks || visible.some((f) => isStepRemarksField(f))) return visible;
  return [...visible, remarks];
}

export function getClientResponseFields(item: ChecklistItem): ChecklistField[] {
  let base: ChecklistField[];
  if (item.fields?.length) {
    base = [...item.fields];
  } else if (Object.prototype.hasOwnProperty.call(CLIENT_RESPONSE_FIELDS, item.id)) {
    base = [...(CLIENT_RESPONSE_FIELDS[item.id] ?? [])];
  } else if (item.bucket === 'pre-inc' || item.bucket === 'post-inc') {
    base = [{ ...GENERIC_FIELD, placeholder: `Details for: ${item.title}` }];
  } else {
    base = [];
  }
  return withStepRemarksField(base);
}

export type ChecklistItemResponses = Record<string, string>;

const ITEM_META_KEYS = new Set([
  'status',
  'assigneeId',
  'notes',
  'completedOn',
  'responses',
  'clientSubmittedAt',
  'locked',
  'unlockedFields',
  'reviewStatus',
  'reviewedAt',
  'reviewedBy',
  'rejectionNote',
]);

/** Field ids for a checklist item (for legacy flat jsonb shapes). */
export function responseFieldIdsForItem(itemId: string): string[] {
  const item = checklist.find((c) => c.id === itemId);
  if (!item) return [STEP_REMARKS_FIELD_ID];
  return getClientResponseFields(item).map((f) => f.id);
}

/** Coerce stored jsonb / localStorage shapes into a flat responses map. */
export function extractItemResponses(
  item: ChecklistItem,
  slice?: { responses?: ChecklistItemResponses } | Record<string, unknown> | null,
): ChecklistItemResponses {
  if (!slice || typeof slice !== 'object') return {};

  const fieldIds = new Set(
    getClientResponseFields(item).map((f) => f.id),
  );
  const out: ChecklistItemResponses = {};

  const mergeResponses = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const obj = raw as Record<string, unknown>;
    if (
      obj.responses &&
      typeof obj.responses === 'object' &&
      !Array.isArray(obj.responses)
    ) {
      mergeResponses(obj.responses);
    }
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'responses') continue;
      if (typeof value === 'string' && value.trim()) {
        out[key] = value;
      }
    }
  };

  mergeResponses(slice.responses);

  for (const id of fieldIds) {
    const v = slice[id];
    if (typeof v === 'string' && v.trim()) {
      out[id] = v;
    }
  }

  for (const [key, value] of Object.entries(slice)) {
    if (ITEM_META_KEYS.has(key) || !fieldIds.has(key)) continue;
    if (typeof value === 'string' && value.trim()) {
      out[key] = value;
    }
  }

  return out;
}

const SUMMARY_MAX = 72;

function truncateSummary(value: string, max = SUMMARY_MAX): string {
  const compact = value.trim().replace(/\s+/g, ' ');
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function joinSummaryParts(parts: (string | undefined)[], separator = ' · '): string | null {
  const values = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  if (!values.length) return null;
  return truncateSummary(values.join(separator));
}

export interface ResponseSummaryResult {
  /** One-line (or two-line clamped) preview; null when nothing filled */
  summary: string | null;
  filledCount: number;
  fieldCount: number;
  isComplete: boolean;
  hasAny: boolean;
}

/** Compact row preview for saved client responses on milestone lists. */
export function formatResponseSummary(
  item: ChecklistItem,
  responses?: ChecklistItemResponses,
  context?: { pre1Responses?: ChecklistItemResponses },
): ResponseSummaryResult {
  const allFields = getClientResponseFields(item);
  const r = responses ?? {};
  const pre1 = context?.pre1Responses ?? {};
  const fields = appendStepRemarksToVisible(
    item.id === 'pre-1'
      ? getPre1VisibleFields(allFields, r)
      : item.id === 'pre-6'
        ? getPre6VisibleFields(allFields, r, pre1)
        : allFields,
    allFields,
  );
  const countableFields = fields.filter((f) => f.required !== false);
  const filled = countableFields.filter((f) => (r[f.id] ?? '').trim().length > 0);
  const filledCount = filled.length;
  const fieldCount = countableFields.length;
  const isComplete = fieldCount > 0 && filledCount === fieldCount;
  const hasAny = filledCount > 0;

  if (!hasAny) {
    return { summary: null, filledCount, fieldCount, isComplete, hasAny };
  }

  let summary: string | null = null;

  switch (item.id) {
    case 'pre-1': {
      const count = parseDirectorCount(r);
      const directors = [1, 2, 3, 4]
        .filter((n) => n <= count)
        .map((n) => {
          const name = resolveDirectorDisplayName(r, n);
          const gender = pre1GenderLabel(r[`director${n}Gender`]);
          const resident = r[`director${n}IndiaResident`] === 'yes' ? 'IN res.' : undefined;
          if (!name && !gender && !resident) return null;
          return [name, gender, resident].filter(Boolean).join(' · ');
        })
        .filter((entry): entry is string => Boolean(entry));
      summary = joinSummaryParts([
        r.parentEntityName?.trim(),
        r.proposedName1?.trim(),
        directors.length ? `Dirs: ${directors.join(', ')}` : undefined,
      ]);
      break;
    }
    case 'pre-2':
      summary = null;
      break;
    case 'pre-3':
      summary = r.signedBoardResolutionUrl?.trim()
        ? 'Signed Board Resolutioned'
        : null;
      break;
    case 'pre-4':
      summary = r.nameApplicationAcknowledgementUrl?.trim()
        ? 'ROC acknowledgement on file'
        : r.nameApplicationFilingNotes?.trim()
          ? truncateSummary(r.nameApplicationFilingNotes)
          : null;
      break;
    case 'pre-5': {
      const approvalDate = r.nameApprovalDate?.trim();
      const expiryDate =
        r.nameApprovalExpiryDate?.trim() ||
        (approvalDate ? computeMcaNameApprovalExpiryDate(approvalDate) : undefined);
      summary = joinSummaryParts([
        r.approvedCompanyName?.trim(),
        approvalDate,
        expiryDate ? `Expires ${expiryDate}` : undefined,
      ]);
      break;
    }
    case 'pre-6': {
      const directorNames = getPre6DirectorNameOptions(r, pre1).map((o) => o.label);
      summary = joinSummaryParts([
        directorNames.length ? directorNames.join(', ') : undefined,
        r.registeredOfficeCompleteAddress?.trim()
          ? truncateSummary(r.registeredOfficeCompleteAddress)
          : undefined,
      ]);
      break;
    }
    case 'pre-7':
      summary = joinSummaryParts([
        r.kycReviewStatus?.trim(),
        r.kycReviewNotes?.trim(),
      ]);
      break;
    case 'pre-8':
      summary = r.moaSubscriptionSheetSignedUrl?.trim()
        ? 'Signed incorporation documents on file'
        : null;
      break;
    case 'pre-9':
      summary = joinSummaryParts([
        r.spicePartBConfirmation?.trim() === 'changes-recommended'
          ? 'Changes recommended'
          : r.spicePartBConfirmation?.trim() === 'confirmed'
            ? 'Confirmed'
            : undefined,
        r.spicePartBApplicationReview?.trim()
          ? truncateSummary(r.spicePartBApplicationReview)
          : undefined,
      ]);
      break;
    case 'pre-10':
      summary = r.spicePartBAndAgileFiledNotes?.trim()
        ? truncateSummary(r.spicePartBAndAgileFiledNotes)
        : null;
      break;
    case 'pre-11':
      summary = r.mcaRemarksSummary?.trim() ? truncateSummary(r.mcaRemarksSummary) : null;
      break;
    case 'pre-12':
      summary = joinSummaryParts([
        r.incorporatedCompanyName?.trim(),
        r.dateOfIncorporation?.trim(),
        r.cin?.trim(),
      ]);
      break;
    case 'post-1':
      summary = r.boardMeetingAgenda?.trim()
        ? truncateSummary(r.boardMeetingAgenda)
        : null;
      break;
    case 'post-2':
      summary = r.auditorName?.trim() ?? null;
      if (!summary && r.auditorDocsNotes?.trim()) {
        summary = truncateSummary(r.auditorDocsNotes);
      }
      break;
    case 'post-3':
      summary = r.bankAccountNotes?.trim() ? truncateSummary(r.bankAccountNotes) : null;
      break;
    case 'post-4':
      summary = r.capitalInfusionNotes?.trim() ? truncateSummary(r.capitalInfusionNotes) : null;
      break;
    case 'post-5':
      summary = r.allotteeDetails?.trim() ? truncateSummary(r.allotteeDetails) : null;
      break;
    case 'post-6':
      summary = r.inc20aNotes?.trim() ? truncateSummary(r.inc20aNotes) : null;
      break;
    case 'post-7':
      summary = joinSummaryParts([
        r.fcgprFirmsRegistrationNumber?.trim(),
        r.fcgprFilingDate?.trim(),
        r.fcgprSrn?.trim(),
      ]);
      break;
    case 'post-8':
      summary = joinSummaryParts([
        r.mgt4Srn?.trim(),
        r.mgt5Srn?.trim(),
        r.mgt6Srn?.trim(),
      ]);
      break;
    case 'post-9':
      summary = r.letterheadNotes?.trim() ? truncateSummary(r.letterheadNotes) : null;
      break;
    case 'post-10':
      summary = r.nameBoardPhoto?.trim()
        ? 'Name board photo on file'
        : r.nameBoardNotes?.trim()
          ? truncateSummary(r.nameBoardNotes)
          : null;
      break;
    case 'post-11':
      summary = joinSummaryParts([r.inc22Srn?.trim(), r.inc22NewAddress?.trim()]);
      break;
    case 'reg-4':
      summary = joinSummaryParts([r.gstinNumber?.trim(), r.lutArn?.trim()]);
      break;
    case 'reg-5':
      summary = joinSummaryParts([r.lutArn?.trim(), r.lutFilingDate?.trim()]);
      break;
    case 'reg-13':
      summary = r.clraRegistrationNumber?.trim()
        ? truncateSummary(r.clraRegistrationNumber)
        : r.clraNotes?.trim()
          ? truncateSummary(r.clraNotes)
          : null;
      break;
    case 'reg-14':
      summary = r.poshSheBoxId?.trim()
        ? truncateSummary(r.poshSheBoxId)
        : r.poshNotes?.trim()
          ? truncateSummary(r.poshNotes)
          : null;
      break;
    case 'reg-15':
      summary = joinSummaryParts([r.msmeUdyamNumber?.trim()]);
      break;
    default:
      break;
  }

  if (!summary && filledCount === 1) {
    summary = truncateSummary(r[filled[0].id] ?? '');
  } else if (!summary && filledCount > 1) {
    summary =
      fieldCount > 0
        ? `${filledCount} of ${fieldCount} fields completed`
        : `${filledCount} fields completed`;
  }

  return { summary, filledCount, fieldCount, isComplete, hasAny };
}

/** Steps where project lead fills data and delivers to the client portal. */
export const INTERN_DELIVERY_STEP_IDS = new Set([
  'pre-4',
  'pre-5',
  'pre-7',
  'pre-10',
  'pre-11',
  'pre-12',
]);

export function validateInternDelivery(
  itemId: string,
  responses: ChecklistItemResponses,
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (itemId === 'pre-4') {
    if (!responses.nameApplicationAcknowledgementUrl?.trim()) {
      errors.nameApplicationAcknowledgementUrl = 'Upload the ROC filing acknowledgement.';
    }
  }

  if (itemId === 'pre-5') {
    if (!responses.approvedCompanyName?.trim()) {
      errors.approvedCompanyName = 'Enter the approved company name.';
    }
    if (!responses.nameApprovalDate?.trim()) {
      errors.nameApprovalDate = 'Enter the name approval date.';
    }
    if (!responses.mcaApprovalLetterUrl?.trim()) {
      errors.mcaApprovalLetterUrl = 'Upload the MCA name approval letter.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
