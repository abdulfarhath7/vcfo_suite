import type { AnswerEnvelope } from '@/data/assist/schema';

/** Reminder draft for the waiting-on-client answer: opens compose, never sends. */
export function reminderComposeHref(base: string, answer: AnswerEnvelope): string {
  const row = answer.visual?.type === 'projectRows' ? answer.visual.rows[0] : undefined;
  const subject = row ? `Reminder: ${row.step} for ${row.name}` : 'Reminder: action needed on your project';
  const body = row
    ? `Hello,\n\nA quick reminder that "${row.step}" for ${row.name} is waiting on you. Please complete it in the client portal when you can.\n\nThank you.`
    : 'Hello,\n\nA quick reminder that a step on your project is waiting on you.\n\nThank you.';
  // Super admin has no mail page of its own; it may use the firm admin one.
  const mailBase = base === '/app/super' ? '/app/admin' : base;
  return `${mailBase}/mail?${new URLSearchParams({ subject, body })}`;
}
