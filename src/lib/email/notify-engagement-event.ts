import 'server-only';

import { getItem } from '@/data/checklist';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import type { EngagementParty, EngagementRecipients } from '@/db/repositories/engagement-recipients';
import {
  emptyEmailDispatch,
  type EmailDispatchResult,
} from '@/lib/email/email-dispatch';
import { buildProgressEmail, type ProgressEmailKind } from '@/lib/email/progress-emails';
import {
  formatReplyTo,
  sendResendEmail,
  type SendResendResult,
} from '@/lib/email/send-resend';
import type { NotificationKind } from '@/lib/checklist-notifications';
import {
  adminProjectStepPath,
  internEngagementStepPath,
} from '@/lib/project-step-path';
import { siteUrl } from '@/lib/site-url';

export type { EmailDispatchResult };

export type EngagementProcessEvent =
  | 'client_submitted'
  | 'review_accepted'
  | 'review_rejected'
  | 'delivered'
  | 'unlocked'
  | 'docs_shared'
  | 'request_created';

type NotifyInput = {
  engagementId: string;
  itemId: string;
  event: EngagementProcessEvent;
  note?: string | null;
  /** Optional label for document requests (overrides step title in body). */
  requestLabel?: string;
  /** Actor userId — skip notifying the person who triggered the action. */
  actorUserId?: string;
};

function stepTitle(itemId: string): string {
  return getItem(itemId)?.title ?? itemId;
}

function emailKind(event: EngagementProcessEvent): ProgressEmailKind | null {
  switch (event) {
    case 'client_submitted':
      return 'client_submitted';
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
    case 'request_created':
      return null;
  }
}

function notificationKind(event: EngagementProcessEvent): NotificationKind {
  switch (event) {
    case 'client_submitted':
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
    case 'request_created':
      return 'request.created';
  }
}

function absolute(path: string): string {
  if (path.startsWith('http')) return path;
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function excludeEmails(list: string[], ...emails: Array<string | undefined | null>): string[] {
  const skip = new Set(
    emails.flatMap((e) => {
      const t = e?.trim().toLowerCase();
      return t ? [t] : [];
    }),
  );
  return list.filter((e) => !skip.has(e));
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
  if (recipients.client?.userId === userId) return recipients.client;
  return recipients.clients.find((c) => c.userId === userId) ?? null;
}

function isClientParty(recipients: EngagementRecipients, party: EngagementParty | null): boolean {
  if (!party) return false;
  if (recipients.client?.userId === party.userId) return true;
  return recipients.clients.some((c) => c.userId === party.userId);
}

/** Reply-To for mail sent to staff (client submitted, etc.). */
function replyToForStaff(
  recipients: EngagementRecipients,
  actorUserId?: string,
): string | undefined {
  const actor = findPartyByUserId(recipients, actorUserId);
  if (actor && isClientParty(recipients, actor)) return formatReplyTo(actor);
  return formatReplyTo(recipients.client ?? recipients.clients[0] ?? null);
}

/** Reply-To for mail sent to clients (review, deliver, requests, etc.). */
function replyToForClient(
  recipients: EngagementRecipients,
  actorUserId?: string,
): string | undefined {
  const actor = findPartyByUserId(recipients, actorUserId);
  if (actor && !isClientParty(recipients, actor)) return formatReplyTo(actor);
  return formatReplyTo(recipients.lead ?? recipients.leads[0] ?? recipients.manager ?? null);
}

function recordSend(out: EmailDispatchResult, to: string, result: SendResendResult) {
  out.attempted += 1;
  // Always report the intended staff/client recipient — not a test redirect address.
  const addr = (result.intendedTo?.[0] ?? to).trim();
  if (!addr) return;
  if (result.ok) out.sent.push(addr);
  else if (result.skipped) out.skipped.push(addr);
  else out.failed.push(addr);
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
    const clientHref = '/app/client/incorporation';
    const leadHref = internEngagementStepPath(project, input.itemId);
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
      if (!userId || userId === input.actorUserId) return;
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
      const seen = new Set<string>();
      for (const lead of recipients.leads.length > 0
        ? recipients.leads
        : recipients.lead
          ? [recipients.lead]
          : []) {
        if (seen.has(lead.userId)) continue;
        seen.add(lead.userId);
        pushNotif(lead.userId, 'intern', nTitle, body);
      }
    };

    if (input.event === 'client_submitted') {
      pushNotifToLeads(
        'Client submission',
        `${company} submitted ${title} for review.`,
      );
      pushNotif(
        recipients.manager?.userId,
        'manager',
        'Client submission',
        `${company} submitted ${title} for review.`,
      );
      pushNotifToClients('Submission received', `We received your submission for ${title}.`);
    } else if (input.event === 'review_accepted') {
      pushNotifToClients('Submission accepted', `${title} was approved.`);
      pushNotifToLeads('Submission accepted', `${title} was accepted for ${company}.`);
    } else if (input.event === 'review_rejected') {
      const body = input.note?.trim()
        ? `${title}: ${input.note.trim()}`
        : `${title} needs updates — check the milestone for details.`;
      pushNotifToClients('Corrections requested', body);
      pushNotifToLeads('Corrections requested', `${title} needs updates for ${company}.`);
    } else if (input.event === 'delivered') {
      pushNotifToClients('New from your VCFO team', `${title} is ready on your portal.`);
      pushNotifToLeads('Delivered to client', `${title} was delivered for ${company}.`);
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
    } else if (input.event === 'request_created') {
      pushNotifToClients('Document requested', `Please upload: ${title}.`);
      pushNotifToLeads(
        'Document requested',
        `Document request “${title}” sent to client for ${company}.`,
      );
    }

    if (notifDrafts.length > 0) {
      await createNotificationsForUsers(notifDrafts);
    }

    const progressKind = emailKind(input.event);
    const queue: Array<{ to: string; run: () => Promise<SendResendResult> }> = [];

    // Directional process mail:
    // - client submits → email lead (not the client)
    // - lead/manager reviews → email client(s) (not the lead)
    // - deliver / unlock / docs share → client(s) (+ lead copy for visibility)
    const emailClients =
      progressKind != null &&
      (input.event === 'review_accepted' ||
        input.event === 'review_rejected' ||
        input.event === 'delivered' ||
        input.event === 'unlocked' ||
        input.event === 'docs_shared');
    const emailLead =
      progressKind != null &&
      (input.event === 'client_submitted' ||
        input.event === 'delivered' ||
        input.event === 'unlocked' ||
        input.event === 'docs_shared');

    if (emailClients) {
      const copy = buildProgressEmail({
        kind: progressKind!,
        companyName: company,
        itemId: input.itemId,
        note: input.note,
        portalHref: absolute(clientHref),
        audience: 'client',
      });
      const parties =
        recipients.clients.length > 0
          ? recipients.clients
          : recipients.client
            ? [recipients.client]
            : [];
      const replyTo = replyToForClient(recipients, input.actorUserId);
      // No staff CC — lead gets a dedicated mail when emailLead is set; Resend test
      // domains also reject CC to non-verified addresses.
      for (const party of parties) {
        const to = party.email;
        const cc = excludeEmails(
          recipients.progressCc,
          to,
          ...parties.map((c) => c.email),
          ...recipients.leads.map((l) => l.email),
          recipients.lead?.email,
          recipients.manager?.email,
        );
        queue.push({
          to,
          run: () =>
            sendResendEmail({
              to,
              cc,
              replyTo,
              subject: copy.subject,
              html: copy.html,
              text: copy.text,
              purpose: `progress.${input.event}.client`,
            }),
        });
      }
    }

    if (emailLead) {
      // Client submit → all leads + manager. Never fall back to client / progress CC.
      const clientEmails = new Set(
        [
          ...recipients.clients.map((c) => c.email.trim().toLowerCase()),
          recipients.client?.email?.trim().toLowerCase(),
        ].filter((e): e is string => Boolean(e)),
      );
      const staffTargets: Array<{ email: string; href: string; label: string }> = [];
      const seenStaff = new Set<string>();
      const pushStaff = (email: string | undefined, href: string, label: string) => {
        const addr = email?.trim();
        if (!addr) return;
        const key = addr.toLowerCase();
        if (clientEmails.has(key) || seenStaff.has(key)) return;
        seenStaff.add(key);
        staffTargets.push({ email: addr, href, label });
      };
      for (const lead of recipients.leads.length > 0
        ? recipients.leads
        : recipients.lead
          ? [recipients.lead]
          : []) {
        pushStaff(lead.email, leadHref, 'lead');
      }
      if (input.event === 'client_submitted') {
        pushStaff(recipients.manager?.email, managerHref, 'manager');
      } else if (staffTargets.length === 0) {
        pushStaff(recipients.manager?.email, managerHref, 'manager');
      }

      if (staffTargets.length > 0) {
        for (const staff of staffTargets) {
          const copy = buildProgressEmail({
            kind: progressKind!,
            companyName: company,
            itemId: input.itemId,
            note: input.note,
            portalHref: absolute(staff.href),
            audience: 'lead',
          });
          const to = staff.email;
          const replyTo = replyToForStaff(recipients, input.actorUserId);
          queue.push({
            to,
            run: () =>
              sendResendEmail({
                to,
                cc: [],
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
          '[notify] staff email skipped — no lead/manager (or they match client)',
          recipients.slug,
        );
      }
    }

    if (input.event === 'request_created') {
      const href = absolute(clientHref);
      const subject = `${company}: document requested — ${title}`;
      const textBase = `Please upload “${title}” for ${company}.\n\nOpen: ${href}${
        input.note?.trim() ? `\n\nNote: ${input.note.trim()}` : ''
      }`;
      const esc = (v: string) =>
        v
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      const html = `<p>Please upload <strong>${esc(title)}</strong> for ${esc(company)}.</p>
        ${input.note?.trim() ? `<p><strong>Note:</strong> ${esc(input.note.trim())}</p>` : ''}
        <p><a href="${esc(href)}">Open client portal</a></p>`;
      const parties =
        recipients.clients.length > 0
          ? recipients.clients
          : recipients.client
            ? [recipients.client]
            : [];
      const replyTo = replyToForClient(recipients, input.actorUserId);
      for (const party of parties) {
        queue.push({
          to: party.email,
          run: () =>
            sendResendEmail({
              to: party.email,
              // Progress CC only — staff are Reply-To, not CC (avoids Resend test 403s).
              cc: excludeEmails(recipients.progressCc, party.email, ...parties.map((p) => p.email)),
              replyTo,
              subject,
              html,
              text: textBase,
              purpose: 'progress.request_created.client',
            }),
        });
      }
    }

    const settled = await Promise.all(
      queue.map(async (job) => {
        try {
          return { to: job.to, result: await job.run() };
        } catch (err) {
          console.error('[notify] send failed', job.to, err);
          return {
            to: job.to,
            result: { ok: false, error: 'send_failed' } satisfies SendResendResult,
          };
        }
      }),
    );

    for (const row of settled) {
      recordSend(email, row.to, row.result);
    }

    email.sent = [...new Set(email.sent)];
    email.skipped = [...new Set(email.skipped)];
    email.failed = [...new Set(email.failed)];
  } catch (err) {
    console.error('[notify] engagement event failed', input.event, err);
  }

  return email;
}
