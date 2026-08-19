import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from '@/data/checklist';
import { getItem } from '@/data/checklist';
import {
  boardResolutionProgressFromDoc,
  buildClientProgressPhases,
  CLIENT_PROGRESS_PHASE_TITLES,
  derivePreIncStepTone,
  type BoardResolutionProgressSnapshot,
} from '@/lib/client-progress-board';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

const pre1 = getItem('pre-1')!;
const pre3 = getItem('pre-3')!;
const pre6 = getItem('pre-6')!;
const noneBr: BoardResolutionProgressSnapshot = { status: 'none', hasDraftDoc: false };

describe('boardResolutionProgressFromDoc', () => {
  it('maps signed storage to signed status', () => {
    expect(
      boardResolutionProgressFromDoc({
        content: '',
        status: 'finalized',
        signedStoragePath: 'engagements/x/signed.pdf',
      }),
    ).toEqual({ status: 'signed', hasDraftDoc: true });
  });
});

describe('derivePreIncStepTone', () => {
  it('pre-1: not started when empty', () => {
    expect(derivePreIncStepTone('pre-1', pre1, {}, noneBr)).toBe('not-started');
  });

  it('pre-1: in progress when partially filled', () => {
    expect(
      derivePreIncStepTone(
        'pre-1',
        pre1,
        { 'pre-1': { status: 'not-started', responses: { proposedName1: 'ABC India Private Limited' } } },
        noneBr,
      ),
    ).toBe('in-progress');
  });

  it('pre-1: completed when review accepted', () => {
    expect(
      derivePreIncStepTone(
        'pre-1',
        pre1,
        { 'pre-1': { status: 'in-progress', reviewStatus: 'accepted' } },
        noneBr,
      ),
    ).toBe('completed');
  });

  it('pre-1: in progress when rejected', () => {
    expect(
      derivePreIncStepTone(
        'pre-1',
        pre1,
        { 'pre-1': { status: 'awaiting-client', reviewStatus: 'rejected' } },
        noneBr,
      ),
    ).toBe('in-progress');
  });

  it('pre-2: finalized board resolution is completed', () => {
    expect(
      derivePreIncStepTone('pre-2', getItem('pre-2')!, {}, { status: 'finalized', hasDraftDoc: true }),
    ).toBe('completed');
  });

  it('pre-2: draft with doc is in progress', () => {
    expect(
      derivePreIncStepTone('pre-2', getItem('pre-2')!, {}, { status: 'draft', hasDraftDoc: true }),
    ).toBe('in-progress');
  });

  it('pre-2: filled intern fields while slice stays not-started is in progress', () => {
    expect(
      derivePreIncStepTone(
        'pre-2',
        getItem('pre-2')!,
        {
          'pre-2': {
            status: 'not-started',
            responses: {
              boardResolutionDraftGeneratedAt: '2026-05-01',
              boardResolutionSharedAt: '2026-05-02',
            },
          },
        },
        noneBr,
      ),
    ).toBe('in-progress');
  });

  it('pre-2: finalized BR overrides stale not-started slice', () => {
    expect(
      derivePreIncStepTone(
        'pre-2',
        getItem('pre-2')!,
        { 'pre-2': { status: 'not-started' } },
        { status: 'finalized', hasDraftDoc: true },
      ),
    ).toBe('completed');
  });

  it('pre-3: signed upload is completed', () => {
    expect(
      derivePreIncStepTone(
        'pre-3',
        pre3,
        { 'pre-3': { status: 'not-started', responses: { signedBoardResolutionUrl: 'path/signed.pdf' } } },
        { status: 'finalized', hasDraftDoc: true },
      ),
    ).toBe('completed');
  });

  it('pre-3: awaiting upload when draft finalized but no sign', () => {
    expect(
      derivePreIncStepTone('pre-3', pre3, {}, { status: 'finalized', hasDraftDoc: true }),
    ).toBe('in-progress');
  });

  it('pre-6: accepted client submission is completed', () => {
    const slice: ChecklistItemStateSlice = {
      status: 'in-progress',
      reviewStatus: 'accepted',
    };
    expect(derivePreIncStepTone('pre-6', pre6, { 'pre-6': slice }, noneBr)).toBe('completed');
  });
});

describe('buildClientProgressPhases', () => {
  it('returns four phases with forty-six steps total', () => {
    const phases = buildClientProgressPhases({}, noneBr);
    expect(phases).toHaveLength(4);
    expect(phases[0]!.steps).toHaveLength(5);
    expect(phases[1]!.steps).toHaveLength(7);
    expect(phases[2]!.steps).toHaveLength(11);
    expect(phases[3]!.steps).toHaveLength(23);
    expect(phases.reduce((n, p) => n + p.totalCount, 0)).toBe(46);
  });

  it('uses phase titles and checklist step ids', () => {
    const phases = buildClientProgressPhases({}, noneBr);
    expect(phases[0]!.title).toBe(CLIENT_PROGRESS_PHASE_TITLES['pre-inc-phase-1']);
    expect(phases[1]!.title).toBe(CLIENT_PROGRESS_PHASE_TITLES['pre-inc-phase-2']);
    expect(phases[2]!.title).toBe(CLIENT_PROGRESS_PHASE_TITLES['post-inc-phase-3']);
    expect(phases[3]!.title).toBe(CLIENT_PROGRESS_PHASE_TITLES['registration-phase-4']);
    expect(phases[0]!.steps.map((s) => s.itemId)).toEqual([
      'pre-1',
      'pre-2',
      'pre-3',
      'pre-4',
      'pre-5',
    ]);
    expect(phases[2]!.steps.map((s) => s.itemId)).toEqual([
      'post-1',
      'post-9',
      'post-3',
      'post-4',
      'post-5',
      'post-6',
      'post-2',
      'post-7',
      'post-8',
      'post-11',
      'post-10',
    ]);
    expect(phases[3]!.steps.map((s) => s.itemId)).toEqual([
      'reg-4',
      'reg-1',
      'reg-3',
      'reg-7',
      'reg-6',
      'reg-15',
      'reg-16',
      'reg-8',
      'reg-5',
      'reg-11',
      'reg-9',
      'reg-13',
      'reg-14',
      'reg-10',
      'reg-12',
      'reg-17',
      'reg-18',
      'reg-19',
      'reg-20',
      'reg-21',
      'reg-22',
      'reg-23',
      'reg-24',
    ]);
    expect(phases[0]!.steps[0]!.title).toBe('Client Details');
    expect(phases[2]!.steps[0]!.title).toBe('First Board Meeting');
    expect(phases[3]!.steps[0]!.title).toBe('GST Registration');
    expect(phases[3]!.steps.find((s) => s.itemId === 'reg-5')!.title).toBe('LUT Filing');
  });
});
