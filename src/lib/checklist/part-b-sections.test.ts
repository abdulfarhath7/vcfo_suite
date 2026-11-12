import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist/checklist-responses';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import { getPreIncPhases } from '@/data/checklist';
import {
  PART_B_SECTION,
  orderByMcaSection,
  partBStepDisplayLabel,
  partBStepMcaSection,
  splitMcaSectionHeading,
} from './part-b-sections';

describe('SB-01 Part B sections follow the MCA form', () => {
  it('splits the MCA number off a heading', () => {
    expect(splitMcaSectionHeading(PART_B_SECTION.equityCapital)).toEqual({ number: '3A(i)', name: 'Equity share capital' });
    expect(splitMcaSectionHeading(PART_B_SECTION.correspondenceAddress)).toEqual({ number: '4A', name: 'Correspondence Address' });
    expect(splitMcaSectionHeading(PART_B_SECTION.subscribers)?.number).toBe('5–6');
    expect(splitMcaSectionHeading(PART_B_SECTION.directors)?.number).toBe('7');
    expect(splitMcaSectionHeading('NIC Codes')).toBeNull();
    expect(splitMcaSectionHeading(PART_B_SECTION.agileNominee)).toBeNull();
  });

  it('gives every Part B question a numbered MCA section, in MCA order', () => {
    // The Part B steps as people see them: the checklist order, sorted by the display helper.
    const partBSteps = getPreIncPhases()[1]!.items.filter((item) => partBStepMcaSection(item.id));
    const shown = orderByMcaSection(partBSteps, (item) => item.id).map((item) => item.id);
    expect(shown).toEqual(['pre-13', 'pre-14', 'pre-16', 'pre-15']);
    const sections = shown.flatMap((id) => CLIENT_RESPONSE_FIELDS[id].map((f) => f.section));
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
    expect(sectionSlug(PART_B_SECTION.subscribers)).toBe('5-6-first-subscriber-s-to-moa');
  });
});

describe('SB-01 orderByMcaSection (display order only)', () => {
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it('puts Subscriber details (MCA 5–6) before Proposed directors (MCA 7) and keeps every other step in place', () => {
    const rows = ['pre-13', 'pre-14', 'pre-15', 'pre-16', 'pre-7', 'pre-9'].map((id) => ({ id }));
    expect(ids(orderByMcaSection(rows, (r) => r.id))).toEqual(['pre-13', 'pre-14', 'pre-16', 'pre-15', 'pre-7', 'pre-9']);
  });

  it('re-sorts Part B steps only among the places they hold', () => {
    const rows = ['pre-1', 'pre-15', 'post-1', 'pre-16', 'pre-2'].map((id) => ({ id }));
    expect(ids(orderByMcaSection(rows, (r) => r.id))).toEqual(['pre-1', 'pre-16', 'post-1', 'pre-15', 'pre-2']);
  });

  it('does not change the input and leaves lists without Part B steps alone', () => {
    const rows = ['pre-15', 'pre-16'].map((id) => ({ id }));
    const copy = orderByMcaSection(rows, (r) => r.id);
    expect(ids(rows)).toEqual(['pre-15', 'pre-16']);
    expect(copy).not.toBe(rows);
    const other = ['post-2', 'post-1'].map((id) => ({ id }));
    expect(ids(orderByMcaSection(other, (r) => r.id))).toEqual(['post-2', 'post-1']);
  });

  it('keeps the checklist (gating) order unchanged', () => {
    expect(getPreIncPhases()[1]!.itemIds.slice(0, 4)).toEqual(['pre-13', 'pre-14', 'pre-15', 'pre-16']);
  });

  it('labels a Part B step with its MCA section and leaves other steps on their fallback', () => {
    expect(partBStepMcaSection('pre-16')).toBe('5–6');
    expect(partBStepDisplayLabel('pre-13', 'Step 6')).toBe('MCA 3A');
    expect(partBStepDisplayLabel('pre-14', 'Step 7')).toBe('MCA 4');
    expect(partBStepDisplayLabel('pre-16', 'Step 9')).toBe('MCA 5–6');
    expect(partBStepDisplayLabel('pre-15', 'Step 8')).toBe('MCA 7');
    expect(partBStepDisplayLabel('pre-7', 'Step 10')).toBe('Step 10');
    expect(partBStepDisplayLabel('pre-7')).toBeUndefined();
  });
});
