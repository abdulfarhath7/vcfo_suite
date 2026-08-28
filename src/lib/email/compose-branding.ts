import {
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '@/lib/email/email-layout';

export const EMAIL_BRANDING = ['sbc', 'plain'] as const;
export type EmailBranding = (typeof EMAIL_BRANDING)[number];

export function isEmailBranding(value: string | null | undefined): value is EmailBranding {
  return value === 'sbc' || value === 'plain';
}

export function parseEmailBranding(value: string | null | undefined): EmailBranding {
  return isEmailBranding(value) ? value : 'sbc';
}

export function emailBrandingLabel(branding: EmailBranding): string {
  return branding === 'sbc' ? 'SBC branded' : 'Plain';
}

export function htmlFromPlainText(text: string): string {
  const escaped = escapeHtml(text).replace(/\n/g, '<br />');
  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.55;color:#0F172A;">${escaped}</div>`;
}

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wrap a compose-body for Graph HTML send.
 * `sbc` uses the SBC letterhead (`/sbc-logo-light.png` via `siteUrl()`);
 * `plain` is unbranded text.
 */
export function wrapComposeBodyHtml(
  text: string,
  branding: EmailBranding,
  subject: string,
): string {
  const trimmed = text.trim();
  if (branding !== 'sbc') return htmlFromPlainText(trimmed);

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((block) => emailParagraph(escapeHtml(block).replace(/\n/g, '<br />')))
    .join('');

  return renderEmailDocument({
    brand: 'sbc',
    title: subject.trim() || 'Message',
    bodyHtml: paragraphs || emailParagraph(''),
    footerNote: 'This message was sent by SBC.',
  });
}

export type EmailTemplateDto = {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  bodyText: string;
  branding: EmailBranding;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  canMutate: boolean;
};
