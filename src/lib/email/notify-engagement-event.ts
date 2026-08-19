import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { sendMailViaOutlook } from '@/db/repositories/outlook-connections';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import type { EngagementParty, EngagementRecipients } from '@/db/repositories/engagement-recipients';
import {
  emptyEmailDispatch,
  pushEmailSubject,
  type EmailDispatchResult,
  type OutgoingEmailDraft,
} from '@/lib/email/email-dispatch';
import {
  approvalCcEmails,
  collectAdminParties,
  collectLeadParties,
  collectManagerParties,
  emailsStaffViaResend,
  inAppIncludesActor,
  opensClientOutgoingDraft,
  staffEmailTargetsForEvent,
  type EngagementProcessEvent,
} from '@/lib/email/engagement-event-fanout';
import { buildDocumentRequestEmail, buildProgressEmail, type ProgressEmailKind } from '@/lib/email/progress-emails';
import {
  companyFromAddress,
  formatReplyTo,
  sendResendEmail,
  type SendResendResult,
} from '@/lib/email/send-resend';
import type { NotificationKind } from '@/lib/checklist-notifications';
import {
  adminProjectStepPath,
  clientBoardResolutionPath,
  internBoardResolutionPath,
  internEngagementStepPath,
} from '@/lib/project-step-path';
import { siteUrl } from '@/lib/site-url';

export type { EmailDispatchResult, EngagementProcessEvent };

type NotifyInput = {
  engagementId: string;
  itemId: string;
  event: EngagementProcessEvent;
  note?: string | null;
  /** Optional label for document requests (overrides step title in body). */
  requestLabel?: string;
  /** Actor userId — skip notifying the person who triggered the action (except deliver / BR share). */
  actorUserId?: string;
  /** Re-open compose without inserting another in-app row. */
  skipInAppNotifications?: boolean;
  /** In-app Received rows only — no Graph compose / Resend (Update client portal). */
  inAppOnly?: boolean;
  /** When set, lead→manager approval tries Graph from this staff mailbox first. */
  outlookCtx?: AuthContext;
};

function stepTitle(itemId: string): string {
  return getItem(itemId)?.title ?? itemId;
}

function emailKind(event: EngagementProcessEvent): ProgressEmailKind | null {
  switch (event) {
    case 'client_submitted':
      return 'client_submitted';
    case 'client_uploaded':
      return 'client_uploaded';
    case 'lead_requested_review':
      return 'lead_requested_review';
    case 'review_accepted':
      return 'review_accepted';
    case 'review_rejected':
      return 'review_rejected';
    case 'delivered':
      return 'delivered';
    case 'unlocked':
      return 'unlocked';
    case 'docs_shared':
      return 'docs_shared';
    case 'board_resolution_shared':
      return 'board_resolution_shared';
    case 'request_created':
      return null;
  }
}

function notificationKind(event: EngagementProcessEvent): NotificationKind {
  switch (event) {
    case 'client_submitted':
      return 'checklist.submit';
    case 'client_uploaded':
      return 'request.uploaded';
    case 'lead_requested_review':
      return 'checklist.submit';
    case 'review_accepted':
    case 'review_rejected':
      return 'checklist.review';
    case 'delivered':
      return 'checklist.deliver';
    case 'unlocked':
      return 'checklist.unlock';
    case 'docs_shared':
      return 'docs.share';
    case 'board_resolution_shared':
      return 'checklist.deliver';
    case 'request_created':
      return 'request.created';
  }
}

function absolute(path: string): string {
  if (path.startsWith('http')) return path;
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function findPartyByUserId(
  recipients: EngagementRecipients,
  userId?: string,
): EngagementParty | null {
  if (!userId) return null;
  if (recipients.lead?.userId === userId) return recipients.lead;
  const fromLeads = recipients.leads.find((l) => l.userId === userId);
  if (fromLeads) return fromLeads;
  if (recipients.manager?.userId === userId) return recipients.manager;
  const fromManagers = recipients.managers.find((m) => m.userId === userId);
  if (fromManagers) return fromManagers;
  const fromAdmins = recipients.admins.find((a) => a.userId === userId);
  if (fromAdmins) return fromAdmins;
  if (recipients.client?.userId === userId) return recipients.client;
  return recipients.clients.find((c) => c.userId === userId) ?? null;
}

function isClientParty(recipients: EngagementRecipients, party: EngagementParty | null): boolean {
  if (!party) return false;
  if (recipients.client?.userId === party.userId) return true;
  return recipients.clients.some((c) => c.userId === party.userId);
}

/** Reply-To for mail sent to staff (client submitted, intern request-approval). */
function replyToForStaff(
  recipients: EngagementRecipients,
  event: EngagementProcessEvent,
  actorUserId?: string,
): string | undefined {
  const actor = findPartyByUserId(recipients, actorUserId);
  if (event === 'lead_requested_review') {
    if (actor && !isClientParty(recipients, actor)) return formatReplyTo(actor);
    return formatReplyTo(recipients.lead ?? recipients.leads[0] ?? null);
  }
  if (actor && isClientParty(recipients, actor)) return formatReplyTo(actor);
  return formatReplyTo(recipients.client ?? recipients.clients[0] ?? null);
}

/** Client → lead From: company@verified-domain for Outlook filters. */
function fromForCompany(recipients: EngagementRecipients): string | undefined {
  return companyFromAddress({
    companyName: recipients.companyName,
  });
}

function clientParties(recipients: EngagementRecipients) {
  if (recipients.clients.length > 0) return recipients.clients;
  return recipients.client ? [recipients.client] : [];
}

function buildOutgoingClientDraft(
  input: NotifyInput,
  recipients: EngagementRecipients,
  company: string,
  title: string,
  clientHref: string,
): OutgoingEmailDraft | undefined {
  const parties = clientParties(recipients);
  const to = parties.map((p) => p.email).filter(Boolean);
  if (to.length === 0) return undefined;

  const href = absolute(clientHref);
  const progressKind = emailKind(input.event);
  const copy =
    input.event === 'request_created'
      ? buildDocumentRequestEmail({
          companyName: company,
          title,
          note: input.note,
          portalHref: href,
        })
      : progressKind
        ? buildProgressEmail({
            kind: progressKind,
            companyName: company,
            itemId: input.itemId,
            note: input.note,
            portalHref: href,
            audience: 'client',
            title: input.requestLabel,
          })
        : null;
  if (!copy) return undefined;

  const actor = findPartyByUserId(recipients, input.actorUserId);
  const cc =
    input.event === 'review_accepted'
      ? approvalCcEmails(recipients, {
          excludeEmails: actor?.email ? [actor.email] : [],
        })
      : [];
  return {
    to,
    ...(cc.length > 0 ? { cc } : {}),
    subject: copy.subject,
    html: copy.html,
    text: copy.text,
    engagementId: recipients.appId,
    companyName: company,
    itemId: input.itemId,
  };
}

function recordSend(
  out: EmailDispatchResult,
  to: string,
  result: SendResendResult,
  subject?: string,
) {
  out.attempted += 1;
  // Always report the intended staff/client recipient — not a test redirect address.
  const addr = (result.intendedTo?.[0] ?? to).trim();
  if (!addr) return;
  if (result.ok) {
    out.sent.push(addr);
    pushEmailSubject(out, subject);
  } else if (result.skipped) {
    out.skipped.push(addr);
    pushEmailSubject(out, subject);
  } else {
    out.failed.push(addr);
    pushEmailSubject(out, subject);
    if (result.error && result.error !== 'email_not_configured') {
      out.error = out.error ?? result.error;
    }
  }
}

/**
 * Fan-out process emails + in-app notifications for client / lead / manager.
 * Never throws — failures are logged so mutations stay successful.
 * Returns a dispatch summary for API → toast wiring.
 */
export async function notifyEngagementEvent(input: NotifyInput): Promise<EmailDispatchResult> {
  const email = emptyEmailDispatch();

  try {
    const recipients = await resolveEngagementRecipients(input.engagementId);
    if (!recipients) {
      console.warn('[notify] engagement not found', input.engagementId);
      return email;
    }

    const project = {
      id: recipients.appId,
      slug: recipients.slug,
    };
    const title = input.requestLabel?.trim() || stepTitle(input.itemId);
    const company = recipients.companyName;
    const kind = notificationKind(input.event);
    const clientHref =
      input.event === 'board_resolution_shared'
        ? clientBoardResolutionPath()
        : '/app/client/incorporation';
    const leadHref =
      input.event === 'board_resolution_shared'
        ? internBoardResolutionPath(project)
        : internEngagementStepPath(project, input.itemId);
    const managerHref = adminProjectStepPath(project, input.itemId, 'manager');

    const notifDrafts: Array<
      Parameters<typeof createNotificationsForUsers>[0][number]
    > = [];

    const pushNotif = (
      userId: string | undefined,
      role: 'client' | 'intern' | 'manager',
      nTitle: string,
      body: string,
    ) => {
      if (!userId) return;
      if (userId === input.actorUserId && !inAppIncludesActor(input.event)) return;
      const href =
        role === 'client' ? clientHref : role === 'intern' ? leadHref : managerHref;
      notifDrafts.push({
        userId,
        kind,
        title: nTitle,
        body,
        engagementId: recipients.appId,
        companyName: company,
        itemId: input.itemId,
        href,
      });
    };

    const pushNotifToClients = (nTitle: string, body: string) => {
      for (const c of recipients.clients) {
        pushNotif(c.userId, 'client', nTitle, body);
      }
    };

    const pushNotifToLeads = (nTitle: string, body: string) => {
      for (const lead of collectLeadParties(recipients)) {
        pushNotif(lead.userId, 'intern', nTitle, body);
      }
    };

    const pushNotifToManagers = (nTitle: string, body: string) => {
      for (const mgr of collectManagerParties(recipients)) {
        pushNotif(mgr.userId, 'manager', nTitle, body);
      }
    };

    if (!input.skipInAppNotifications) {
    if (input.event === 'client_submitted') {
      pushNotifToLeads(
        'Client submission',
        `${company} submitted ${title} for review.`,
      );
      pushNotifToManagers(
        'Client submission',
        `${company} submitted ${title} for review.`,
      );
      pushNotifToClients('Submission received', `We received your submission for ${title}.`);
    } else if (input.event === 'client_uploaded') {
      pushNotifToLeads('Client upload', `${company} uploaded ${title}.`);
      pushNotifToManagers('Client upload', `${company} uploaded ${title}.`);
    } else if (input.event === 'lead_requested_review') {
      pushNotifToManagers(
        'Manager approval requested',
        `${company}: ${title} is waiting for your approval.`,
      );
    } else if (input.event === 'review_accepted') {
      pushNotifToClients('Submission accepted', `${title} was approved.`);
      pushNotifToLeads('Submission accepted', `${title} was accepted for ${company}.`);
      pushNotifToManagers(
        'Submission accepted',
        `${title} was accepted for ${company}.`,
      );
      const adminHref = adminProjectStepPath(project, input.itemId, 'admin');
      for (const admin of collectAdminParties(recipients)) {
        if (!admin.userId || admin.userId === input.actorUserId) continue;
        notifDrafts.push({
          userId: admin.userId,
          kind,
          title: 'Submission accepted',
          body: `${title} was accepted for ${company}.`,
          engagementId: recipients.appId,
          companyName: company,
          itemId: input.itemId,
          href: adminHref,
        });
      }
    } else if (input.event === 'review_rejected') {
      const body = input.note?.trim()
        ? `${title}: ${input.note.trim()}`
        : `${title} needs updates — check the milestone for details.`;
      pushNotifToClients('Corrections requested', body);
      pushNotifToLeads('Corrections requested', `${title} needs updates for ${company}.`);
      pushNotifToManagers(
        'Corrections requested',
        `${title} needs updates for ${company}.`,
      );
    } else if (input.event === 'delivered') {
      const deliveredTitle = 'Delivered to client';
      const deliveredBody = `${title} was delivered for ${company}.`;
      pushNotifToClients('New from your VCFO team', `${title} is ready on your portal.`);
      pushNotifToLeads(deliveredTitle, deliveredBody);
      if (
        input.actorUserId &&
        !notifDrafts.some((n) => n.userId === input.actorUserId)
      ) {
        notifDrafts.push({
          userId: input.actorUserId,
          kind,
          title: deliveredTitle,
          body: deliveredBody,
          engagementId: recipients.appId,
          companyName: company,
          itemId: input.itemId,
          href: leadHref,
        });
      }
    } else if (input.event === 'unlocked') {
      pushNotifToClients('Fields unlocked', `You can update ${title} again and resubmit.`);
      pushNotifToLeads(
        'Fields unlocked',
        `Client fields unlocked on ${title} for ${company}.`,
      );
    } else if (input.event === 'docs_shared') {
      pushNotifToClients(
        'Incorporation drafts shared',
        'Draft incorporation forms are on your portal for download and upload.',
      );
      pushNotifToLeads(
        'Drafts shared',
        `Incorporation drafts shared with client for ${company}.`,
      );
    } else if (input.event === 'board_resolution_shared') {
      pushNotifToClients(
        'Board resolution ready',
        'The board resolution is ready to download and sign.',
      );
      // Include the acting lead: process row lands in Received; Graph send
      // writes email.sent on the Sent tab after they click Send.
      for (const lead of collectLeadParties(recipients)) {
        if (!lead.userId) continue;
        notifDrafts.push({
          userId: lead.userId,
          kind,
          title: 'Sent to client',
          body: `Board resolution sent to client for ${company}.`,
          engagementId: recipients.appId,
          companyName: company,
          itemId: input.itemId,
          href: leadHref,
        });
      }
    } else if (input.event === 'request_created') {
      pushNotifToClients('Document requested', `Please upload: ${title}.`);
      pushNotifToLeads(
        'Document requested',
        `Document request “${title}” sent to client for ${company}.`,
      );
    }
    }

    if (notifDrafts.length > 0) {
      try {
        await createNotificationsForUsers(notifDrafts);
      } catch (err) {
        console.error('[notify] in-app notifications failed', input.event, err);
      }
    }

    const progressKind = emailKind(input.event);
    const queue: Array<{
      to: string;
      subject: string;
      run: () => Promise<SendResendResult>;
    }> = [];

    // Client → staff: Resend From company_name@sbctrack.in
    // Intern → manager: Graph from the lead mailbox when connected, else Resend
    // Lead/manager → client: in-app compose + Graph Mail.Send (CC admin + lead on accept)
    if (!input.inAppOnly && opensClientOutgoingDraft(input.event)) {
      email.outgoingDraft = buildOutgoingClientDraft(
        input,
        recipients,
        company,
        title,
        clientHref,
      );
    }

    let skippedResendBecauseOutlook = false;
    if (
      !input.inAppOnly &&
      input.event === 'lead_requested_review' &&
      input.outlookCtx &&
      progressKind
    ) {
      const staffTargets = staffEmailTargetsForEvent(input.event, recipients, {
        leadHref,
        managerHref,
      });
      const to = staffTargets.map((s) => s.email).filter(Boolean);
      if (to.length > 0) {
        const copy = buildProgressEmail({
          kind: progressKind,
          companyName: company,
          itemId: input.itemId,
          note: input.note,
          portalHref: absolute(staffTargets[0]!.href),
          audience: 'lead',
          title: input.requestLabel,
        });
        try {
          await sendMailViaOutlook(input.outlookCtx, {
            to,
            subject: copy.subject,
            html: copy.html,
            text: copy.text,
          });
          for (const addr of to) {
            email.attempted += 1;
            email.sent.push(addr);
          }
          pushEmailSubject(email, copy.subject);
          skippedResendBecauseOutlook = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'outlook_send_failed';
          if (message !== 'outlook_not_connected' && message !== 'outlook_not_configured') {
            console.error('[notify] outlook lead→manager failed', message);
          }
        }
      }
    }

    if (
      !input.inAppOnly &&
      emailsStaffViaResend(input.event) &&
      progressKind &&
      !skippedResendBecauseOutlook
    ) {
      const staffTargets = staffEmailTargetsForEvent(input.event, recipients, {
        leadHref,
        managerHref,
      });

      if (staffTargets.length > 0) {
        for (const staff of staffTargets) {
          const copy = buildProgressEmail({
            kind: progressKind,
            companyName: company,
            itemId: input.itemId,
            note: input.note,
            portalHref: absolute(staff.href),
            audience: 'lead',
            title: input.requestLabel,
          });
          const to = staff.email;
          const replyTo = replyToForStaff(recipients, input.event, input.actorUserId);
          queue.push({
            to,
            subject: copy.subject,
            run: () =>
              sendResendEmail({
                to,
                cc: [],
                from: fromForCompany(recipients),
                replyTo,
                subject: copy.subject,
                html: copy.html,
                text: copy.text,
                purpose: `progress.${input.event}.${staff.label}`,
              }),
          });
        }
      } else {
        console.warn(
          '[notify] staff email skipped — no manager/lead (or they match client)',
          recipients.slug,
          input.event,
        );
      }
    }

    const settled = await Promise.all(
      queue.map(async (job) => {
        try {
          return { to: job.to, subject: job.subject, result: await job.run() };
        } catch (err) {
          console.error('[notify] send failed', job.to, err);
          return {
            to: job.to,
            subject: job.subject,
            result: { ok: false, error: 'send_failed' } satisfies SendResendResult,
          };
        }
      }),
    );

    for (const row of settled) {
      recordSend(email, row.to, row.result, row.subject);
    }

    email.sent = [...new Set(email.sent)];
    email.skipped = [...new Set(email.skipped)];
    email.failed = [...new Set(email.failed)];
    email.subjects = [...new Set(email.subjects ?? [])];
  } catch (err) {
    console.error('[notify] engagement event failed', input.event, err);
  }

  return email;
}
