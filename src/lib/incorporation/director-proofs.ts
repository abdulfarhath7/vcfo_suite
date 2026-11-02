/**
 * Proof-of-identity and proof-of-residence choices a director confirms on
 * `pre-15`. DIR-2 prints "Copy of {document}"; `document` is the printed
 * name, `label` what the form shows.
 */
export interface DirectorProofOption {
  value: string;
  label: string;
  document: string;
}

export const DIRECTOR_IDENTITY_PROOF_OPTIONS: readonly DirectorProofOption[] = [
  { value: 'aadhaar', label: 'Aadhaar card', document: 'Aadhaar Card' },
  { value: 'passport', label: 'Passport', document: 'Passport' },
  { value: 'pan', label: 'PAN card', document: 'PAN Card' },
  { value: 'driving-licence', label: 'Driving licence', document: 'Driving License' },
  { value: 'voter-id', label: 'Voter ID', document: 'Voter ID Card' },
];

/** Non-resident directors only; residents keep their utility-bill type. */
export const DIRECTOR_RESIDENCE_PROOF_OPTIONS: readonly DirectorProofOption[] = [
  { value: 'driving-licence', label: 'Driving licence', document: 'Driving License' },
  { value: 'utility-bill', label: 'Utility bill', document: 'Utility Bill' },
  { value: 'bank-statement', label: 'Bank statement', document: 'Bank Statement' },
  { value: 'other', label: 'Other', document: '' },
];

/** Printed document name for a stored choice; '' when unknown or empty. */
export function proofDocumentName(
  options: readonly DirectorProofOption[],
  value: string | undefined,
): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  return options.find((o) => o.value === v)?.document ?? '';
}
