import { emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { siteUrl } from '@/lib/site-url';
import { digestDate, isEmptyDigest, type DigestItem, type DigestSection, type WeeklyDigest } from '@/lib/digest/weekly-digest';

/**
 * Email copy for the weekly digest. A pure builder like `src/lib/messages/message-emails.ts`:
 * the job in `src/jobs/weekly-digest.ts` sends it through `sendEmail`. Returns `null` for an
 * empty digest, so nobody gets a mail that says nothing.
 */

export type DigestEmailCopy = { subject: string; html: string; text: string };

/** Lines shown per section; the rest are counted ("and 4 more"). */
export const DIGEST_SECTION_LIMIT = 8;

function absolute(path: string): string {
  if (path.startsWith('http')) return path;
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function dateText(item: DigestItem): string {
  if (!item.date) return '';
  const d = digestDate(item.date);
  if (item.dateLabel === 'due') return `due ${d}`;
  if (item.dateLabel === 'since') return `since ${d}`;
  return d;
}

function itemText(item: DigestItem): string {
  return [item.title, item.detail, dateText(item)].filter(Boolean).join(' · ');
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

function sectionHtml(section: DigestSection): string {
  const shown = section.items.slice(0, DIGEST_SECTION_LIMIT);
  const more = section.items.length - shown.length;
  const rows = shown
    .map((item) => {
      const title = item.href
        ? `<a href="${escapeHtml(absolute(item.href))}" style="color:#0F172A;font-weight:600;text-decoration:none;">${escapeHtml(item.title)}</a>`
        : `<span style="color:#0F172A;font-weight:600;">${escapeHtml(item.title)}</span>`;
      const rest = [item.detail, dateText(item)].filter(Boolean).map((s) => escapeHtml(s!)).join(' · ');
      return `<li style="margin:0 0 6px;">${title}${rest ? ` <span style="color:#64748B;">· ${rest}</span>` : ''}</li>`;
    })
    .join('');
  const moreLine = more > 0 ? `<li style="margin:0 0 6px;color:#64748B;">and ${more} more</li>` : '';
  return `<h2 style="margin:24px 0 8px;font-size:16px;line-height:1.4;font-weight:700;color:#0F172A;">${escapeHtml(section.title)} (${section.items.length})</h2>
<ul style="margin:0 0 8px;padding-left:18px;font-size:14px;line-height:1.55;">${rows}${moreLine}</ul>
<p style="margin:0 0 8px;font-size:14px;"><a href="${escapeHtml(absolute(section.href))}" style="color:#2563EB;text-decoration:none;font-weight:600;">${escapeHtml(section.linkLabel)}</a></p>`;
}

function sectionText(section: DigestSection): string {
  const shown = section.items.slice(0, DIGEST_SECTION_LIMIT);
  const more = section.items.length - shown.length;
  const lines = shown.map((item) => `- ${itemText(item)}`);
  if (more > 0) lines.push(`- and ${more} more`);
  return `${section.title} (${section.items.length})\n${lines.join('\n')}\n${section.linkLabel}: ${absolute(section.href)}`;
}

/** The subject's short summary: "2 overdue, 3 due soon". */
function summary(sections: DigestSection[]): string {
  return sections
    .filter((s) => s.items.length > 0)
    .map((s) => s.countLabel(s.items.length))
    .join(', ');
}

export function buildWeeklyDigestEmail(digest: WeeklyDigest): DigestEmailCopy | null {
  if (isEmptyDigest(digest)) return null;
  const sections = digest.sections.filter((s) => s.items.length > 0);
  const weekOf = digestDate(digest.week.mondayIso);
  const title = `Your week from ${weekOf}`;
  const intro =
    digest.audience === 'client'
      ? 'Here is what is coming up on your filings and what we need from you.'
      : digest.audience === 'admin' || digest.audience === 'super_admin'
        ? 'Here is where the firm stands this week.'
        : 'Here is what needs you this week.';
  const settings = absolute(digest.settingsHref);
  const footerNote = 'You get this summary every Monday because the weekly digest is on in your notification settings.';

  return {
    subject: `${title}: ${summary(sections)}`,
    html: renderEmailDocument({
      eyebrow: 'Weekly digest',
      title,
      bodyHtml:
        emailParagraph(`Hi ${escapeHtml(firstName(digest.recipientName))},`) +
        emailParagraph(escapeHtml(intro)) +
        sections.map(sectionHtml).join('') +
        emailParagraph(
          `<span style="font-size:13px;color:#64748B;">To stop these emails, switch off the weekly digest in <a href="${escapeHtml(settings)}" style="color:#2563EB;">Settings</a>.</span>`,
        ),
      footerNote,
    }),
    text: [
      `Hi ${firstName(digest.recipientName)},`,
      intro,
      ...sections.map(sectionText),
      `To stop these emails, switch off the weekly digest in Settings: ${settings}`,
    ].join('\n\n'),
  };
}
