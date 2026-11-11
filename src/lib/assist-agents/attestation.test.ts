import { describe, expect, it } from 'vitest';
import { ATTESTABLE_STATES, certifierAllowed, missingAttestationChecks, requiredAttestationChecks } from './attestation';
import { attestationSchema } from './api-schemas';
import { resolveDscSigners } from './dsc-signers';
import { assistExtensionDisabled, assistMinExtensionVersion, assistFirmContactsFromEnv, splitContacts } from './catalog';
import { assistRunPath } from './step-link';

describe('certifier checks (G17)', () => {
  it('every form needs the field check; Part B also needs the office and the subscriber checks', () => {
    expect(requiredAttestationChecks('spice-a')).toEqual(['fieldsCheckedAgainstRecords']);
    expect(requiredAttestationChecks('spice-b')).toEqual(['fieldsCheckedAgainstRecords', 'registeredOffice', 'subscriberSignatures']);
    expect(missingAttestationChecks('spice-b', { fieldsCheckedAgainstRecords: true, registeredOffice: 'owner_noc' })).toEqual(['subscriberSignatures']);
    expect(missingAttestationChecks('spice-a', { fieldsCheckedAgainstRecords: false })).toEqual(['fieldsCheckedAgainstRecords']);
    expect(missingAttestationChecks('spice-a', { fieldsCheckedAgainstRecords: true })).toEqual([]);
  });

  it('is accepted only after the form is filled and before Submit', () => {
    expect(ATTESTABLE_STATES.has('WAIT_SUBMIT_PAY')).toBe(true);
    expect(ATTESTABLE_STATES.has('FILL')).toBe(false);
    expect(ATTESTABLE_STATES.has('READ_SRN')).toBe(false);
  });

  it('the same user may certify by default; the firm setting makes it a different user', () => {
    expect(certifierAllowed({ certifierId: 'u1', filerId: 'u1', mustDiffer: false })).toBe(true);
    expect(certifierAllowed({ certifierId: 'u1', filerId: 'u1', mustDiffer: true })).toBe(false);
    expect(certifierAllowed({ certifierId: 'u2', filerId: 'u1', mustDiffer: true })).toBe(true);
  });

  it('the body never defaults a check to ticked and refuses an unticked field check', () => {
    expect(attestationSchema.safeParse({ checks: {} }).success).toBe(false);
    expect(attestationSchema.safeParse({ checks: { fieldsCheckedAgainstRecords: false } }).success).toBe(false);
    expect(attestationSchema.safeParse({ checks: { fieldsCheckedAgainstRecords: true, registeredOffice: 'maybe' } }).success).toBe(false);
    const ok = attestationSchema.safeParse({ checks: { fieldsCheckedAgainstRecords: true } });
    expect(ok.success && ok.data.evidenceDocumentIds).toEqual([]);
    expect(attestationSchema.safeParse({ checks: { fieldsCheckedAgainstRecords: true }, note: 'call 9876543210' }).success).toBe(false);
    expect(attestationSchema.safeParse({ checks: { fieldsCheckedAgainstRecords: true }, extra: 1 }).success).toBe(false);
  });
});

describe('DSC signer references (evidence log)', () => {
  const profile = {
    directors: [{ id: 'e3', index: 1, firstName: 'Asha', surName: 'Rao' }],
    subscribers: [
      { index: 1, kind: 'individual' as const, isDirector: false, firstName: 'Ravi', surName: 'K' },
      { index: 2, kind: 'bodyCorporate' as const, isDirector: false, name: 'Holdco Ltd', representative: { firstName: 'Meena' } },
    ],
  };

  it('resolves references to names from Suite’s own records', () => {
    expect(resolveDscSigners(profile, ['director:e3', 'subscriber:1', 'subscriber:2', 'professional:self'], { name: 'CA Lead' })).toEqual([
      { ref: 'director:e3', kind: 'director', name: 'Asha Rao' },
      { ref: 'subscriber:1', kind: 'subscriber', name: 'Ravi K' },
      { ref: 'subscriber:2', kind: 'subscriber', name: 'Meena' },
      { ref: 'professional:self', kind: 'professional', name: 'CA Lead' },
    ]);
  });

  it('returns null for a reference that does not resolve', () => {
    expect(resolveDscSigners(profile, ['director:nope'], { name: 'x' })).toBeNull();
    expect(resolveDscSigners(profile, ['professional:other'], { name: 'x' })).toBeNull();
  });
});

describe('kill switch and firm contacts (catalog)', () => {
  it('reads the switch and the version floor from env', () => {
    expect(assistExtensionDisabled({})).toBe(false);
    expect(assistExtensionDisabled({ ASSIST_EXTENSION_DISABLED: 'TRUE' })).toBe(true);
    expect(assistMinExtensionVersion({})).toBeNull();
    expect(assistMinExtensionVersion({ ASSIST_MIN_EXTENSION_VERSION: '0.2.0' })).toBe('0.2.0');
    expect(assistMinExtensionVersion({ ASSIST_MIN_EXTENSION_VERSION: 'latest' })).toBeNull();
  });

  it('splits firm contacts into emails and ten-digit phones', () => {
    expect(assistFirmContactsFromEnv({ ASSIST_FIRM_CONTACTS: 'Desk@SBC.in, +91 98765 43210' })).toEqual({ emails: ['desk@sbc.in'], phones: ['9876543210'] });
    expect(splitContacts([null, '', '12'])).toEqual({ emails: [], phones: [] });
  });
});

describe('Open in Suite (run link)', () => {
  const RUN = '7d1f3c2a-ab12-4c34-8d56-e7f8a9b0c1d2';
  it('lands on the role’s Assist runs page with the run open', () => {
    expect(assistRunPath('intern', RUN)).toBe(`/app/intern/assist-runs?run=${RUN}`);
    expect(assistRunPath('super_admin', RUN)).toBe(`/app/super/assist-runs?run=${RUN}`);
    expect(assistRunPath('client', RUN)).toBeNull();
    expect(assistRunPath('admin', 'not-a-uuid')).toBeNull();
  });
});
