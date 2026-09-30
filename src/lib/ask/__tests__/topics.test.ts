import { describe, expect, it } from 'vitest';
import { checklist, getActiveCatalogItems } from '@/data/checklist';
import { RAW_TOPICS } from '@/data/ask/topics';
import { GLOSSARY } from '@/data/ask/glossary';
import { SUGGESTIONS } from '@/data/ask/suggestions';
import {
  glossaryTermSchema,
  suggestionSchema,
  topicSchema,
  TOPIC_BODY_LIMITS,
  type ProjectSnapshot,
} from '@/data/ask/schema';
import {
  appliesTo,
  clientStepsMissingTopics,
  flowStateFromSnapshot,
  getTopic,
  listTopics,
  parseTopics,
  resolveTopicForViewer,
  topicLoadErrors,
  topicToAnswer,
} from '@/lib/ask/topics';

const activeIds = new Set(getActiveCatalogItems().map((i) => i.id));

function snapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    companyName: 'Acme India Private Limited',
    legalForm: 'company',
    residency: 'foreign',
    hasForeignParent: true,
    currentPhase: 'SPICe+ Part B',
    currentStep: { id: 'pre-14', title: 'Registered Office Address', owner: 'client', status: 'active' },
    completedStepCount: 6,
    totalActiveSteps: 40,
    incorporated: false,
    ...overrides,
  };
}

describe('topic files (§3.2 rules)', () => {
  it('every topic file parses', () => {
    expect(topicLoadErrors()).toEqual([]);
    expect(listTopics()).toHaveLength(RAW_TOPICS.length);
  });

  it('slugs are unique', () => {
    const slugs = listTopics().map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every published topic has reviewer, date and a citation', () => {
    for (const t of listTopics().filter((t) => t.status === 'published')) {
      expect(t.reviewedBy, t.slug).toBeTruthy();
      expect(t.reviewedAt, t.slug).toBeTruthy();
      expect(t.citations.length, t.slug).toBeGreaterThan(0);
    }
  });

  it('rejects a published topic without reviewer', () => {
    const [first] = RAW_TOPICS as Record<string, unknown>[];
    const parsed = topicSchema.safeParse({ ...first, status: 'published' });
    expect(parsed.success).toBe(false);
  });

  it('every stepIds entry is in the active catalog (reg-2 and other legacy rows excluded)', () => {
    for (const t of listTopics()) {
      for (const id of t.stepIds ?? []) expect(activeIds.has(id), `${t.slug} → ${id}`).toBe(true);
      if (t.visual?.type === 'flow') {
        for (const stage of t.visual.stages) {
          for (const id of stage.stepIds ?? []) expect(activeIds.has(id), `${t.slug} flow → ${id}`).toBe(true);
        }
      }
      if (t.visual?.type === 'nextStep') expect(activeIds.has(t.visual.stepId)).toBe(true);
    }
    expect(checklist.some((i) => i.id === 'reg-2')).toBe(true);
    expect(activeIds.has('reg-2')).toBe(false);
  });

  it('every related and alternate slug exists', () => {
    for (const t of listTopics()) {
      for (const slug of t.related) expect(getTopic(slug), `${t.slug} related ${slug}`).not.toBeNull();
      for (const alt of t.alternateFor ?? []) expect(getTopic(alt.slug), `${t.slug} alt ${alt.slug}`).not.toBeNull();
    }
  });

  it('body lengths stay within limits', () => {
    for (const t of listTopics()) {
      expect(t.body.normal.length, t.slug).toBeLessThanOrEqual(TOPIC_BODY_LIMITS.normal);
      expect(t.body.simple.length, t.slug).toBeLessThanOrEqual(TOPIC_BODY_LIMITS.simple);
    }
  });

  it('every client-owned active step has at least one topic', () => {
    expect(clientStepsMissingTopics()).toEqual([]);
  });

  it('reports client-owned steps a corpus does not cover', () => {
    const { topics } = parseTopics(RAW_TOPICS.filter((t) => (t as { slug: string }).slug !== 'subscribers'));
    expect(clientStepsMissingTopics(topics)).toEqual(['pre-16']);
  });
});

describe('suggestions and glossary', () => {
  it('parse and point at existing topics', () => {
    for (const s of SUGGESTIONS) {
      expect(suggestionSchema.safeParse(s).success, s.id).toBe(true);
      if (s.handler.kind === 'topic') expect(getTopic(s.handler.slug), s.id).not.toBeNull();
    }
    for (const g of GLOSSARY) {
      expect(glossaryTermSchema.safeParse(g).success, g.term).toBe(true);
      if (g.topicSlug) expect(getTopic(g.topicSlug), g.term).not.toBeNull();
    }
  });

  it('suggestion ids are unique', () => {
    const ids = SUGGESTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('applicability and alternates', () => {
  it('empty lists apply to everyone; no context sees everything', () => {
    expect(appliesTo({ legalForms: [], residency: [] }, { legalForm: 'llp', residency: 'domestic' })).toBe(true);
    expect(appliesTo({ legalForms: ['company'], residency: [] }, null)).toBe(true);
    expect(appliesTo({ legalForms: ['company'], residency: [] }, { legalForm: 'llp', residency: 'foreign' })).toBe(false);
    expect(appliesTo({ legalForms: [], residency: ['foreign'] }, { legalForm: 'company', residency: 'domestic' })).toBe(false);
  });

  it('an LLP asking about SPICe+ gets the FiLLiP topic', () => {
    const topic = resolveTopicForViewer('spice-plus-part-a', { legalForm: 'llp', residency: 'domestic' }, 'client');
    expect(topic?.slug).toBe('fillip-llp-incorporation');
  });

  it('a company keeps SPICe+', () => {
    const topic = resolveTopicForViewer('spice-plus-part-a', { legalForm: 'company', residency: 'foreign' }, 'client');
    expect(topic?.slug).toBe('spice-plus-part-a');
  });

  it('a domestic client does not get FC-GPR', () => {
    expect(resolveTopicForViewer('fc-gpr', { legalForm: 'company', residency: 'domestic' }, 'client')).toBeNull();
  });

  it('client-only topics are not served to staff', () => {
    expect(resolveTopicForViewer('director-kyc', null, 'staff')).toBeNull();
    expect(resolveTopicForViewer('fc-gpr', null, 'staff')?.slug).toBe('fc-gpr');
  });
});

describe('depth and answers', () => {
  it('serves the requested depth and never badges a draft as reviewed', () => {
    const topic = getTopic('gst-basics')!;
    const simple = topicToAnswer(topic, { depth: 'simple', shell: 'client', snapshot: snapshot() });
    expect(simple.line).toBe(topic.body.simple);
    expect(simple.origin).toBe('generated');
    expect(simple.draft).toBe(true);
    expect(simple.actions).not.toContain('simpler');
    expect(simple.actions).toContain('askLead');
    const published = topicToAnswer(
      { ...topic, status: 'published', reviewedBy: 'Partner', reviewedAt: '2026-09-30' },
      { shell: 'admin', snapshot: null },
    );
    expect(published.origin).toBe('reviewed');
    expect(published.draft).toBeUndefined();
    expect(published.actions).not.toContain('save');
  });
});

describe('flow state from snapshot', () => {
  const flow = getTopic('spice-plus-part-a')!.visual;
  if (flow?.type !== 'flow') throw new Error('expected flow');

  it('marks Part A done and Part B here while in Part B', () => {
    const out = flowStateFromSnapshot(flow, snapshot());
    expect(out.stages.map((s) => s.state)).toEqual(['done', 'here', 'next']);
    expect(out.stages.every((s) => !('stepIds' in s))).toBe(true);
  });

  it('marks Part A here at the start', () => {
    const out = flowStateFromSnapshot(
      flow,
      snapshot({ currentStep: { id: 'pre-1', title: 'Client Details', owner: 'client', status: 'active' } }),
    );
    expect(out.stages.map((s) => s.state)).toEqual(['here', 'next', 'next']);
  });

  it('marks everything done once past Part B', () => {
    const out = flowStateFromSnapshot(
      flow,
      snapshot({ incorporated: true, currentStep: { id: 'post-3', title: 'Bank Account Opening', owner: 'lead', status: 'active' } }),
    );
    expect(out.stages.map((s) => s.state)).toEqual(['done', 'done', 'done']);
  });

  it('nobody is "here" without a snapshot', () => {
    const out = flowStateFromSnapshot(flow, null);
    expect(out.stages.some((s) => s.state === 'here')).toBe(false);
  });
});
