import { getReviewStatus } from '@/lib/checklist/checklist-item-review';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { siteUrl } from '@/lib/site-url';

/**
 * STAFF ALERTS (P-627, S-655, S-656): an email when an approval starts waiting (to the
 * engagement's managers with "Approvals waiting" on) and when an escalation opens (to admins
 * and super admins with "Escalations" on). The switches are `notification_prefs.email
 * .approvalsWaiting` and `.escalations`; never saved counts as on, as the Profile shows.
 *
 * Rule 6: email is the system of record. The request is queued onto Inngest after the write
 * that caused it, fire-and-forget, so a queue failure never slows or fails the write. The job
 * (`src/jobs/staff-alerts.ts`) waits out each recipient's quiet hours, then sends.
 */

export const STAFF_ALERT_EVENT = 'staff/alert.requested';

export type StaffAlertRequest =
  | { kind: 'approval'; engagementDbId: string; stepIds: string[] }
  | { kind: 'escalation'; engagementDbId: string; escalationId: string; assignedTo: string | null; reason: string };

export type StaffAlertKey = 'approvalsWaiting' | 'escalations';

/** The person's switch for one alert; a switch never saved counts as on. */
export function staffAlertOn(email: Record<string, unknown> | null | undefined, key: StaffAlertKey): boolean {
  const v = email?.[key];
  return typeof v === 'boolean' ? v : true;
}

/** The steps whose review turned to "reviewing" in this save (not those already waiting). */
export function newlyAwaitingReview(
  previous: Record<string, unknown> | null | undefined,
  changes: Array<{ stepId: string; reviewStatus?: string | null }>,
): string[] {
  const before = previous ?? {};
  return changes
    .filter((c) => c.reviewStatus === 'reviewing')
    .filter((c) => getReviewStatus(before[c.stepId] as ChecklistItemStateSlice | undefined) !== 'reviewing')
    .map((c) => c.stepId);
}

/** Queue one alert. Never throws: the write that caused it has already succeeded. */
export async function queueStaffAlert(request: StaffAlertRequest): Promise<void> {
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: STAFF_ALERT_EVENT, data: request as unknown as Record<string, unknown> });
  } catch (err) {
    console.error('[staff-alerts] queue failed', request.kind, err);
  }
}

export interface StaffAlertEmailInput {
  kind: 'approval' | 'escalation';
  recipientName: string;
  companyName: string;
  /** Approval: the step titles now waiting. Escalation: unused. */
  stepTitles?: string[];
  /** Escalation: the reason the raiser wrote. */
  reason?: string;
  /** Path inside the app, for example "/app/manager/approvals". */
  href: string;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/** Subject, HTML and text of one alert email, in the firm's email layout. */
export function buildStaffAlertEmail(input: StaffAlertEmailInput): { subject: string; html: string; text: string } {
  const link = `${siteUrl()}${input.href}`;
  const steps = input.stepTitles ?? [];
  const subject =
    input.kind === 'approval'
      ? `${input.companyName}: ${steps.length === 1 ? `${steps[0]} is` : `${steps.length} steps are`} waiting for your approval`
      : `Escalation opened: ${input.companyName}`;
  const lead =
    input.kind === 'approval'
      ? `${steps.length === 1 ? 'A step is' : `${steps.length} steps are`} waiting for your approval on ${input.companyName}.`
      : `An escalation was opened on ${input.companyName}.`;
  const detail = input.kind === 'approval' ? steps.join(', ') : (input.reason ?? '').slice(0, 400);
  const action = input.kind === 'approval' ? 'Open approvals' : 'Open escalations';
  const off = input.kind === 'approval' ? 'Approvals waiting' : 'Escalations';
  return {
    subject,
    html: renderEmailDocument({
      eyebrow: input.kind === 'approval' ? 'Approval waiting' : 'Escalation',
      title: input.kind === 'approval' ? 'Waiting for your approval' : 'Escalation opened',
      bodyHtml:
        emailParagraph(`Hi ${escapeHtml(firstName(input.recipientName))},`) +
        emailParagraph(escapeHtml(lead)) +
        (detail ? emailParagraph(`<b>${escapeHtml(detail)}</b>`) : ''),
      cta: { label: action, href: link },
      footerNote: `You get this email because "${off}" is on in your Profile notifications.`,
    }),
    text: [`Hi ${firstName(input.recipientName)},`, lead, detail, `${action}: ${link}`, `You get this email because "${off}" is on in your Profile notifications.`]
      .filter(Boolean)
      .join('\n\n'),
  };
}
