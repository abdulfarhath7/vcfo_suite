import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '@/data/ask/glossary';
import type { ProjectSnapshot } from '@/data/ask/schema';
import { contextAnswer } from '@/lib/ask/context-answer';
import { firstGlossaryTerm, withGlossary } from '@/lib/ask/glossary-match';
import { isLibraryItemUpdated, toLibraryView, UPDATED_SINCE_SAVED } from '@/lib/ask/library';
import { getTopic } from '@/lib/ask/topics';

const snapshot: ProjectSnapshot = {
  companyName: 'Acme',
  legalForm: 'company',
  residency: 'foreign',
  hasForeignParent: true,
  currentPhase: 'SPICe+ Part A',
  currentStep: { id: 'pre-1', title: 'Client Details', owner: 'client', status: 'waiting on you' },
  completedStepCount: 0,
  totalActiveSteps: 40,
  incorporated: false,
};

describe('glossary terms (F2)', () => {
  it('underlines only the first occurrence of each term per block', () => {
    const segs = withGlossary('Each DIN holder files KYC. A DIN never changes.', GLOSSARY);
    const marked = segs.filter((s) => 'term' in s);
    expect(marked.map((s) => s.text)).toEqual(['DIN']);
    expect(segs.map((s) => s.text).join('')).toBe('Each DIN holder files KYC. A DIN never changes.');
  });

  it('prefers the longer spelling and keeps punctuation-bearing terms intact', () => {
    const marked = withGlossary('Apply for a GSTIN, then file SPICe+ and FC-GPR.', GLOSSARY)
      .filter((s) => 'term' in s)
      .map((s) => s.text);
    expect(marked).toEqual(['GSTIN', 'SPICe+', 'FC-GPR']);
  });

  it('matches acronyms exactly and words in any case', () => {
    expect(withGlossary('the pan of a stove', GLOSSARY).some((s) => 'term' in s)).toBe(false);
    expect(firstGlossaryTerm('Register for professional tax', GLOSSARY)?.term).toBe('Professional Tax');
  });
});

describe('library update badge', () => {
  const topic = getTopic('gst-basics')!;
  const row = {
    id: 'item-1',
    topicSlug: 'gst-basics',
    title: 'GST basics',
    category: 'tax',
    snapshot: { line: 'Old copy', citations: [], actions: [], origin: 'reviewed', depth: 'normal' },
    sourceVersion: topic.version,
    createdAt: new Date('2026-09-01T00:00:00Z'),
  };

  it('is not updated at the saved version', () => {
    expect(isLibraryItemUpdated(row)).toBe(false);
    expect(toLibraryView(row, { current: true, snapshot }).answer.line).toBe('Old copy');
  });

  it('is updated once the topic version moves on, and opens at the current version', () => {
    const stale = { ...row, sourceVersion: topic.version - 1 || 0 };
    expect(isLibraryItemUpdated(stale)).toBe(true);
    const view = toLibraryView(stale, { current: true, snapshot });
    expect(view.updated).toBe(true);
    expect(view.answer.line).toBe(topic.body.normal);
    expect(UPDATED_SINCE_SAVED).toBe('Updated since you saved it');
  });

  it('never marks a saved generated answer as updated', () => {
    expect(isLibraryItemUpdated({ topicSlug: null, sourceVersion: null })).toBe(false);
  });
});

describe('"What\'s this?" (F1)', () => {
  it('on a locked step explains the step and what unlocks it', () => {
    const answer = contextAnswer(
      { kind: 'step', ref: 'pre-13', label: 'Capital Structure' },
      {
        snapshot,
        clientTools: { snapshot, state: {}, filings: [], now: new Date('2026-10-01T00:00:00Z') },
      },
    );
    expect(answer?.topicSlug).toBe('capital-structure');
    expect(answer?.line).toMatch(/This opens after .+ is complete\.$/);
    expect(answer?.target?.stepId).toBe('pre-13');
  });

  it('serves a glossary term without a model call', () => {
    const answer = contextAnswer({ kind: 'field', ref: 'DSC', label: 'DSC' }, { snapshot, clientTools: null });
    expect(answer?.line).toBe(GLOSSARY.find((g) => g.term === 'DSC')!.short);
    expect(answer?.origin).toBe('generated');
    expect(answer?.draft).toBe(true);
  });

  it('falls through to the model for unknown context', () => {
    expect(contextAnswer({ kind: 'compliance', ref: 'GSTR-3B', label: 'GSTR-3B' }, { snapshot, clientTools: null })).toBeNull();
  });
});

