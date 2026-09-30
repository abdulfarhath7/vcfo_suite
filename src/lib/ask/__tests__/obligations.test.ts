import { describe, expect, it, vi } from 'vitest';
import type { ProjectSnapshot } from '@/data/ask/schema';

/**
 * C5: the obligation topics ship as drafts, so publish one here to prove the
 * reviewed path — and that a draft never serves penalty text.
 */
vi.mock('@/data/ask/topics', async (orig) => {
  const mod = await orig<typeof import('@/data/ask/topics')>();
  return {
    RAW_TOPICS: mod.RAW_TOPICS.map((t) =>
      (t as { slug: string }).slug === 'obligation-gst-gstr-3b'
        ? { ...(t as object), status: 'published', reviewedBy: 'Partner', reviewedAt: '2026-09-30' }
        : t,
    ),
  };
});

const { contextAnswer, obligationTopicSlug } = await import('@/lib/ask/context-answer');
const { getTopic, listTopics } = await import('@/lib/ask/topics');

const snapshot: ProjectSnapshot = {
  companyName: 'Acme',
  legalForm: 'company',
  residency: 'foreign',
  hasForeignParent: true,
  currentPhase: 'Compliance',
  currentStep: null,
  completedStepCount: 40,
  totalActiveSteps: 40,
  incorporated: true,
};
const ask = (ref: string, C5: boolean) =>
  contextAnswer({ kind: 'compliance', ref, label: ref }, { snapshot, clientTools: null, features: { C5 } });

describe('C5 what if I miss it', () => {
  it('serves a reviewed obligation topic with the consequence, no model', () => {
    const answer = ask('gst-gstr-3b', true);
    expect(answer?.origin).toBe('reviewed');
    expect(answer?.topicSlug).toBe(obligationTopicSlug('gst-gstr-3b'));
    const facts = answer?.visual?.type === 'keyFacts' ? answer.visual.facts.map((f) => f.k) : [];
    expect(facts).toEqual(['What it is', 'Who files it', 'If it is missed']);
  });

  it('never serves penalty text from a draft topic', () => {
    expect(getTopic('obligation-gst-gstr-1')?.status).toBe('draft');
    expect(ask('gst-gstr-1', true)).toBeNull();
  });

  it('does nothing while the flag is off', () => {
    expect(ask('gst-gstr-3b', false)).toBeNull();
  });

  it('every obligation topic has the three facts and no calendar date', () => {
    const obligations = listTopics().filter((t) => t.slug.startsWith('obligation-'));
    expect(obligations.length).toBeGreaterThanOrEqual(7);
    for (const t of obligations) {
      expect(t.visual?.type, t.slug).toBe('keyFacts');
      expect(JSON.stringify(t), t.slug).not.toMatch(/\b\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/);
    }
  });
});
