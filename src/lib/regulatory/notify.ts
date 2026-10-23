import 'server-only';

import type { AskDocumentRow } from '@/db/repositories/ask-documents';
import { systemCreateOfficialUpdateAnnouncement } from '@/db/repositories/announcements';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { systemListActiveProfilesByRole } from '@/db/repositories/profiles';
import type { AnnouncementKind } from '@/lib/announcements';
import { firmDisplayName } from '@/lib/brand';
import { emailCallout, emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { sendEmail } from '@/lib/email/send-email';
import { watcherById } from '@/lib/ask/feeds/registry';
import type { FeedAct } from '@/lib/ask/feeds/types';

/**
 * Who hears about an official update, and when (owner, 2026-10-23). Lives
 * outside src/lib/ask on purpose: Ask VCFO itself never sends email (see
 * staff.test.ts); this is the firm's review process telling people.
 *   found by a watcher  → the managers (bell + email): "please review"
 *   approved by manager → everyone (bell), clients also by email, and a
 *                         post on the Announcements board
 * Rejected updates tell nobody; the reason stays on the review page.
 */

/**
 * Kill switch for the emails only (bells, announcements and approvals are
 * unaffected): REGULATORY_NOTICE_EMAILS=off while testing on a database that
 * holds real colleagues' and clients' addresses.
 */
function noticeEmailsEnabled(): boolean {
  return process.env.REGULATORY_NOTICE_EMAILS?.trim().toLowerCase() !== 'off';
}

async function sendNoticeEmail(input: Parameters<typeof sendEmail>[0]): Promise<void> {
  if (!noticeEmailsEnabled()) {
    console.log('[regulatory] email skipped (REGULATORY_NOTICE_EMAILS=off)', input.purpose, input.to);
    return;
  }
  await sendEmail(input);
}

function appUrl(pathname: string): string {
  const base = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${pathname}`;
}

const ACT_TO_ANNOUNCEMENT_KIND: Record<FeedAct, AnnouncementKind> = {
  GST: 'gst',
  Customs: 'tax',
  'Income Tax': 'tax',
  'Companies Act': 'mca',
  'FEMA / RBI': 'compliance',
  Labour: 'compliance',
};

function actOf(doc: AskDocumentRow): FeedAct | null {
  return watcherById(doc.feedId ?? '')?.act ?? null;
}

/** New update read and ready: the managers get a bell and an email with the review link. */
export async function notifyManagersOfPendingUpdate(doc: AskDocumentRow): Promise<void> {
  const managers = await systemListActiveProfilesByRole(['manager']);
  if (managers.length === 0) return;
  const act = actOf(doc) ?? 'Regulatory';
  const href = '/app/manager/regulatory-updates';
  const title = `${act} update to review: ${doc.title}`.slice(0, 200);
  const body = doc.summary ?? 'Open the review document to see what changed.';
  await createNotificationsForUsers(
    managers.map((m) => ({
      userId: m.id,
      kind: 'regulatory.review' as const,
      title,
      body,
      engagementId: '',
      companyName: act,
      href,
    })),
  );
  const firm = firmDisplayName();
  const html = renderEmailDocument({
    eyebrow: `${act} · official update`,
    title: 'An official update is waiting for your review',
    bodyHtml: [
      emailParagraph(`<strong>${escapeHtml(doc.title)}</strong>${doc.publishedAt ? ` · published ${escapeHtml(doc.publishedAt)}` : ''}`),
      emailCallout(escapeHtml(body)),
      emailParagraph('Open the review page, read the review document, and approve or reject. Ask VCFO uses the update for staff and clients only after you approve.'),
    ].join(''),
    cta: { label: 'Review the update', href: appUrl(href) },
  });
  const text = `${title}\n\n${body}\n\nReview: ${appUrl(href)}`;
  await Promise.all(
    managers.map((m) =>
      sendNoticeEmail({ to: m.email, subject: `[${firm}] Official ${act} update to review`, html, text, purpose: 'regulatory.review' }).catch((error) =>
        console.warn('[ask-feeds] review email failed', m.email, error),
      ),
    ),
  );
}

/** A manager approved: announcement for all, bell for all active users, email for clients. */
export async function notifyEveryoneOfApprovedUpdate(doc: AskDocumentRow): Promise<void> {
  const act = actOf(doc);
  const watcher = watcherById(doc.feedId ?? '');
  const summary = doc.summary ?? 'An official update was approved. Ask VCFO can explain it.';
  await systemCreateOfficialUpdateAnnouncement({
    documentId: doc.id,
    title: `${act ?? 'Regulatory'} update: ${doc.title}`,
    body: `${summary}${doc.publishedAt ? `\n\nPublished ${doc.publishedAt}.` : ''} Ask VCFO about how it affects your company.`,
    kind: act ? ACT_TO_ANNOUNCEMENT_KIND[act] : 'general',
    sourceUrl: doc.sourceUrl,
    publishedAt: new Date(),
    sourceLabel: watcher?.label ?? 'Official update',
  });

  const [clients, staff] = await Promise.all([
    systemListActiveProfilesByRole(['client']),
    systemListActiveProfilesByRole(['super_admin', 'admin', 'manager', 'intern']),
  ]);
  const title = `New ${act ?? 'regulatory'} update: ${doc.title}`.slice(0, 200);
  await createNotificationsForUsers([
    ...clients.map((c) => ({
      userId: c.id,
      kind: 'regulatory.approved' as const,
      title,
      body: summary,
      engagementId: '',
      companyName: act ?? 'Regulatory',
      href: '/app/client/announcements',
    })),
    ...staff.map((p) => ({
      userId: p.id,
      kind: 'regulatory.approved' as const,
      title,
      body: summary,
      engagementId: '',
      companyName: act ?? 'Regulatory',
      href: '/app/admin/announcements',
    })),
  ]);

  const firm = firmDisplayName();
  const html = renderEmailDocument({
    eyebrow: `${act ?? 'Regulatory'} · official update`,
    title: 'A government update that may affect your company',
    bodyHtml: [
      emailParagraph(`<strong>${escapeHtml(doc.title)}</strong>${doc.publishedAt ? ` · published ${escapeHtml(doc.publishedAt)}` : ''}`),
      emailCallout(escapeHtml(summary)),
      emailParagraph(`Your ${escapeHtml(firm)} team has reviewed this update. Ask VCFO in your portal can explain what it means for you.`),
    ].join(''),
    cta: { label: 'Open your portal', href: appUrl('/app/client/announcements') },
  });
  const text = `${title}\n\n${summary}\n\n${appUrl('/app/client/announcements')}`;
  for (const batch of chunk(clients, 25)) {
    await Promise.all(
      batch.map((c) =>
        sendNoticeEmail({ to: c.email, subject: `[${firm}] ${act ?? 'Regulatory'} update: ${doc.title}`.slice(0, 180), html, text, purpose: 'regulatory.approved' }).catch(
          (error) => console.warn('[ask-feeds] client update email failed', c.email, error),
        ),
      ),
    );
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
