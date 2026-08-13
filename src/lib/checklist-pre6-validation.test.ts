import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist-responses';
import {
  fieldIdMatchesPre6Prefix,
  getPre6DirectorSlotsFromPre1,
  getPre6VisibleFields,
  PRE6_DSC_AVAILABILITY_SLOTS_LABEL,
  pre6DirectorHasValidDsc,
  pre6NrFieldPrefix,
  shouldShowPre6DscAvailabilitySlots,
  shouldShowPre6DscExpiryDate,
  validatePre6Responses,
} from '@/lib/checklist-pre6-validation';
import {
  getSectionPendingItems,
  isSectionFieldsComplete,
} from '@/lib/milestone-section-completion';

const pre6Fields = CLIENT_RESPONSE_FIELDS['pre-6'];

describe('Pre-6 Father name field', () => {
  it('registers FatherName after Dob for NR and resident slots', () => {
    for (const id of [
      'nrDirectorFatherName',
      'nrDirector2FatherName',
      'residentDirectorFatherName',
      'residentDirector3FatherName',
    ]) {
      const field = pre6Fields.find((f) => f.id === id);
      expect(field?.label).toBe("Father's name");
      expect(field?.type).toBe('text');
      expect(field?.required).toBe(true);
    }

    const nrIds = pre6Fields
      .filter((f) => fieldIdMatchesPre6Prefix(f.id, 'nrDirector'))
      .map((f) => f.id);
    const dobIdx = nrIds.indexOf('nrDirectorDob');
    const fatherIdx = nrIds.indexOf('nrDirectorFatherName');
    expect(dobIdx).toBeGreaterThanOrEqual(0);
    expect(fatherIdx).toBe(dobIdx + 1);
  });

  it('requires FatherName for visible director slots', () => {
    const pre1 = {
      directorCount: '1',
      director1IndiaResident: 'no',
    };
    const partial = {
      nrDirectorFirstName: 'Jane',
      nrDirectorLastName: 'Doe',
      nrDirectorGender: 'female',
      nrDirectorDob: '1980-02-25',
    };
    const result = validatePre6Responses(partial, pre1);
    expect(result.errors.nrDirectorFatherName).toBe('This field is required.');
  });
});

describe('Pre-6 DSC token fields', () => {
  it('registers HasValidDsc and DscExpiryDate on resident director slots only', () => {
    for (const id of ['nrDirectorHasValidDsc', 'nrDirector2HasValidDsc', 'nrDirectorDscExpiryDate']) {
      expect(pre6Fields.find((f) => f.id === id)).toBeUndefined();
    }

    for (const id of ['residentDirectorHasValidDsc', 'residentDirector2HasValidDsc']) {
      const field = pre6Fields.find((f) => f.id === id);
      expect(field?.label).toBe('Whether Director has Valid Digital Signature Certificate (DSC) Token');
      expect(field?.type).toBe('select');
      expect(field?.options?.map((o) => o.value)).toEqual(['yes', 'no']);
    }
    const expiry = pre6Fields.find((f) => f.id === 'residentDirectorDscExpiryDate');
    expect(expiry?.label).toBe('Digital Signature Certificate (DSC) Token Expiry Date');
    expect(expiry?.type).toBe('date');
    expect(expiry?.showWhen).toEqual({ field: 'residentDirectorHasValidDsc', value: 'yes' });
  });
});

describe('Pre-6 DSC availability slots label', () => {
  it('uses the DSC instruction label on resident director slot field ids', () => {
    for (const id of [
      'nrDirectorDscAvailabilitySlots',
      'nrDirector2DscAvailabilitySlots',
    ]) {
      expect(pre6Fields.find((f) => f.id === id)).toBeUndefined();
    }
    for (const id of [
      'residentDirectorDscAvailabilitySlots',
      'residentDirector3DscAvailabilitySlots',
    ]) {
      const field = pre6Fields.find((f) => f.id === id);
      expect(field?.label).toBe(PRE6_DSC_AVAILABILITY_SLOTS_LABEL);
      expect(field?.placeholder).toContain('10:00');
    }
  });
});

describe('getPre6DirectorSlotsFromPre1', () => {
  it('maps two directors: NR + resident with per-director sections', () => {
    const slots = getPre6DirectorSlotsFromPre1({
      directorCount: '2',
      director1FirstName: 'Jane',
      director1LastName: 'Doe',
      director1IndiaResident: 'no',
      director2FirstName: 'Priya',
      director2LastName: 'Sharma',
      director2IndiaResident: 'yes',
    });
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      pre1DirectorIndex: 1,
      kind: 'non-resident',
      slotIndex: 1,
      prefix: 'nrDirector',
      sectionTitle: 'Director 1 — Non-Resident',
    });
    expect(slots[1]).toMatchObject({
      pre1DirectorIndex: 2,
      kind: 'resident',
      slotIndex: 1,
      prefix: 'residentDirector',
      sectionTitle: 'Director 2 — Resident',
    });
  });

  it('creates second NR slot with nrDirector2 prefix', () => {
    const slots = getPre6DirectorSlotsFromPre1({
      directorCount: '2',
      director1IndiaResident: 'no',
      director2IndiaResident: 'no',
    });
    expect(slots.map((s) => s.prefix)).toEqual(['nrDirector', 'nrDirector2']);
    expect(pre6NrFieldPrefix(2)).toBe('nrDirector2');
  });
});

describe('fieldIdMatchesPre6Prefix', () => {
  it('does not match nrDirector2 fields to nrDirector prefix', () => {
    expect(fieldIdMatchesPre6Prefix('nrDirectorFirstName', 'nrDirector')).toBe(true);
    expect(fieldIdMatchesPre6Prefix('nrDirector2FirstName', 'nrDirector')).toBe(false);
    expect(fieldIdMatchesPre6Prefix('nrDirector2FirstName', 'nrDirector2')).toBe(true);
  });
});

describe('getPre6VisibleFields', () => {
  it('hides resident block when all directors are non-resident', () => {
    const pre1 = {
      directorCount: '2',
      director1IndiaResident: 'no',
      director2IndiaResident: 'no',
    };
    const visible = getPre6VisibleFields(pre6Fields, {}, pre1);
    const sections = [...new Set(visible.map((f) => f.section))];
    expect(sections.some((s) => s?.includes('Resident') && !s.includes('Non-Resident'))).toBe(false);
    expect(sections.filter((s) => s?.includes('Non-Resident'))).toHaveLength(2);
  });

  it('hides NR block when proposed directors are all residents', () => {
    const pre1 = {
      directorCount: '2',
      director1IndiaResident: 'yes',
      director2IndiaResident: 'yes',
    };
    const visible = getPre6VisibleFields(pre6Fields, {}, pre1);
    expect(visible.some((f) => fieldIdMatchesPre6Prefix(f.id, 'nrDirector'))).toBe(false);
    expect(visible.some((f) => fieldIdMatchesPre6Prefix(f.id, 'residentDirector'))).toBe(
      true,
    );
  });

  it('hides DSC availability slots when resident director has valid DSC on Pre-6', () => {
    const pre1 = {
      directorCount: '2',
      director1IndiaResident: 'no',
      director2IndiaResident: 'yes',
    };
    const pre6 = {
      residentDirectorHasValidDsc: 'yes',
      residentDirectorDscExpiryDate: '2027-12-31',
    };
    const visible = getPre6VisibleFields(pre6Fields, pre6, pre1);
    expect(visible.some((f) => f.id === 'nrDirectorHasValidDsc')).toBe(false);
    expect(visible.some((f) => f.id === 'residentDirectorDscAvailabilitySlots')).toBe(false);
    expect(visible.some((f) => f.id === 'residentDirectorDscExpiryDate')).toBe(true);
    expect(pre6DirectorHasValidDsc(pre6, 'residentDirector')).toBe(true);
    expect(shouldShowPre6DscExpiryDate(pre6, 'residentDirector')).toBe(true);
    expect(shouldShowPre6DscAvailabilitySlots(pre6, 'residentDirector')).toBe(false);
  });

  it('shows DSC availability slots when resident director answered No on Pre-6', () => {
    const pre1 = {
      directorCount: '2',
      director1IndiaResident: 'no',
      director2IndiaResident: 'yes',
    };
    const pre6 = {
      residentDirectorHasValidDsc: 'no',
    };
    const visible = getPre6VisibleFields(pre6Fields, pre6, pre1);
    expect(visible.some((f) => f.id === 'nrDirectorDscAvailabilitySlots')).toBe(false);
    expect(visible.some((f) => f.id === 'residentDirectorDscAvailabilitySlots')).toBe(true);
    expect(visible.some((f) => f.id === 'residentDirectorDscExpiryDate')).toBe(false);
  });

  it('hides DSC slots per resident slot when that slot answered Yes on Pre-6', () => {
    const pre1 = {
      directorCount: '2',
      director1IndiaResident: 'yes',
      director2IndiaResident: 'yes',
    };
    const pre6 = {
      residentDirectorHasValidDsc: 'yes',
      residentDirectorDscExpiryDate: '2027-06-01',
      residentDirector2HasValidDsc: 'no',
    };
    const visible = getPre6VisibleFields(pre6Fields, pre6, pre1);
    expect(visible.some((f) => f.id === 'residentDirectorDscAvailabilitySlots')).toBe(false);
    expect(visible.some((f) => f.id === 'residentDirector2DscAvailabilitySlots')).toBe(true);
  });
});

describe('Pre-6 registered office fields', () => {
  const pre1 = {
    directorCount: '1',
    director1IndiaResident: 'no',
  };

  it('registers registered office section on Pre-6', () => {
    const ids = pre6Fields
      .filter((f) => f.section === 'Registered Office Details')
      .map((f) => f.id);
    expect(ids).toEqual([
      'registeredOfficeCompleteAddress',
      'registeredOfficeNocUrl',
      'registeredOfficeUtilityBillType',
      'registeredOfficeUtilityBillNumber',
      'registeredOfficeUtilityBillCopyUrl',
    ]);
    const addressField = pre6Fields.find((f) => f.id === 'registeredOfficeCompleteAddress');
    expect(addressField?.type).toBe('textarea');
  });

  it('requires registered office fields when director slots are visible', () => {
    const result = validatePre6Responses({}, pre1);
    expect(result.errors.registeredOfficeCompleteAddress).toBe('This field is required.');
    expect(result.errors.registeredOfficeNocUrl).toBe('Please upload a document.');
  });
});

describe('validatePre6Responses visible fields only', () => {
  const pre1TwoDirectors = {
    directorCount: '2',
    director1IndiaResident: 'no',
    director2IndiaResident: 'yes',
  };

  function fillNrSlot1(responses: Record<string, string>) {
    const prefix = 'nrDirector';
    return {
      ...responses,
      [`${prefix}FirstName`]: 'Justin',
      [`${prefix}LastName`]: 'Hsu',
      [`${prefix}Gender`]: 'male',
      [`${prefix}Dob`]: '1980-02-25',
      [`${prefix}FatherName`]: 'Robert Hsu',
      [`${prefix}HighestEducationalQualification`]: 'bachelors-degree',
      [`${prefix}OccupationType`]: 'professional',
      [`${prefix}PassportNumber`]: 'P123',
      [`${prefix}PassportCopyUrl`]: 'path/passport.pdf',
      [`${prefix}DrivingLicenceNumber`]: 'DL1',
      [`${prefix}DrivingLicenceCopyUrl`]: 'path/dl.pdf',
      [`${prefix}UtilityBillType`]: 'electricity',
      [`${prefix}UtilityBillNumber`]: 'UB1',
      [`${prefix}UtilityBillAddress`]: 'Texas, USA',
      [`${prefix}UtilityBillCopyUrl`]: 'path/ub.pdf',
      [`${prefix}MobileNumber`]: '+1 555',
      [`${prefix}PersonalMailId`]: 'a@b.com',
      [`${prefix}OfficialMailId`]: 'c@d.com',
      [`${prefix}RecentPhotographUrl`]: 'path/photo.pdf',
      [`${prefix}NotaryApostilleMethod`]: 'self',
      [`${prefix}HasOtherCompanyInterest`]: 'no',
    };
  }

  function fillResidentSlot1(responses: Record<string, string>) {
    const prefix = 'residentDirector';
    return {
      [`${prefix}FirstName`]: 'Priya',
      [`${prefix}LastName`]: 'Sharma',
      [`${prefix}Gender`]: 'female',
      [`${prefix}Dob`]: '1990-06-15',
      [`${prefix}FatherName`]: 'Raj Sharma',
      [`${prefix}HighestEducationalQualification`]: 'bachelors-degree',
      [`${prefix}OccupationType`]: 'private-employment',
      [`${prefix}AadhaarNumber`]: '1234',
      [`${prefix}AadhaarCopyUrl`]: 'path/aadhaar.pdf',
      [`${prefix}PanNumber`]: 'ABCDE1234F',
      [`${prefix}PanCopyUrl`]: 'path/pan.pdf',
      [`${prefix}UtilityBillType`]: 'electricity',
      [`${prefix}UtilityBillNumber`]: 'UB2',
      [`${prefix}UtilityBillAddress`]: 'Bengaluru, India',
      [`${prefix}UtilityBillCopyUrl`]: 'path/ub2.pdf',
      [`${prefix}MobileNumber`]: '+91 98765',
      [`${prefix}PersonalMailId`]: 'p@b.com',
      [`${prefix}OfficialMailId`]: 'p@c.com',
      [`${prefix}RecentPhotographUrl`]: 'path/photo2.pdf',
      [`${prefix}HasValidDsc`]: 'no',
      [`${prefix}DscAvailabilitySlots`]: 'Tue 2pm',
      [`${prefix}HasOtherCompanyInterest`]: 'no',
      shareholderAuthorizedPerson: 'Justin Hsu',
      shareholderNominee: 'Priya Sharma',
      ...responses,
    };
  }

  it('does not require hidden resident fields when only NR directors', () => {
    const pre1 = {
      directorCount: '2',
      director1IndiaResident: 'no',
      director2IndiaResident: 'no',
    };
    const partial = fillNrSlot1({});
    const result = validatePre6Responses(partial, pre1);
    expect(result.errors.residentDirectorFirstName).toBeUndefined();
  });

  it('section completion counts only visible director sections', () => {
    const pre1 = pre1TwoDirectors;
    const visible = getPre6VisibleFields(pre6Fields, {}, pre1);
    const nrSection = visible.filter((f) => f.section === 'Director 1 — Non-Resident');
    const resSection = visible.filter((f) => f.section === 'Director 2 — Resident');
    const filled = fillResidentSlot1(fillNrSlot1({}));
    const errors = validatePre6Responses(filled, pre1).errors;

    expect(isSectionFieldsComplete(nrSection, filled, errors)).toBe(true);
    expect(isSectionFieldsComplete(resSection, filled, errors)).toBe(true);
    expect(getSectionPendingItems(nrSection, {}, errors).length).toBeGreaterThan(0);
  });

  it('does not require DSC availability slots when resident director has valid DSC on Pre-6', () => {
    const pre1 = pre1TwoDirectors;
    const withoutDscSlots: Record<string, string> = fillResidentSlot1(
      fillNrSlot1({
        residentDirectorHasValidDsc: 'yes',
        residentDirectorDscExpiryDate: '2028-01-15',
      }),
    );
    delete withoutDscSlots.residentDirectorDscAvailabilitySlots;

    const result = validatePre6Responses(withoutDscSlots, pre1);
    expect(result.errors.residentDirectorDscAvailabilitySlots).toBeUndefined();
    expect(result.errors.residentDirectorDscExpiryDate).toBeUndefined();

    const visible = getPre6VisibleFields(pre6Fields, withoutDscSlots, pre1);
    const nrSection = visible.filter((f) => f.section === 'Director 1 — Non-Resident');
    const resSection = visible.filter((f) => f.section === 'Director 2 — Resident');
    const filledResidentOnly = { ...withoutDscSlots, residentDirectorDscAvailabilitySlots: 'Tue 2pm' };
    const errors = validatePre6Responses(filledResidentOnly, pre1).errors;
    expect(isSectionFieldsComplete(nrSection, filledResidentOnly, errors)).toBe(true);
    expect(isSectionFieldsComplete(resSection, filledResidentOnly, errors)).toBe(true);
  });

  it('requires DSC expiry when resident director HasValidDsc is Yes', () => {
    const pre1 = { directorCount: '1', director1IndiaResident: 'yes' };
    const partial: Record<string, string> = fillResidentSlot1({
      residentDirectorHasValidDsc: 'yes',
      residentDirectorDscAvailabilitySlots: '',
    });
    delete partial.residentDirectorDscExpiryDate;
    delete partial.residentDirectorDscAvailabilitySlots;
    const result = validatePre6Responses(partial, pre1);
    expect(result.errors.residentDirectorDscExpiryDate).toBe('This field is required.');
  });
});

describe('Pre-6 director name labels', () => {
  it('uses passport-based labels for non-resident directors', () => {
    expect(pre6Fields.find((f) => f.id === 'nrDirectorFirstName')?.label).toBe(
      'First Name (as per Passport)',
    );
    expect(pre6Fields.find((f) => f.id === 'nrDirectorMiddleName')?.label).toBe(
      'Middle Name (as per Passport)',
    );
  });

  it('uses PAN-based labels for resident directors', () => {
    expect(pre6Fields.find((f) => f.id === 'residentDirectorFirstName')?.label).toBe(
      'First Name (as per Permanent Account Number (PAN))',
    );
    expect(pre6Fields.find((f) => f.id === 'residentDirectorMiddleName')?.label).toBe(
      'Middle Name (as per Permanent Account Number (PAN))',
    );
  });
});

describe('Pre-6 notary and apostille (NR only)', () => {
  it('registers NotaryApostilleMethod on NR slots only', () => {
    expect(pre6Fields.find((f) => f.id === 'nrDirectorNotaryApostilleMethod')?.type).toBe(
      'select',
    );
    expect(pre6Fields.find((f) => f.id === 'residentDirectorNotaryApostilleMethod')).toBeUndefined();
  });

  it('requires NotaryApostilleMethod for visible NR directors', () => {
    const pre1 = { directorCount: '1', director1IndiaResident: 'no' };
    const result = validatePre6Responses(
      { nrDirectorFirstName: 'A', nrDirectorLastName: 'B', nrDirectorHasOtherCompanyInterest: 'no' },
      pre1,
    );
    expect(result.errors.nrDirectorNotaryApostilleMethod).toBe('This field is required.');
  });
});

describe('Pre-6 other company interest', () => {
  it('registers interest fields on NR and resident slots', () => {
    for (const id of ['nrDirectorHasOtherCompanyInterest', 'residentDirectorHasOtherCompanyInterest']) {
      const field = pre6Fields.find((f) => f.id === id);
      expect(field?.label).toContain('interest in any other Company or LLP');
    }
  });

  it('shows entry fields only up to selected count', () => {
    const pre1 = { directorCount: '1', director1IndiaResident: 'yes' };
    const pre6 = {
      residentDirectorHasOtherCompanyInterest: 'yes',
      residentDirectorOtherCompanyInterestCount: '2',
    };
    const visible = getPre6VisibleFields(pre6Fields, pre6, pre1);
    expect(visible.some((f) => f.id === 'residentDirectorOtherCompanyInterest1Name')).toBe(true);
    expect(visible.some((f) => f.id === 'residentDirectorOtherCompanyInterest2Name')).toBe(true);
    expect(visible.some((f) => f.id === 'residentDirectorOtherCompanyInterest3Name')).toBe(false);
  });

  it('requires entry details when interest is Yes', () => {
    const pre1 = { directorCount: '1', director1IndiaResident: 'yes' };
    const partial = {
      residentDirectorHasOtherCompanyInterest: 'yes',
      residentDirectorOtherCompanyInterestCount: '1',
    };
    const result = validatePre6Responses(partial, pre1);
    expect(result.errors.residentDirectorOtherCompanyInterest1Name).toBeDefined();
    expect(result.errors.residentDirectorOtherCompanyInterestCount).toBeUndefined();
  });
});
