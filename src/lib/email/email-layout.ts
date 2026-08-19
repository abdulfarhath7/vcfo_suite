/**
 * Shared professional HTML shell for all outbound VCFO Suite mail.
 * Inline styles only — email clients strip external CSS.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export type EmailDocumentBrand = 'vcfo' | 'sbc';

const DOCUMENT_BRAND: Record<
  EmailDocumentBrand,
  { mark: string; tagline: string; footerDefault: string; copyright: string }
> = {
  vcfo: {
    mark: 'VCFO Suite',
    tagline: 'Compliance · Incorporation · Client portal',
    footerDefault:
      'This is an automated message from VCFO Suite. Please do not reply to this address unless a Reply-To is set.',
    copyright: 'VCFO Suite',
  },
  sbc: {
    mark: 'SBC',
    tagline: 'Company secretarial · Incorporation · Compliance',
    footerDefault: 'This message was sent by SBC.',
    copyright: 'SBC',
  },
};

export type EmailLayoutInput = {
  /** Main headline inside the card */
  title: string;
  /** HTML body (already escaped where needed) */
  bodyHtml: string;
  /** Optional eyebrow above the title */
  eyebrow?: string;
  cta?: { label: string; href: string };
  /** Footer note under the card content */
  footerNote?: string;
  /** Who to contact / signature block (HTML) */
  signatureHtml?: string;
  /** Letterhead. Default `vcfo` keeps transactional mail unchanged. */
  brand?: EmailDocumentBrand;
};

/**
 * Brand-aligned transactional layout:
 * slate header, white card, blue CTA (matches product UI).
 */
export function renderEmailDocument(input: EmailLayoutInput): string {
  const brand = DOCUMENT_BRAND[input.brand ?? 'vcfo'];
  const eyebrow = input.eyebrow
    ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#64748B;font-weight:600;">${escapeHtml(input.eyebrow)}</p>`
    : '';
  const cta = input.cta
    ? `<p style="margin:28px 0 0;">
        <a href="${escapeHtml(input.cta.href)}"
           style="display:inline-block;padding:13px 22px;background:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;letter-spacing:0.01em;">
          ${escapeHtml(input.cta.label)}
        </a>
      </p>`
    : '';
  const signature = input.signatureHtml
    ? `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #E2E8F0;">${input.signatureHtml}</div>`
    : '';
  const footer = input.footerNote ?? brand.footerDefault;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:22px 32px;background:#0F172A;">
              <p style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#93C5FD;font-weight:700;">
                ${escapeHtml(brand.mark)}
              </p>
              <p style="margin:6px 0 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:13px;color:#94A3B8;">
                ${escapeHtml(brand.tagline)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
              ${eyebrow}
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">
                ${escapeHtml(input.title)}
              </h1>
              <div style="font-size:15px;line-height:1.65;color:#475569;">
                ${input.bodyHtml}
              </div>
              ${cta}
              ${signature}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:12px;line-height:1.5;color:#64748B;">
              ${escapeHtml(footer)}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:11px;color:#94A3B8;">
          © ${new Date().getFullYear()} ${escapeHtml(brand.copyright)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailParagraph(htmlInner: string): string {
  return `<p style="margin:0 0 14px;">${htmlInner}</p>`;
}

export function emailCallout(htmlInner: string): string {
  return `<div style="margin:16px 0;padding:14px 16px;background:#EFF6FF;border:1px solid #DBEAFE;border-radius:10px;font-size:14px;line-height:1.55;color:#1D4ED8;">${htmlInner}</div>`;
}

export function emailMetaTable(rows: Array<{ label: string; value: string }>): string {
  const cells = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 14px;background:#F8FAFC;color:#64748B;width:38%;border-top:1px solid #E2E8F0;font-size:13px;">${escapeHtml(r.label)}</td>
      <td style="padding:10px 14px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:600;">${escapeHtml(r.value)}</td>
    </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 18px;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;border-collapse:collapse;">${cells}</table>`;
}
