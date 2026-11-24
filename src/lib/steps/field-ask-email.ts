import { getItem } from '@/data/checklist';
import { getClientResponseFields } from '@/lib/checklist/checklist-responses';
import { emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import type { StepFieldStateWord } from '@/lib/steps/field-states';

/**
 * FIELD ASK EMAIL: the client email that follows "Ask client", "Reject" (send back) and "Send
 * reminder" on a staff step page, and the automatic reminders 3 and 7 days after a field was
 * asked. One email per step lists every field still waiting on the client. Pure, so the copy and
 * the reminder days are unit tested; the job (`src/jobs/field-ask-emails.ts`) sends it.
 */

/** Inngest event sent after a field is asked, sent back or reminded. */
export const FIELDS_ASKED_EVENT = 'client/fields.asked';

export type FieldAskKind = 'ask' | 'remind';

export interface FieldAskEventData {
  engagementDbId: string;
  itemId: string;
  kind: FieldAskKind;
}

/** Days after `asked_at` on which the daily job sends an automatic reminder. */
export const FIELD_REMINDER_DAYS: readonly number[] = [3, 7];

/** At most one reminder email per step in this window, whoever or whatever sent it. */
export const FIELD_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const IST_OFFSET_MS = 330 * 60 * 1000;

/** The India calendar day of a moment, as YYYY-MM-DD. */
function istDay(t: number): string {
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole India calendar days between `askedAt` and `now`, or null for a missing or bad time. */
export function istDaysSince(askedAt: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!askedAt) return null;
  const t = typeof askedAt === 'string' ? Date.parse(askedAt) : askedAt.getTime();
  if (Number.isNaN(t)) return null;
  const a = Date.parse(`${istDay(t)}T00:00:00Z`);
  const b = Date.parse(`${istDay(now.getTime())}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** True when the daily job should remind about a field asked at `askedAt` (day 3 or day 7). */
export function isFieldReminderDay(askedAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  const d = istDaysSince(askedAt, now);
  return d !== null && FIELD_REMINDER_DAYS.includes(d);
}

/**
 * The steps due an automatic reminder today: a step is due when at least one of its fields
 * still asked reached day 3 or day 7. Returns unique `engagementDbId` and `itemId` pairs.
 */
export function stepsDueForReminder(
  rows: Array<{ engagementDbId: string; itemId: string; askedAt: string | Date | null }>,
  now: Date = new Date(),
): Array<{ engagementDbId: string; itemId: string }> {
  const seen = new Set<string>();
  const out: Array<{ engagementDbId: string; itemId: string }> = [];
  for (const r of rows) {
    if (!isFieldReminderDay(r.askedAt, now)) continue;
    const key = `${r.engagementDbId}:${r.itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ engagementDbId: r.engagementDbId, itemId: r.itemId });
  }
  return out;
}

/** The on-screen label of one field of a step; falls back to the field id. */
export function fieldLabelFor(itemId: string, fieldId: string): string {
  const item = getItem(itemId);
  if (!item) return fieldId;
  const field = getClientResponseFields(item).find((f) => f.id === fieldId);
  return field?.label?.trim() || fieldId;
}

/** Splits the open fields of a step into those asked and those sent back, as labels. */
export function splitOpenFields(
  itemId: string,
  rows: Array<{ fieldId: string; state: StepFieldStateWord | string }>,
): { asked: string[]; correct: string[] } {
  const asked: string[] = [];
  const correct: string[] = [];
  for (const r of rows) {
    const label = fieldLabelFor(itemId, r.fieldId);
    if (r.state === 'asked') asked.push(label);
    else if (r.state === 'sent_back') correct.push(label);
  }
  return { asked, correct };
}

export interface FieldAskEmailInput {
  kind: FieldAskKind;
  recipientName: string;
  companyName: string;
  stepTitle: string;
  /** Labels of the fields asked and still waiting. */
  asked: string[];
  /** Labels of the fields SBC sent back for a correction. */
  correct: string[];
  /** Absolute link to the client step page. */
  href: string;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function htmlList(items: string[]): string {
  return `<ul style="margin:0 0 16px;padding-left:20px">${items.map((i) => `<li style="margin:0 0 4px">${escapeHtml(i)}</li>`).join('')}</ul>`;
}

/** Subject, HTML and text of one field ask email, in the firm's email layout. */
export function buildFieldAskEmail(input: FieldAskEmailInput): { subject: string; html: string; text: string } {
  const total = input.asked.length + input.correct.length;
  const reminder = input.kind === 'remind';
  const what = `${total} ${plural(total, 'detail', 'details')}`;
  const subject = reminder
    ? `Reminder: ${input.stepTitle} still needs ${what}`
    : `${input.companyName}: SBC needs ${what} for ${input.stepTitle}`;
  const lead = reminder
    ? `This is a reminder that ${input.stepTitle} is still waiting for the details below.`
    : `SBC needs a few details from you to finish ${input.stepTitle} for ${input.companyName}.`;
  const askedHead = 'Please fill in:';
  const correctHead = 'Please correct:';
  const close = 'Open the step, enter the details and save. Your team is told as soon as you do.';

  const bodyHtml =
    emailParagraph(`Hi ${escapeHtml(firstName(input.recipientName))},`) +
    emailParagraph(escapeHtml(lead)) +
    (input.asked.length ? emailParagraph(`<b>${askedHead}</b>`) + htmlList(input.asked) : '') +
    (input.correct.length ? emailParagraph(`<b>${correctHead}</b>`) + htmlList(input.correct) : '') +
    emailParagraph(escapeHtml(close));

  const text = [
    `Hi ${firstName(input.recipientName)},`,
    lead,
    input.asked.length ? `${askedHead}\n${input.asked.map((a) => `- ${a}`).join('\n')}` : '',
    input.correct.length ? `${correctHead}\n${input.correct.map((a) => `- ${a}`).join('\n')}` : '',
    close,
    `Open the step: ${input.href}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    subject,
    html: renderEmailDocument({
      eyebrow: reminder ? 'Reminder' : 'Details needed',
      title: reminder ? `${input.stepTitle} is still waiting` : `Details needed for ${input.stepTitle}`,
      bodyHtml,
      cta: { label: 'Open the step', href: input.href },
    }),
    text,
  };
}

/** The bell line for the client: title and body. */
export function fieldAskBell(input: Pick<FieldAskEmailInput, 'kind' | 'stepTitle' | 'asked' | 'correct'>): { title: string; body: string } {
  const total = input.asked.length + input.correct.length;
  const labels = [...input.correct, ...input.asked];
  const shown = labels.slice(0, 3).join(', ') + (labels.length > 3 ? ` and ${labels.length - 3} more` : '');
  return {
    title: `${input.kind === 'remind' ? 'Reminder: ' : ''}SBC needs ${total} ${plural(total, 'detail', 'details')} for ${input.stepTitle}`,
    body: shown,
  };
}

/** The staff bell when a client answers asked fields on one step. */
export function fieldsAnsweredBell(companyName: string, stepTitle: string, count: number): { title: string; body: string } {
  return {
    title: `${companyName} answered ${count} ${plural(count, 'field', 'fields')} on ${stepTitle}`,
    body: 'Review the answers on the step page.',
  };
}
