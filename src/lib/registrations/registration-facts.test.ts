import { describe, expect, it } from 'vitest';
import {
  REGISTRATION_ANSWER_FIELDS,
  buildRegistrationFacts,
  isoOfText,
  renewalOf,
  rowKeyForStep,
} from '@/lib/registrations/registration-facts';

describe('rowKeyForStep', () => {
  it('maps a step to its credentials row by title, and others to step:<id>', () => {
    expect(rowKeyForStep('reg-4')).toBe('gst');
    expect(rowKeyForStep('reg-5')).toBe('lut');
    expect(rowKeyForStep('reg-16')).toBe('icegate');
    expect(rowKeyForStep('reg-22')).toBe('step:reg-22');
    expect(rowKeyForStep('pre-1')).toBeNull();
  });
});

describe('isoOfText', () => {
  it('reads the three date styles and refuses nonsense', () => {
    expect(isoOfText('2026-10-12')).toBe('2026-10-12');
    expect(isoOfText('12 Oct 2026')).toBe('2026-10-12');
    expect(isoOfText('12/10/2026')).toBe('2026-10-12');
    expect(isoOfText('31/02/2026')).toBeNull();
    expect(isoOfText('soon')).toBeNull();
    expect(isoOfText('')).toBeNull();
  });
});

describe('buildRegistrationFacts', () => {
  it('reads numbers, dates and the certificate from the step answers', () => {
    const { facts, certificates } = buildRegistrationFacts({
      state: {
        'reg-4': {
          status: 'completed',
          responses: { gstinNumber: '29ABCDE1234F1Z5', gstRegistrationDate: '2026-08-01', gstCertificateUrl: 'e1/gstCertificateUrl/1712-gst cert.pdf', lutArn: 'AD290826000123' },
        } as never,
      },
      stored: {},
      documents: [],
    });
    expect(facts['reg-4']).toMatchObject({ number: '29ABCDE1234F1Z5', registeredOn: '2026-08-01', certificate: { name: 'gst cert.pdf', downloadable: true } });
    expect(certificates['reg-4']).toEqual({ kind: 'step', path: 'e1/gstCertificateUrl/1712-gst cert.pdf', name: 'gst cert.pdf' });
    // LUT answered on the GST step.
    expect(facts['reg-5']!.number).toBe('AD290826000123');
    expect(facts['reg-1']!.number).toBeNull();
  });

  it('lets a typed workbook value win and reads the renewal fields', () => {
    const { facts } = buildRegistrationFacts({
      state: { 'reg-1': { status: 'completed', responses: { pfRegistrationNumber: 'KNBNG0012345000' } } as never },
      stored: { pf: { number: 'KNBNG0099999000', date: '3 Sep 2026', issuedOn: '2026-09-03', renewEveryMonths: '12' } },
      documents: [],
    });
    expect(facts['reg-1']).toMatchObject({
      number: 'KNBNG0099999000',
      registeredOn: '2026-09-03',
      issuedOn: '2026-09-03',
      renewEveryMonths: 12,
      expiresOn: '2027-09-03',
    });
  });

  it('keeps a stored expiry over the computed one, and reads the LEI expiry answer', () => {
    const { facts } = buildRegistrationFacts({
      state: { 'reg-6': { status: 'completed', responses: { leiNumber: '335800ABCDEFGHIJ1234', leiExpiryDate: '2027-05-01' } } as never },
      stored: { pf: { issuedOn: '2026-01-31', renewEveryMonths: '1', expiresOn: '2026-03-15' } },
      documents: [],
    });
    expect(facts['reg-6']!.expiresOn).toBe('2027-05-01');
    expect(facts['reg-1']!.expiresOn).toBe('2026-03-15');
  });

  it('falls back to a document filed on the step, then to the typed certificate name', () => {
    const { facts, certificates } = buildRegistrationFacts({
      state: {},
      stored: { iec: { cert: 'IEC.pdf' } },
      documents: [{ stepId: 'reg-1', fileName: 'PF certificate.pdf', objectKey: 'engagement-documents/e1/pf.pdf', createdAt: new Date() }],
    });
    expect(facts['reg-1']!.certificate).toEqual({ name: 'PF certificate.pdf', downloadable: true });
    expect(certificates['reg-1']!.kind).toBe('document');
    expect(facts['reg-8']!.certificate).toEqual({ name: 'IEC.pdf', downloadable: false });
    expect(certificates['reg-8']).toBeUndefined();
  });

  it('never reads a web link as a downloadable certificate', () => {
    const { facts } = buildRegistrationFacts({
      state: { 'reg-8': { status: 'completed', responses: { iecCertificateUrl: 'https://example.com/x.pdf' } } as never },
      stored: {},
      documents: [],
    });
    expect(facts['reg-8']!.certificate).toBeNull();
  });

  it('lists the answer fields the slim read keeps', () => {
    expect(REGISTRATION_ANSWER_FIELDS).toContain('gstinNumber');
    expect(REGISTRATION_ANSWER_FIELDS).toContain('leiExpiryDate');
    expect(REGISTRATION_ANSWER_FIELDS).not.toContain('panNumber');
  });
});

describe('renewalOf', () => {
  const now = new Date(2026, 9, 29);
  it('is Due soon within 30 days, Overdue after expiry, quiet otherwise', () => {
    expect(renewalOf({ expiresOn: '2026-11-28' }, now)).toEqual({ renewBy: '2026-11-28', days: 30, word: 'Due soon' });
    expect(renewalOf({ expiresOn: '2026-10-29' }, now)!.word).toBe('Due soon');
    expect(renewalOf({ expiresOn: '2026-10-28' }, now)).toEqual({ renewBy: '2026-10-28', days: -1, word: 'Overdue' });
    expect(renewalOf({ expiresOn: '2026-11-29' }, now)!.word).toBeNull();
    expect(renewalOf({ expiresOn: null }, now)).toBeNull();
  });
});
