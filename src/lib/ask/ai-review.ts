/**
 * AI DISCLOSURE AND QUALIFIED REVIEW (docs/specs/ask-vcfo/PRIVACY.md, legal review §3). Pure, so the
 * staff card, the client portal chat and the status route share one wording and one status map.
 *
 * Anthropic's Usage Policy (from 12 November 2026) treats personalised legal or tax advice as a
 * high-risk use: the person must be told AI wrote it, and a qualified professional reviews it. Every
 * model-written answer carries the notice below; a client can send any such answer to their project
 * lead with "Ask my CA to confirm", which reuses the "Ask my lead" task (`createAskHandoff`).
 */

export const AI_NOTICE_LABEL = 'AI-generated';

/** The one sentence under every AI answer. */
export function aiNoticeText(firmName = 'SBC'): string {
  return `Prepared by AI. Your ${firmName} team reviews advice about your own tax or legal position before you act on it.`;
}

/** A model wrote this answer (a reviewed topic, a code answer, a refusal or a work card did not). */
export function isAiAnswer(answer: { origin: string }): boolean {
  return answer.origin === 'generated';
}

export const REVIEW_ACTION_LABEL = 'Ask my CA to confirm';

/** The lead's task: the question as asked and the answer as shown, so the CA reviews exactly that. */
export function reviewRequestBody(question: string | undefined, answer: string): { question: string; context: string } {
  const asked = question?.trim() || 'the question above';
  return {
    question: `Please confirm this Ask VCFO answer before I act on it. My question: ${asked}`.slice(0, 2000),
    context: `Ask VCFO (AI) answered: ${answer.trim()}`.slice(0, 4000),
  };
}

export type ReviewState = 'sent' | 'in_review' | 'reviewed';

/** The task's app status as the client sees it. */
export function reviewStateFromTaskStatus(status: string): ReviewState {
  if (status === 'completed' || status === 'not-applicable') return 'reviewed';
  if (status === 'in-progress' || status === 'awaiting-client') return 'in_review';
  return 'sent';
}

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  sent: 'Sent to your CA. Waiting for review.',
  in_review: 'Your CA is reviewing this answer.',
  reviewed: 'Reviewed by your CA. Their reply comes by email.',
};

/** Only "Ask my lead" tasks are readable here, so a client cannot probe the firm's other tasks. */
export const HANDOFF_TASK_PREFIX = 'Client question';
