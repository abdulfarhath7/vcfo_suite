import type { AnswerEnvelope, ProjectSnapshot } from '@/data/ask/schema';
import { documentTopicSlug } from '@/data/ask/documents';
import { findGlossaryTerm } from '@/lib/ask/glossary';
import { stepExplainerContext, type ClientToolContext } from '@/lib/ask/tools/client';
import {
  applicabilityFromSnapshot,
  resolveTopicForViewer,
  topicsForStep,
  topicToAnswer,
} from '@/lib/ask/topics';

export type AskContextRef = { kind: 'step' | 'field' | 'compliance' | 'document'; ref: string; label: string };

/**
 * "What's this?" (F1): answer from reviewed content without a model when a
 * topic or glossary term covers the context. A locked step always says what
 * unlocks it, using the gate's own copy. Returns null when the model must
 * answer (the pipeline then asks about `label`).
 */
export function contextAnswer(
  context: AskContextRef,
  opts: { snapshot: ProjectSnapshot | null; clientTools: ClientToolContext | null },
): AnswerEnvelope | null {
  const applicability = applicabilityFromSnapshot(opts.snapshot);

  if (context.kind === 'step') {
    const step = opts.clientTools ? stepExplainerContext(opts.clientTools, context.ref) : null;
    const unlock = step && 'locked' in step && step.locked && step.unlocks ? step.unlocks : null;
    const topic = topicsForStep(context.ref)
      .map((t) => resolveTopicForViewer(t.slug, applicability, 'client'))
      .find(Boolean);
    if (topic) {
      const answer = topicToAnswer(topic, { shell: 'client', snapshot: opts.snapshot });
      return {
        ...answer,
        line: unlock ? `${answer.line} ${unlock}` : answer.line,
        actions: [...answer.actions, 'openStep'],
        target: { stepId: context.ref },
        links: [{ dest: { to: 'step', stepId: context.ref }, label: 'Open this step', primary: true }],
      };
    }
    if (step && 'title' in step) {
      const description = step.description?.trim();
      return {
        title: step.title,
        line: [
          description || `${step.title} is a step your ${step.owner === 'client' ? 'team completes' : 'project lead handles'}.`,
          unlock,
        ]
          .filter(Boolean)
          .join(' '),
        citations: [{ id: 'getStepExplainerContext', label: 'Your project checklist' }],
        actions: ['openStep', 'askLead'],
        origin: 'deterministic',
        depth: 'normal',
        target: { stepId: step.stepId },
        links: [{ dest: { to: 'step', stepId: step.stepId }, label: 'Open this step', primary: true }],
      };
    }
    return null;
  }

  if (context.kind === 'document') {
    // C2: the document TYPE picks a topic. Contents are never read, and this
    // path never reaches the model — an unmapped type hands off to the lead.
    const slug = documentTopicSlug(context.ref);
    const topic = slug ? resolveTopicForViewer(slug, applicability, 'client') : null;
    if (topic) return topicToAnswer(topic, { shell: 'client', snapshot: opts.snapshot });
    return {
      title: context.label,
      line: 'Your project lead can explain this document and what to do with it.',
      citations: [],
      actions: ['askLead'],
      origin: 'deterministic',
      depth: 'normal',
    };
  }

  const term = findGlossaryTerm(context.ref) ?? findGlossaryTerm(context.label);
  if (term?.topicSlug) {
    const topic = resolveTopicForViewer(term.topicSlug, applicability, 'client');
    if (topic) return topicToAnswer(topic, { shell: 'client', snapshot: opts.snapshot });
  }
  if (term) {
    return {
      title: term.term,
      line: term.short,
      citations: [],
      actions: ['save', 'askLead'],
      origin: 'generated',
      draft: true,
      depth: 'normal',
    };
  }
  return null;
}
