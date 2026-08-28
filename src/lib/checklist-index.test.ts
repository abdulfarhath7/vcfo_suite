import { describe, expect, it } from 'vitest';
import {
  checklistStateHasResponses,
  mergeChecklistIndexIntoState,
  slimChecklistIndexState,
} from '@/lib/checklist-index';

describe('slimChecklistIndexState', () => {
  it('drops notes and non-trigger response fields', () => {
    const slim = slimChecklistIndexState({
      'pre-1': {
        status: 'completed',
        notes: 'huge intern memo',
        reviewStatus: 'accepted',
        responses: {
          companyName: 'DemoCo',
          dateOfIncorporation: '2026-01-15',
        },
      },
    });
    expect(slim['pre-1']?.status).toBe('completed');
    expect(slim['pre-1']?.reviewStatus).toBe('accepted');
    expect(slim['pre-1']?.notes).toBeUndefined();
    expect(slim['pre-1']?.responses).toEqual({ dateOfIncorporation: '2026-01-15' });
  });
});

describe('mergeChecklistIndexIntoState', () => {
  it('fills empty local state from the index', () => {
    const slim = { 'pre-1': { status: 'in-progress' as const } };
    const next = mergeChecklistIndexIntoState({}, { e1: slim });
    expect(next.e1).toBe(slim);
  });

  it('does not overwrite a full checklist that already has answers', () => {
    const full = {
      'pre-1': { status: 'completed' as const, responses: { companyName: 'DemoCo' } },
    };
    const slim = { 'pre-1': { status: 'in-progress' as const } };
    const next = mergeChecklistIndexIntoState({ e1: full }, { e1: slim });
    expect(next.e1).toBe(full);
  });

  it('returns the previous map when slim payloads are equivalent', () => {
    const prev = { e1: { 'pre-1': { status: 'in-progress' as const } } };
    const next = { e1: { 'pre-1': { status: 'in-progress' as const } } };
    expect(mergeChecklistIndexIntoState(prev, next)).toBe(prev);
  });
});

describe('checklistStateHasResponses', () => {
  it('is false for status-only slices', () => {
    expect(checklistStateHasResponses({ 'pre-1': { status: 'not-started' } })).toBe(false);
  });
});
