import { getActiveCatalogItems } from '@/data/checklist';
import { RAW_TOPICS } from '@/data/ask/topics';
import {
  topicSchema,
  type AnswerDepth,
  type AnswerEnvelope,
  type AnswerAction,
  type AppliesTo,
  type AskShell,
  type FlowVisual,
  type LegalForm,
  type ProjectSnapshot,
  type Residency,
  type Topic,
  type Visual,
} from '@/data/ask/schema';

export type TopicLoadError = { index: number; slug: string | null; message: string };

/** Parse topic files; invalid ones are reported, never served. */
export function parseTopics(raw: readonly unknown[]): { topics: Topic[]; errors: TopicLoadError[] } {
  const topics: Topic[] = [];
  const errors: TopicLoadError[] = [];
  raw.forEach((entry, index) => {
    const parsed = topicSchema.safeParse(entry);
    if (parsed.success) {
      topics.push(parsed.data);
      return;
    }
    const slug =
      entry && typeof entry === 'object' && typeof (entry as { slug?: unknown }).slug === 'string'
        ? (entry as { slug: string }).slug
        : null;
    errors.push({ index, slug, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  });
  return { topics, errors };
}

let cache: { topics: Topic[]; bySlug: Map<string, Topic>; errors: TopicLoadError[] } | null = null;

function load() {
  if (cache) return cache;
  const { topics, errors } = parseTopics(RAW_TOPICS);
  if (errors.length > 0) {
    console.warn('[ask-vcfo] invalid topic files skipped', errors);
  }
  cache = { topics, bySlug: new Map(topics.map((t) => [t.slug, t])), errors };
  return cache;
}

export function listTopics(): readonly Topic[] {
  return load().topics;
}

export function getTopic(slug: string): Topic | null {
  return load().bySlug.get(slug) ?? null;
}

export function topicLoadErrors(): readonly TopicLoadError[] {
  return load().errors;
}

// ---------- Applicability ----------

export type ApplicabilityContext = { legalForm: LegalForm; residency: Residency };

/** Empty lists mean "all". A missing context (staff, no project) sees everything. */
export function appliesTo(rule: AppliesTo | undefined, ctx: ApplicabilityContext | null): boolean {
  if (!rule || !ctx) return true;
  if (rule.legalForms.length > 0 && !rule.legalForms.includes(ctx.legalForm)) return false;
  if (rule.residency.length > 0 && !rule.residency.includes(ctx.residency)) return false;
  return true;
}

export function applicabilityFromSnapshot(snapshot: ProjectSnapshot | null): ApplicabilityContext | null {
  return snapshot ? { legalForm: snapshot.legalForm, residency: snapshot.residency } : null;
}

/**
 * The topic this viewer should read for `slug`: follows `alternateFor`
 * (an LLP asking about SPICe+ gets FiLLiP), then drops topics that do not
 * apply to the viewer's company.
 */
export function resolveTopicForViewer(
  slug: string,
  ctx: ApplicabilityContext | null,
  audience: 'client' | 'staff',
): Topic | null {
  let topic = getTopic(slug);
  if (!topic) return null;
  if (ctx && topic.alternateFor) {
    const alt = topic.alternateFor.find((a) => (a.legalForms as string[]).includes(ctx.legalForm));
    if (alt) topic = getTopic(alt.slug);
    if (!topic) return null;
  }
  if (topic.audience !== 'both' && topic.audience !== audience) return null;
  if (!appliesTo(topic.appliesTo, ctx)) return null;
  return topic;
}

/** Topics that explain a checklist step (F1 "What's this?"). */
export function topicsForStep(stepId: string): Topic[] {
  return listTopics().filter((t) => t.stepIds?.includes(stepId));
}

export function isReviewed(topic: Topic): boolean {
  return topic.status === 'published';
}

// ---------- Depth ----------

export function topicTextForDepth(topic: Topic, depth: AnswerDepth): string {
  return topic.body[depth];
}

// ---------- Flow state from snapshot ----------

function catalogIndex(): Map<string, number> {
  return new Map(getActiveCatalogItems().map((item, index) => [item.id, index]));
}

/**
 * Recompute "done / here / next" for a flow from the viewer's own project so
 * "You are here" is always true for them. Stages without step ids follow the
 * stage before them. Without a snapshot (staff) nobody is "here".
 */
export function flowStateFromSnapshot(visual: FlowVisual, snapshot: ProjectSnapshot | null): FlowVisual {
  const hasStepRefs = visual.stages.some((s) => s.stepIds && s.stepIds.length > 0);
  if (!hasStepRefs) return stripStepIds(visual);
  if (!snapshot) {
    return {
      type: 'flow',
      stages: visual.stages.map(({ stepIds: _ignored, ...s }) => ({ ...s, state: s.state === 'here' ? 'next' : s.state })),
    };
  }
  const index = catalogIndex();
  const current = snapshot.currentStep ? index.get(snapshot.currentStep.id) : undefined;
  const allDone = snapshot.currentStep === null;
  let previousDone = true;
  const stages = visual.stages.map(({ stepIds, ...stage }) => {
    let state: FlowVisual['stages'][number]['state'];
    if (stepIds && stepIds.length > 0) {
      const positions = stepIds.map((id) => index.get(id)).filter((n): n is number => n !== undefined);
      if (allDone || (current !== undefined && positions.every((p) => p < current))) state = 'done';
      else if (snapshot.currentStep && stepIds.includes(snapshot.currentStep.id)) state = 'here';
      else state = 'next';
    } else {
      state = previousDone ? 'done' : 'next';
    }
    previousDone = state === 'done';
    return { ...stage, state };
  });
  return { type: 'flow', stages };
}

function stripStepIds(visual: FlowVisual): FlowVisual {
  return { type: 'flow', stages: visual.stages.map(({ stepIds: _ignored, ...s }) => s) };
}

function visualForViewer(visual: Visual | undefined, snapshot: ProjectSnapshot | null): Visual | undefined {
  if (!visual) return undefined;
  if (visual.type === 'flow') return flowStateFromSnapshot(visual, snapshot);
  return visual;
}

// ---------- Topic → answer ----------

/**
 * A topic rendered as an answer, no model call. Only a published topic is
 * `reviewed`; a draft is served as `generated` with `draft: true` so it never
 * carries the "Reviewed" badge.
 */
export function topicToAnswer(
  topic: Topic,
  opts: { depth?: AnswerDepth; shell: AskShell; snapshot: ProjectSnapshot | null },
): AnswerEnvelope {
  const depth = opts.depth ?? 'normal';
  const client = opts.shell === 'client';
  const actions: AnswerAction[] = [];
  if (client) actions.push('save');
  if (depth !== 'simple') actions.push('simpler');
  if (depth !== 'detail') actions.push('detail');
  actions.push('expand');
  if (client) actions.push('askLead');
  const reviewed = isReviewed(topic);
  return {
    title: topic.title,
    line: topicTextForDepth(topic, depth),
    why: topic.body.why,
    visual: visualForViewer(topic.visual, opts.snapshot),
    citations: topic.citations.map((c) => ({ id: c.id, label: c.label, ...(c.url ? { url: c.url } : {}) })),
    related: topic.related.slice(0, 2),
    actions,
    origin: reviewed ? 'reviewed' : 'generated',
    depth,
    topicSlug: topic.slug,
    topicVersion: topic.version,
    ...(client && topic.stepIds?.[0]
      ? { links: [{ dest: { to: 'incorporation' as const, focusStepId: topic.stepIds[0] }, label: 'Open Incorporation' }] }
      : {}),
    ...(reviewed ? {} : { draft: true }),
  };
}

// ---------- Coverage ----------

/** Client-owned active catalog steps with no topic yet (corpus work list). */
export function clientStepsMissingTopics(topics: readonly Topic[] = listTopics()): string[] {
  const covered = new Set(topics.flatMap((t) => t.stepIds ?? []));
  return getActiveCatalogItems()
    .filter((item) => item.responsibleRole === 'client')
    .map((item) => item.id)
    .filter((id) => !covered.has(id));
}
