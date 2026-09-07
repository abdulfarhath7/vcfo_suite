/* Functional icon color map: overview = role accent, work = blue,
   approvals/queues = muted gold, people = sky, calendar = teal-green,
   files = teal, knowledge = sky, analytics = sky, audit = neutral. */
export const TONE = {
  home: 'text-role',
  work: 'text-primary',
  queue: 'text-warning',
  people: 'text-info',
  calendar: 'text-success',
  files: 'text-phase-filing-text',
  knowledge: 'text-info',
  news: 'text-accent-violet',
  analytics: 'text-info',
  audit: 'text-text-tertiary',
} as const;
