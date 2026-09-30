import type { AnswerEnvelope, AssistShell } from '@/data/assist/schema';

/** Fixed copy (VCFO-ASSIST-CONTEXT §6.8). Never model-written. */
export const REFUSAL_COPY = {
  offTopicClient:
    'I can only help with your company setup and Indian compliance questions. Is there something about your project I can explain?',
  offTopicStaff:
    'I can help with firm projects, deadlines and Indian compliance rules. That question is outside what I cover.',
  decision:
    "This is a decision for your firm. Here's what it means, and your project lead can confirm what applies to your company.",
  decisionStaff:
    'Assist does not make decisions for the firm. Open the project to decide with the team.',
  unavailable: 'Assist is unavailable right now. Your project lead can help in the meantime.',
  unavailableStaff: 'Assist is unavailable right now.',
  uncertain: "I'm not certain about this one. Your project lead can answer it.",
  greetingClient: 'Hello. Ask me anything about your company setup, or pick a question below.',
  greetingStaff: 'Hello. Ask about firm projects, deadlines or compliance rules, or pick a question below.',
  rateLimited: "You've asked a lot of questions in a short time. Please try again a little later.",
} as const;

function envelope(line: string, shell: AssistShell, extra: Partial<AnswerEnvelope> = {}): AnswerEnvelope {
  return {
    line,
    citations: [],
    actions: shell === 'client' ? ['askLead'] : [],
    origin: 'refusal',
    depth: 'normal',
    ...extra,
  };
}

export function offTopicAnswer(shell: AssistShell): AnswerEnvelope {
  return envelope(shell === 'client' ? REFUSAL_COPY.offTopicClient : REFUSAL_COPY.offTopicStaff, shell, {
    actions: [],
  });
}

export function unavailableAnswer(shell: AssistShell): AnswerEnvelope {
  return envelope(shell === 'client' ? REFUSAL_COPY.unavailable : REFUSAL_COPY.unavailableStaff, shell);
}

export function greetingAnswer(shell: AssistShell): AnswerEnvelope {
  return {
    line: shell === 'client' ? REFUSAL_COPY.greetingClient : REFUSAL_COPY.greetingStaff,
    citations: [],
    actions: [],
    origin: 'deterministic',
    depth: 'normal',
  };
}

/** Safe fallback after validation fails twice (§6.6). */
export function uncertainAnswer(): AnswerEnvelope {
  return {
    line: REFUSAL_COPY.uncertain,
    citations: [],
    actions: ['askLead'],
    origin: 'generated',
    depth: 'normal',
  };
}
