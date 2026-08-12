import { getItem } from '@/data/checklist';
import { siteUrl } from '@/lib/site-url';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export type ProgressEmailKind =
  | 'client_submitted'
  | 'review_accepted'
  | 'review_rejected'
  | 'delivered'
  | 'unlocked'
  | 'docs_shared';

export type ProgressEmailCopy = {
  subject: string;
  html: string;
  text: string;
};

function wrapHtml(title: string, bodyHtml: string, ctaLabel: string, ctaHref: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F6FB;font-family:Manrope,Segoe UI,sans-serif;color:#1A1B22;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6FB;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e8e4f2;overflow:hidden;">
        <tr><td style="padding:20px 28px;background:#1A1B22;color:#fff;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;">VCFO Suite</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#1A1B22;">${escapeHtml(title)}</h1>
          ${bodyHtml}
          <p style="margin:24px 0 0;">
            <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:12px 18px;background:#7C5CFC;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${escapeHtml(ctaLabel)}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px;font-size:12px;color:#6b6560;border-top:1px solid #eee;">This is an automated update from VCFO Suite.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function stepTitle(itemId: string): string {
  return getItem(itemId)?.title ?? itemId;
}

export function buildProgressEmail(input: {
  kind: ProgressEmailKind;
  companyName: string;
  itemId: string;
  note?: string | null;
  portalHref: string;
  audience: 'client' | 'lead';
}): ProgressEmailCopy {
  const step = stepTitle(input.itemId);
  const company = input.companyName;
  const note = input.note?.trim();
  const href = input.portalHref.startsWith('http')
    ? input.portalHref
    : `${siteUrl()}${input.portalHref.startsWith('/') ? '' : '/'}${input.portalHref}`;

  if (input.kind === 'client_submitted') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: client submitted “${step}”`,
        html: wrapHtml(
          'Client submission ready for review',
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(company)} submitted <strong>${escapeHtml(step)}</strong> for review.</p>`,
          'Open in workspace',
          href,
        ),
        text: `${company} submitted “${step}” for review.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: we received your “${step}” submission`,
      html: wrapHtml(
        'Submission received',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Thanks — we received your submission for <strong>${escapeHtml(step)}</strong> on ${escapeHtml(company)}. Your project lead will review it next.</p>`,
        'Open client portal',
        href,
      ),
      text: `We received your submission for “${step}” on ${company}. Your project lead will review it next.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'review_accepted') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: “${step}” accepted`,
        html: wrapHtml(
          'Submission accepted',
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>${escapeHtml(step)}</strong> for ${escapeHtml(company)} was accepted.</p>`,
          'Open workspace',
          href,
        ),
        text: `“${step}” for ${company} was accepted.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: “${step}” was approved`,
      html: wrapHtml(
        'Submission approved',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Good news — <strong>${escapeHtml(step)}</strong> was approved by your engagement team.</p>`,
        'Open client portal',
        href,
      ),
      text: `“${step}” was approved by your engagement team.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'review_rejected') {
    const noteHtml = note
      ? `<p style="margin:12px 0;padding:12px 14px;background:#F7F6FB;border-radius:8px;font-size:14px;line-height:1.55;"><strong>Note:</strong> ${escapeHtml(note)}</p>`
      : '';
    const noteText = note ? `\nNote: ${note}\n` : '\n';
    if (input.audience === 'lead') {
      return {
        subject: `${company}: corrections requested on “${step}”`,
        html: wrapHtml(
          'Corrections requested',
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Corrections were requested on <strong>${escapeHtml(step)}</strong> for ${escapeHtml(company)}.</p>${noteHtml}`,
          'Open workspace',
          href,
        ),
        text: `Corrections requested on “${step}” for ${company}.${noteText}\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: updates needed on “${step}”`,
      html: wrapHtml(
        'Updates needed',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Your team requested updates on <strong>${escapeHtml(step)}</strong>.</p>${noteHtml}`,
        'Open client portal',
        href,
      ),
      text: `Updates needed on “${step}”.${noteText}\nOpen: ${href}`,
    };
  }

  if (input.kind === 'delivered') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: “${step}” delivered to client`,
        html: wrapHtml(
          'Delivered to client',
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>${escapeHtml(step)}</strong> was marked delivered for ${escapeHtml(company)}.</p>`,
          'Open workspace',
          href,
        ),
        text: `“${step}” was delivered to the client for ${company}.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: “${step}” is ready for you`,
      html: wrapHtml(
        'Ready on your portal',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>${escapeHtml(step)}</strong> is ready on your client portal.</p>`,
        'Open client portal',
        href,
      ),
      text: `“${step}” is ready on your client portal.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'unlocked') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: fields unlocked on “${step}”`,
        html: wrapHtml(
          'Fields unlocked for client',
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Client fields were unlocked on <strong>${escapeHtml(step)}</strong> for ${escapeHtml(company)}.</p>`,
          'Open workspace',
          href,
        ),
        text: `Client fields unlocked on “${step}” for ${company}.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: you can update “${step}” again`,
      html: wrapHtml(
        'Fields unlocked',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Your team unlocked fields on <strong>${escapeHtml(step)}</strong> so you can update and resubmit.</p>`,
        'Open client portal',
        href,
      ),
      text: `Fields on “${step}” were unlocked so you can update and resubmit.\n\nOpen: ${href}`,
    };
  }

  // docs_shared
  if (input.audience === 'lead') {
    return {
      subject: `${company}: incorporation drafts shared with client`,
      html: wrapHtml(
        'Drafts shared',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Incorporation drafts for ${escapeHtml(company)} were shared with the client.</p>`,
        'Open workspace',
        href,
      ),
      text: `Incorporation drafts for ${company} were shared with the client.\n\nOpen: ${href}`,
    };
  }
  return {
    subject: `${company}: incorporation drafts are available`,
    html: wrapHtml(
      'Drafts available',
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Your incorporation drafts are available to download (and upload signed copies) on your portal.</p>`,
      'Open client portal',
      href,
    ),
    text: `Your incorporation drafts are available on your portal.\n\nOpen: ${href}`,
  };
}
