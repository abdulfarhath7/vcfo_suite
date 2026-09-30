import type { Suggestion } from './schema';

/** Pre-kept questions per shell (T1). Answered without a model call. */
export const SUGGESTIONS: readonly Suggestion[] = [
  // Client
  { id: 'client-next-step', shell: 'client', group: 'About your project', label: 'What is my next step?', handler: { kind: 'nextStep' } },
  { id: 'client-where-now', shell: 'client', group: 'About your project', label: 'Where is my incorporation now?', handler: { kind: 'phaseProgress' } },
  { id: 'client-spice-part-a', shell: 'client', group: 'Learn the basics', label: 'What is SPICe+ Part A?', handler: { kind: 'topic', slug: 'spice-plus-part-a' } },
  { id: 'client-gst', shell: 'client', group: 'Learn the basics', label: 'What is GST, and do we need it?', handler: { kind: 'topic', slug: 'gst-basics' } },
  { id: 'client-after-incorporation', shell: 'client', group: 'Learn the basics', label: 'What happens after incorporation?', handler: { kind: 'topic', slug: 'after-incorporation' } },
  { id: 'client-fc-gpr', shell: 'client', group: 'Learn the basics', label: 'What is FC-GPR?', handler: { kind: 'topic', slug: 'fc-gpr' }, appliesTo: { legalForms: [], residency: ['foreign'] } },
  // Admin
  { id: 'admin-waiting-on-client', shell: 'admin', group: 'Your firm today', label: 'Which projects are waiting on clients?', handler: { kind: 'query', query: 'waitingOnClient' } },
  { id: 'admin-overdue', shell: 'admin', group: 'Your firm today', label: 'What is overdue or due this week?', handler: { kind: 'query', query: 'overdueAndDueSoon' } },
  { id: 'admin-approvals', shell: 'admin', group: 'Your firm today', label: 'What approvals are pending?', handler: { kind: 'query', query: 'pendingApprovals' } },
  { id: 'admin-fc-gpr', shell: 'admin', group: 'Rules and forms', label: 'Explain FC-GPR in simple words', handler: { kind: 'topic', slug: 'fc-gpr' } },
  // Super admin
  { id: 'super-pulse', shell: 'super', group: 'Your firm today', label: 'How is the firm doing this week?', handler: { kind: 'query', query: 'firmPulse' } },
  { id: 'super-at-risk', shell: 'super', group: 'Your firm today', label: 'Which projects are at risk?', handler: { kind: 'query', query: 'atRisk' } },
  { id: 'super-preview', shell: 'super', group: 'Your firm today', label: 'Preview Ask VCFO as a client', handler: { kind: 'previewClient' } },
  { id: 'super-fc-gpr', shell: 'super', group: 'Rules and forms', label: 'Explain FC-GPR in simple words', handler: { kind: 'topic', slug: 'fc-gpr' } },
];
