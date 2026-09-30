import type { AnswerEnvelope, ProjectSnapshot } from '@/data/assist/schema';
import { findGlossaryTerm } from '@/lib/assist/glossary';
import { stepExplainerContext, type ClientToolContext } from '@/lib/assist/tools/client';
import {
  applicabilityFromSnapshot,
  resolveTopicForViewer,
  topicsForStep,
  topicToAnswer,
} from '@/lib/assist/topics';

export type AssistContextRef = { kind: 'step' | 'field' | 'compliance'; ref: string; label: string };

/**
 * "What's this?" (F1): answer from reviewed content without a model when a
 * topic or glossary term covers the context. A locked step always says what
 * unlocks it, using the gate's own copy. Returns null when the model must
 * answer (the pipeline then asks about `label`).
 */
export function contextAnswer(
  context: AssistContextRef,
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
      };
    }
    return null;
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
