import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist/checklist-responses';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import { PART_B_SECTION, splitMcaSectionHeading } from './part-b-sections';

describe('SB-01 Part B sections follow the MCA form', () => {
  it('splits the MCA number off a heading', () => {
    expect(splitMcaSectionHeading(PART_B_SECTION.equityCapital)).toEqual({ number: '3A(i)', name: 'Equity share capital' });
    expect(splitMcaSectionHeading(PART_B_SECTION.correspondenceAddress)).toEqual({ number: '4A', name: 'Correspondence address' });
    expect(splitMcaSectionHeading(PART_B_SECTION.subscribers)?.number).toBe('5–6');
    expect(splitMcaSectionHeading(PART_B_SECTION.directors)?.number).toBe('7');
    expect(splitMcaSectionHeading('NIC Codes')).toBeNull();
    expect(splitMcaSectionHeading(PART_B_SECTION.agileNominee)).toBeNull();
  });

  it('gives every Part B question a numbered MCA section, in MCA order', () => {
    const sections = ['pre-13', 'pre-14', 'pre-16', 'pre-15'].flatMap((id) =>
      CLIENT_RESPONSE_FIELDS[id].map((f) => f.section),
    );
    const numbered = sections.filter((s) => s && splitMcaSectionHeading(s));
    expect([...new Set(numbered)]).toEqual([
      PART_B_SECTION.equityCapital,
      PART_B_SECTION.preferenceCapital,
      PART_B_SECTION.correspondenceAddress,
      PART_B_SECTION.officeProof,
      PART_B_SECTION.subscribers,
      PART_B_SECTION.directors,
    ]);
  });

  it('keeps the stored answer keys of current projects', () => {
    expect(CLIENT_RESPONSE_FIELDS['pre-13'].map((f) => f.id)).toEqual([
      'equityShares', 'equityQuantity', 'equityNominalValue', 'equityTotal',
      'preferenceShares', 'preferenceQuantity', 'preferenceNominalValue', 'preferenceTotal',
    ]);
    expect(CLIENT_RESPONSE_FIELDS['pre-14'].map((f) => f.id)).toContain('registeredOfficeCompleteAddress');
    const director = CLIENT_RESPONSE_FIELDS['pre-15'][0];
    expect(director.id).toBe('directors');
    expect(director.entryFields?.map((f) => f.id)).toEqual(expect.arrayContaining(['din', 'firstName', 'lastName', 'hasDsc', 'dscExpiryDate']));
    expect(director.entryFields?.slice(0, 2).map((f) => f.id)).toEqual(['hasDin', 'din']);
  });

  it('gives each section a usable tab slug', () => {
    expect(sectionSlug(PART_B_SECTION.equityCapital)).toBe('3a-i-equity-share-capital');
    expect(sectionSlug(PART_B_SECTION.subscribers)).toBe('5-6-first-subscribers-to-the-moa');
  });
});
