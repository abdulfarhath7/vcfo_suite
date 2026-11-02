import { describe, expect, it } from 'vitest';
import {
  blankNocInput,
  checkNoc,
  coerceNocInput,
  nocAddress,
  nocFileName,
  nocLongDate,
  nocMissingCount,
  nocModel,
  nocPrintHtml,
  pinFitsState,
  runsText,
  type NocInput,
} from './model';

function filled(over: Partial<NocInput> = {}): NocInput {
  return {
    ...blankNocInput('Lotus Dental Private Limited', '2026-10-29'),
    line1: 'Plot 42, 3rd Floor, Cyber Towers',
    line2: 'HITEC City Main Road',
    locality: 'Madhapur',
    city: 'Hyderabad',
    district: 'Rangareddy',
    state: 'Telangana',
    pin: '500081',
    holding: 'rented',
    agreementDate: '2026-10-01',
    billDate: '2026-10-10',
    ownerName: 'Ravi Kumar',
    relationName: 'Suresh Kumar',
    ownerAtPremises: true,
    place: 'Hyderabad',
    ...over,
  };
}

describe('checkNoc', () => {
  it('passes a complete NOC with no warnings', () => {
    const c = checkNoc(filled());
    expect(c.errors).toEqual({});
    expect(c.warnings).toEqual([]);
  });

  it('blocks on the printed fields that are empty', () => {
    const c = checkNoc(blankNocInput('', ''));
    expect(Object.keys(c.errors).sort()).toEqual(
      ['billDate', 'city', 'companyName', 'line1', 'line2', 'nocDate', 'ownerAddress', 'ownerName', 'pin', 'place', 'relationName', 'agreementDate'].sort(),
    );
  });

  it('asks for the agreement date only when the office is rented or leased', () => {
    expect(checkNoc(filled({ agreementDate: '' })).errors.agreementDate).toBe('Date of the rent agreement');
    expect(checkNoc(filled({ holding: 'leased', agreementDate: '' })).errors.agreementDate).toBe('Date of the lease deed');
    expect(checkNoc(filled({ holding: 'director', agreementDate: '' })).errors.agreementDate).toBeUndefined();
  });

  it('checks optional PAN, email and mobile only when typed', () => {
    expect(checkNoc(filled({ ownerPan: 'ABCDE1234F', ownerEmail: 'o@x.in', ownerPhone: '+91 98765 43210' })).errors).toEqual({});
    const bad = checkNoc(filled({ ownerPan: 'ABC123', ownerEmail: 'nope', ownerPhone: '12' })).errors;
    expect(bad.ownerPan).toBeTruthy();
    expect(bad.ownerEmail).toBeTruthy();
    expect(bad.ownerPhone).toBeTruthy();
  });

  it('warns, without blocking, on a bill older than 60 days', () => {
    const c = checkNoc(filled({ billDate: '2026-08-01' }));
    expect(c.errors).toEqual({});
    expect(c.warnings.map((w) => w.title)).toEqual(['The utility bill is 89 days old']);
  });

  it('warns when the bill or the agreement is dated after the NOC', () => {
    const c = checkNoc(filled({ billDate: '2026-11-02', agreementDate: '2026-11-01' }));
    expect(c.errors).toEqual({});
    expect(c.warnings.map((w) => w.title)).toEqual(['The bill is dated after the NOC', 'The agreement is dated after the NOC']);
  });

  it('warns when the PIN is not in the state', () => {
    const c = checkNoc(filled({ state: 'Karnataka' }));
    expect(c.errors).toEqual({});
    expect(c.warnings.map((w) => w.title)).toEqual(['PIN 500081 is not in Karnataka']);
  });
});

describe('pinFitsState', () => {
  it('knows the common circles', () => {
    expect(pinFitsState('Telangana', '500081')).toBe(true);
    expect(pinFitsState('Karnataka', '560103')).toBe(true);
    expect(pinFitsState('Delhi', '110001')).toBe(true);
    expect(pinFitsState('Maharashtra', '400001')).toBe(true);
    expect(pinFitsState('Goa', '403001')).toBe(true);
    expect(pinFitsState('Karnataka', '500081')).toBe(false);
    expect(pinFitsState('Tamil Nadu', '110001')).toBe(false);
  });
  it('never flags an unknown state or a malformed PIN', () => {
    expect(pinFitsState('Atlantis', '500081')).toBe(true);
    expect(pinFitsState('Telangana', '50008')).toBe(true);
  });
});

describe('nocModel', () => {
  it('writes the rented NOC with the agreement date and the ROC of the state', () => {
    const m = nocModel(filled());
    expect(m.roc).toBe('Registrar of Companies, Hyderabad');
    expect(m.date.t).toBe('29th October 2026');
    const all = m.paras.map(runsText).join('\n');
    expect(all).toContain('I, Mr. Ravi Kumar, S/o Suresh Kumar, residing at Plot 42, 3rd Floor, Cyber Towers');
    expect(all).toContain('am the owner and landlord of the premises');
    expect(all).toContain('rent agreement dated 1st October 2026');
    expect(all).toContain('Lotus Dental Private Limited (proposed company)');
    expect(m.encl).toEqual(['Copy of the electricity bill', 'Copy of the rent agreement', "Self-attested copy of the owner's ID proof"]);
  });

  it('marks every missing field as a placeholder', () => {
    const m = nocModel(blankNocInput('', ''));
    expect(m.signName).toEqual({ t: "[owner's name]", miss: true });
    expect(m.paras.flat().filter((r) => r.miss).length).toBeGreaterThan(3);
  });

  it('words the director and rent-free holdings', () => {
    expect(runsText(nocModel(filled({ holding: 'director' })).paras[2]!)).toContain('I am also a proposed director');
    expect(runsText(nocModel(filled({ holding: 'relative' })).paras[2]!)).toContain('free of rent');
    expect(nocModel(filled({ holding: 'relative' })).encl[1]).toBe('Copy of the property ownership document');
  });
});

describe('helpers', () => {
  it('formats the address without repeating the city as the district', () => {
    expect(nocAddress(filled({ district: 'Hyderabad' }))).toBe('Plot 42, 3rd Floor, Cyber Towers, HITEC City Main Road, Madhapur, Hyderabad, Telangana 500081');
  });
  it('names the file after the company', () => {
    expect(nocFileName('Lotus Dental Private Limited')).toBe('NOC-Lotus-Dental-Private-Limited.docx');
    expect(nocFileName('  ')).toBe('NOC-company.docx');
  });
  it('writes ordinals', () => {
    expect(nocLongDate('2026-10-01')).toBe('1st October 2026');
    expect(nocLongDate('2026-10-02')).toBe('2nd October 2026');
    expect(nocLongDate('2026-10-03')).toBe('3rd October 2026');
    expect(nocLongDate('2026-10-11')).toBe('11th October 2026');
    expect(nocLongDate('2026-10-22')).toBe('22nd October 2026');
    expect(nocLongDate('bad')).toBe('');
  });
  it('coerces a stored input and drops what it does not know', () => {
    const c = coerceNocInput({ ...filled(), holding: 'castle', ownerPan: 'abcde1234f', extra: 1 });
    expect(c.holding).toBe('rented');
    expect(c.ownerPan).toBe('ABCDE1234F');
    expect('extra' in c).toBe(false);
  });
  it('counts the printed fields still to fill', () => {
    expect(nocMissingCount(filled())).toBe(0);
    expect(nocMissingCount(filled({ ownerName: '', place: '' }))).toBe(2);
  });
  it('escapes the print view', () => {
    expect(nocPrintHtml(nocModel(filled({ companyName: 'A <b> & Co' })))).toContain('A &lt;b&gt; &amp; Co');
  });
});
