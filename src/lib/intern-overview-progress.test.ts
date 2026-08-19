import { describe, expect, it } from 'vitest';
import {
  getActiveCatalogItems,
  getIncorporationPhases,
  getPostIncPhases,
  getPreIncPhases,
  getRegistrationPhases,
} from '@/data/checklist';
import { gateActiveCatalog } from '@/lib/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  internNodeKind,
  internOverviewNow,
  internOverviewPhaseForItem,
  internNextCatalogItemInPhase,
  internFormNextLabel,
  internFormNextTarget,
  internOverviewPhaseTitle,
  internOverviewPhases,
  internPhaseProgressLabel,
  internPhaseProgressPercent,
  internPhaseStepCounts,
  internRegistrationCardItems,
  internRegistrationHeadingForTitle,
  internRegistrationHeadingGroups,
  internEngagementPhaseTabDefault,
  internEngagementPhaseTabStorageKey,
  internOverviewCurrentItemInPhase,
  INTERN_OVERVIEW_PHASE_TAB_IDS,
} from '@/lib/intern-overview-progress';

function completeThrough(itemId: string): Record<string, ChecklistItemStateSlice> {
  const items = getActiveCatalogItems();
  const idx = items.findIndex((item) => item.id === itemId);
  const state: Record<string, ChecklistItemStateSlice> = {};
  for (let i = 0; i < idx; i += 1) {
    const id = items[i]?.id;
    if (id) state[id] = { status: 'completed' };
  }
  return state;
}

describe('intern overview progress', () => {
  it('uses honest phase counts, not a fake overall percent', () => {
    const gates = gateActiveCatalog(completeThrough('pre-6'), 'staff');
    const partA = getPreIncPhases()[0]!;
    const partB = getPreIncPhases()[1]!;
    expect(internPhaseStepCounts(partA.items, gates)).toEqual({ done: 5, total: 5 });
    expect(internPhaseStepCounts(partB.items, gates)).toEqual({ done: 0, total: 7 });
    expect(internPhaseProgressLabel(3, 7)).toBe('3 of 7 complete');
    expect(internPhaseProgressLabel(5, 5)).toBe('5 of 5 complete');
    expect(internPhaseProgressLabel(0, 7)).toBe('0 of 7 complete');
    expect(internPhaseProgressPercent(3, 7)).toBe(43);
    expect(internOverviewPhaseTitle('pre-inc-phase-1', 'Phase 1 — Name Application')).toBe(
      'SPICe+ Part A',
    );
    expect(internOverviewPhaseTitle('pre-inc-phase-2', 'Phase 2 — Incorporation')).toBe(
      'SPICe+ Part B',
    );
    expect(internPhaseProgressPercent(5, 5)).toBe(100);
    expect(internPhaseProgressPercent(0, 7)).toBe(0);
    expect(internNodeKind(partA.items, gates)).toBe('done');
    expect(internNodeKind(partB.items, gates)).toBe('current');
    expect(internNodeKind(getPostIncPhases()[0]!.items, gates)).toBe('locked');
    expect(internOverviewPhaseTitle('post-inc-phase-3', 'Phase 3 — Post-Incorporation')).toBe(
      'Post-incorporation',
    );
    expect(internOverviewPhaseTitle('registration-phase-4', 'Phase 4 — Registration')).toBe(
      'Registration',
    );
    const post = getPostIncPhases()[0]!;
    const registration = getRegistrationPhases()[0]!;
    expect(internPhaseStepCounts(post.items, gates)).toEqual({
      done: 0,
      total: post.items.length,
    });
    expect(internPhaseStepCounts(registration.items, gates)).toEqual({
      done: 0,
      total: registration.items.length,
    });
    expect(internOverviewPhases().map((phase) => phase.items.length)).toEqual([
      5,
      7,
      post.items.length,
      internRegistrationCardItems(registration.items).length,
    ]);
    expect(getIncorporationPhases()).toHaveLength(4);
  });

  it('picks the first not-done step in a phase, else the last', () => {
    const phases = internOverviewPhases();
    const partA = phases[0]!;
    const partB = phases[1]!;
    const post = phases[2]!;
    const emptyGates = gateActiveCatalog({}, 'staff');
    expect(internOverviewCurrentItemInPhase(partA.items, emptyGates)?.id).toBe(partA.items[0]!.id);
    expect(internOverviewCurrentItemInPhase([], emptyGates)).toBeNull();

    const afterPartA = gateActiveCatalog(completeThrough('pre-6'), 'staff');
    expect(internOverviewCurrentItemInPhase(partA.items, afterPartA)?.id).toBe(
      partA.items[partA.items.length - 1]!.id,
    );
    expect(internOverviewCurrentItemInPhase(partB.items, afterPartA)?.id).toBe('pre-6');
    expect(internOverviewCurrentItemInPhase(post.items, afterPartA)?.id).toBe(post.items[0]!.id);

    const midPartB = gateActiveCatalog(completeThrough('pre-8'), 'staff');
    expect(internOverviewCurrentItemInPhase(partB.items, midPartB)?.id).toBe('pre-8');
  });

  it('treats a client-owned current gate as waiting', () => {
    const gates = gateActiveCatalog(completeThrough('pre-6'), 'staff');
    const now = internOverviewNow(gates);
    expect(now).toMatchObject({
      phaseTitle: 'SPICe+ Part B',
      stepNumber: 1,
      stepTotal: 7,
      stepTitle: 'Director KYC',
      waiting: true,
    });
  });

  it('treats an intern-owned current gate as your step', () => {
    const gates = gateActiveCatalog(completeThrough('pre-2'), 'staff');
    const now = internOverviewNow(gates);
    expect(now?.waiting).toBe(false);
    expect(now?.stepTitle).toBe('Draft Board Resolution');
    expect(internOverviewPhaseTitle('pre-inc-phase-1', 'Phase 1 — Name Application')).toBe(
      'SPICe+ Part A',
    );
  });

  it('groups intern Registration rows under category headings', () => {
    const registration = internRegistrationCardItems(getRegistrationPhases()[0]!.items);
    const groups = internRegistrationHeadingGroups(registration);
    const titles = (heading: string) =>
      groups.find((group) => group.heading === heading)?.items.map((item) => item.title) ?? [];

    expect(internRegistrationHeadingForTitle('GST & LUT')).toBe('Registrations');
    expect(internRegistrationHeadingForTitle('LUT Filing')).toBe('Customs');
    expect(internRegistrationHeadingForTitle('FC-GPR Filing')).toBe('FEMA');
    expect(internRegistrationHeadingForTitle('FCGPR Filing')).toBe('FEMA');

    expect(groups.map((group) => group.heading)).toEqual([
      'Registrations',
      'Customs',
      'Foreign Trade',
      'Labour',
      'Local Compliance',
      'IP/Brand',
    ]);
    expect(titles('Registrations')).toEqual([
      'GST & LUT',
      'EPF Registration',
      'ESI Registration',
      'LEI Registration',
      'Professional Tax',
      'MSME Registration',
    ]);
    expect(titles('FEMA')).toEqual([]);
    expect(titles('Customs')).toEqual(['IEC Registration', 'LUT Filing']);
    expect(titles('Foreign Trade')).toEqual(['Non-STPI Registration']);
    expect(titles('Labour')).toEqual([
      'CLRA Registration',
      'POSH / SHE Box',
      'Shops & Establishment',
    ]);
    expect(titles('Local Compliance')).toEqual(['Trade License']);
    expect(titles('IP/Brand')).toEqual(['Trademark Registration']);
    expect(registration).toHaveLength(getRegistrationPhases()[0]!.items.length);
  });

  it('nests FEMA-bucket items under FEMA inside Registration grouping', () => {
    const groups = internRegistrationHeadingGroups([
      ...getRegistrationPhases()[0]!.items,
      {
        id: 'fema-test',
        slug: 'fcgpr-filing',
        bucket: 'fema',
        order: 1,
        title: 'FCGPR Filing',
        forms: [],
        infoRequired: [],
        deadline: { kind: 'no-statutory-limit' },
      },
    ]);
    expect(groups.map((group) => group.heading)).toContain('FEMA');
    expect(groups.find((group) => group.heading === 'FEMA')?.items.map((item) => item.title)).toEqual(
      ['FCGPR Filing'],
    );
  });
});

describe('internOverviewPhaseForItem', () => {
  it('scopes Part A vs Part B vs Post vs Registration (not the whole pre-inc bucket)', () => {
    const phases = internOverviewPhases();
    expect(phases.map((phase) => phase.id)).toEqual([
      'pre-inc-phase-1',
      'pre-inc-phase-2',
      'post-inc-phase-3',
      'registration-phase-4',
    ]);
    expect(internOverviewPhaseForItem('pre-1')?.id).toBe('pre-inc-phase-1');
    expect(internOverviewPhaseForItem('pre-5')?.id).toBe('pre-inc-phase-1');
    expect(internOverviewPhaseForItem('pre-6')?.id).toBe('pre-inc-phase-2');
    expect(internOverviewPhaseForItem('pre-12')?.id).toBe('pre-inc-phase-2');
    expect(internOverviewPhaseForItem('post-1')?.id).toBe('post-inc-phase-3');
    expect(internOverviewPhaseForItem('reg-1')?.id).toBe('registration-phase-4');
    expect(internOverviewPhaseForItem('pre-1')?.items.map((item) => item.id)).toEqual(
      getPreIncPhases()[0]!.items.map((item) => item.id),
    );
    expect(internOverviewPhaseForItem('pre-6')?.items.map((item) => item.id)).toEqual(
      getPreIncPhases()[1]!.items.map((item) => item.id),
    );
    expect(internOverviewPhaseForItem('pre-1')?.items.some((item) => item.id === 'pre-6')).toBe(
      false,
    );
    expect(internNextCatalogItemInPhase('pre-1')?.id).toBe('pre-2');
    expect(internNextCatalogItemInPhase('pre-5')?.id).toBeUndefined();
    expect(internNextCatalogItemInPhase('pre-12')?.id).toBeUndefined();
  });

  it('keys the last intern overview tab per engagement id', () => {
    expect(INTERN_OVERVIEW_PHASE_TAB_IDS).toEqual([
      'pre-inc-phase-1',
      'pre-inc-phase-2',
      'post-inc-phase-3',
      'registration-phase-4',
    ]);
    expect(internEngagementPhaseTabStorageKey('pexpo-inc')).toBe(
      'vcfo.intern.engagementPhaseTab.pexpo-inc',
    );
    expect(internEngagementPhaseTabStorageKey('other-co')).toBe(
      'vcfo.intern.engagementPhaseTab.other-co',
    );
    expect(internEngagementPhaseTabStorageKey('pexpo-inc')).not.toBe(
      internEngagementPhaseTabStorageKey('other-co'),
    );
  });

  it('prefers the stored intern overview tab, else the current phase, else the first tab', () => {
    const ids = INTERN_OVERVIEW_PHASE_TAB_IDS;
    expect(internEngagementPhaseTabDefault('post-inc-phase-3', 'pre-inc-phase-2', ids)).toBe(
      'post-inc-phase-3',
    );
    expect(internEngagementPhaseTabDefault(null, 'pre-inc-phase-2', ids)).toBe('pre-inc-phase-2');
    expect(internEngagementPhaseTabDefault('', 'registration-phase-4', ids)).toBe(
      'registration-phase-4',
    );
    expect(internEngagementPhaseTabDefault('not-a-phase', 'pre-inc-phase-2', ids)).toBe(
      'pre-inc-phase-2',
    );
    expect(internEngagementPhaseTabDefault(null, 'unknown', ids)).toBe('pre-inc-phase-1');
    expect(internEngagementPhaseTabDefault(null, null, ids)).toBe('pre-inc-phase-1');
  });

  it('advances intern Next through headings, then the same phase, then Done', () => {
    expect(internFormNextTarget('pre-1', 0, 10)).toEqual({ kind: 'section', index: 1 });
    expect(internFormNextLabel(internFormNextTarget('pre-1', 0, 10))).toBe('Next');
    const lastClientDetails = internFormNextTarget('pre-1', 9, 10);
    expect(lastClientDetails.kind).toBe('step');
    if (lastClientDetails.kind === 'step') expect(lastClientDetails.item.id).toBe('pre-2');
    expect(internFormNextLabel(lastClientDetails)).toBe('Next');
    expect(internFormNextTarget('pre-5', 0, 1)).toEqual({ kind: 'engagement' });
    expect(internFormNextLabel(internFormNextTarget('pre-5', 0, 0))).toBe('Done');
    expect(internFormNextTarget('pre-12', 2, 3)).toEqual({ kind: 'engagement' });
  });
});
