/**
 * Shared HTML shell for all outbound VCFO Suite mail, drawn in the VCFO Spectrum design system.
 *
 * Mail clients strip external CSS and read neither CSS variables nor oklch(), so every colour comes
 * from `spectrum-email-tokens.ts` (generated from `docs/design/design-tokens.json` by
 * `npm run tokens:email`) and is written inline. Layout is tables only. A small <style> block adds
 * what inline styles cannot: the dark palette under `prefers-color-scheme: dark`, the DashHero
 * gradient wash where the client draws gradients, and the Roboto / Roboto Mono web fonts (R-28).
 * Outlook on Windows ignores all three and gets the solid brand-soft band, Arial and the light
 * palette, which is the designed fallback.
 */

import type { ChipTone } from '@/components/ui/spectrum-chip';
import { SIX_TONE, type SixWord } from '@/lib/compliance/spectrum-status';
import { siteUrl } from '@/lib/site-url';
import {
  SPECTRUM_EMAIL_BORDER,
  SPECTRUM_EMAIL_COLORS,
  SPECTRUM_EMAIL_FONTS,
  SPECTRUM_EMAIL_HERO,
  SPECTRUM_EMAIL_RADIUS,
  type SpectrumEmailColorName,
} from '@/lib/email/spectrum-email-tokens';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/* ---- Tokens ------------------------------------------------------------------------------ */

const LIGHT = SPECTRUM_EMAIL_COLORS.light;
const DARK = SPECTRUM_EMAIL_COLORS.dark;
const RADIUS = SPECTRUM_EMAIL_RADIUS['radius-lg'];
const HAIRLINE = SPECTRUM_EMAIL_BORDER.hairline;
const SANS = SPECTRUM_EMAIL_FONTS.sans;
const MONO = SPECTRUM_EMAIL_FONTS.mono;

/** Light-mode hex of a Spectrum colour token, for inline styles. */
export function emailColor(name: SpectrumEmailColorName): string {
  return LIGHT[name];
}

/**
 * Class names the dark-mode stylesheet re-colours. Each element carries its light colours inline
 * and one of these classes, so a client that reads <style> swaps to the dark token.
 */
type DarkRule = { bg?: SpectrumEmailColorName; fg?: SpectrumEmailColorName; border?: SpectrumEmailColorName };
const DARK_RULES: Record<string, DarkRule> = {
  'sp-canvas': { bg: 'surface' },
  'sp-card': { bg: 'surface-raised', border: 'line' },
  'sp-wash': { bg: 'brand-soft' },
  'sp-sunken': { bg: 'surface-sunken' },
  'sp-line': { border: 'line' },
  'sp-line-soft': { border: 'line-soft' },
  'sp-ink': { fg: 'ink' },
  'sp-ink2': { fg: 'ink-2' },
  'sp-wash-ink2': { fg: 'wash-ink-2' },
  'sp-muted': { fg: 'ink-muted' },
  'sp-faint': { fg: 'ink-faint' },
  'sp-link': { fg: 'brand-text' },
  'sp-btn': { bg: 'brand', fg: 'on-brand', border: 'brand' },
  'sp-btn2': { bg: 'surface-raised', fg: 'ink', border: 'line-strong' },
  'sp-callout': { bg: 'info-soft', fg: 'ink', border: 'info-line' },
  'sp-quote': { bg: 'surface-sunken', fg: 'ink-2', border: 'line-strong' },
};

/** The status tones of `spectrum-chip.tsx` (R-13) as token triplets: ground, word, dot. */
const TONE_TOKENS: Record<ChipTone, { soft: SpectrumEmailColorName; fg: SpectrumEmailColorName; mid: SpectrumEmailColorName }> = {
  ok: { soft: 'positive-soft', fg: 'positive', mid: 'positive-mid' },
  warn: { soft: 'warning-soft', fg: 'warning', mid: 'warning-mid' },
  bad: { soft: 'danger-soft', fg: 'danger', mid: 'danger-mid' },
  prog: { soft: 'brand-soft', fg: 'brand-text', mid: 'brand' },
  idle: { soft: 'upcoming-soft', fg: 'upcoming', mid: 'upcoming-mid' },
  violet: { soft: 'identity-soft', fg: 'identity', mid: 'identity-mid' },
  teal: { soft: 'waiting-soft', fg: 'waiting', mid: 'waiting-mid' },
};
for (const [tone, t] of Object.entries(TONE_TOKENS)) {
  DARK_RULES[`sp-tone-${tone}`] = { bg: t.soft, fg: t.fg };
  DARK_RULES[`sp-word-${tone}`] = { fg: t.fg };
  DARK_RULES[`sp-dot-${tone}`] = { bg: t.mid };
}

function darkStylesheet(): string {
  const rules = Object.entries(DARK_RULES)
    .map(([cls, r]) => {
      const decl = [
        r.bg ? `background-color:${DARK[r.bg]} !important;` : '',
        r.fg ? `color:${DARK[r.fg]} !important;` : '',
        r.border ? `border-color:${DARK[r.border]} !important;` : '',
      ].join('');
      return `.${cls}{${decl}}`;
    })
    .join('');
  return `@media (prefers-color-scheme: dark){${rules}a{color:${DARK['brand-text']};}.sp-light-only{display:none !important;}.sp-dark-only{display:block !important;max-height:none !important;overflow:visible !important;}}`;
}

/* ---- Letterheads -------------------------------------------------------------------------- */

type EmailDocumentBrand = 'vcfo' | 'sbc';

/** Black mark — light email / compose letterhead (`public/sbc-logo-light.png`). */
export const SBC_EMAIL_LOGO_LIGHT_PATH = '/sbc-logo-light.png';
/** White mark — shown only when the mail client is in dark mode (`public/sbc-logo-dark.png`). */
export const SBC_EMAIL_LOGO_DARK_PATH = '/sbc-logo-dark.png';

/** Display size in the letterhead (intrinsic 971×288). */
const SBC_EMAIL_LOGO_DISPLAY = { width: 162, height: 48 } as const;

/** Absolute URL for Resend / Graph HTML. Same `siteUrl()` host as portal links — no CID / extra Resend attachment. */
export function sbcEmailLogoUrl(tone: 'light' | 'dark' = 'light'): string {
  const path = tone === 'dark' ? SBC_EMAIL_LOGO_DARK_PATH : SBC_EMAIL_LOGO_LIGHT_PATH;
  return `${siteUrl()}${path}`;
}

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

function brandMarkHtml(
  brandKey: EmailDocumentBrand,
  brand: (typeof DOCUMENT_BRAND)[EmailDocumentBrand],
): string {
  if (brandKey === 'sbc') {
    const { width, height } = SBC_EMAIL_LOGO_DISPLAY;
    const img = (tone: 'light' | 'dark') =>
      `<img src="${escapeHtml(sbcEmailLogoUrl(tone))}" alt="${escapeHtml(brand.mark)}" width="${width}" height="${height}" style="display:block;height:${height}px;width:auto;max-width:100%;border:0;outline:none;text-decoration:none;" />`;
    /* The white mark is hidden inline and in Outlook (mso-hide); only the dark stylesheet shows it. */
    return `<div class="sp-light-only">${img('light')}</div>
                    <!--[if !mso]><!--><div class="sp-dark-only" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${img('dark')}</div><!--<![endif]-->`;
  }

  return `<p class="sp-ink" style="margin:0;font-family:${SANS};font-size:13px;line-height:18px;letter-spacing:0.01em;color:${LIGHT.ink};font-weight:700;">
                      ${escapeHtml(brand.mark)}
                    </p>
                    <p class="sp-wash-ink2" style="margin:2px 0 0;font-family:${SANS};font-size:12px;line-height:16px;color:${LIGHT['wash-ink-2']};">
                      ${escapeHtml(brand.tagline)}
                    </p>`;
}

/* ---- Document ------------------------------------------------------------------------------ */

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
 * Spectrum transactional layout: a surface canvas, one raised card with a hairline edge and 6px
 * corners, the DashHero colour wash as the header band (letterhead, eyebrow, title), the body, a
 * primary brand button and a sunken footer.
 */
export function renderEmailDocument(input: EmailLayoutInput): string {
  const brandKey = input.brand ?? 'vcfo';
  const brand = DOCUMENT_BRAND[brandKey];
  const eyebrow = input.eyebrow
    ? `<p class="sp-wash-ink2" style="margin:20px 0 6px;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${LIGHT['wash-ink-2']};font-weight:600;">${escapeHtml(input.eyebrow)}</p>`
    : '';
  const titleTop = input.eyebrow ? '0' : '20px';
  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;border-collapse:separate;">
                <tr>
                  <td>${emailButton(input.cta.label, input.cta.href, { size: 'lg' })}</td>
                </tr>
              </table>`
    : '';
  const signature = input.signatureHtml
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;">
                <tr>
                  <td class="sp-line-soft" style="padding-top:20px;border-top:${HAIRLINE} solid ${LIGHT['line-soft']};">${input.signatureHtml}</td>
                </tr>
              </table>`
    : '';
  const footer = input.footerNote ?? brand.footerDefault;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(input.title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>body,table,td,th,p,a,h1,h2,h3,span,div,li{font-family:${SPECTRUM_EMAIL_FONTS.outlook} !important;}</style>
  <![endif]-->
  <!--[if !mso]><!-->
  <link href="${escapeHtml(SPECTRUM_EMAIL_FONTS.googleHref)}" rel="stylesheet" />
  <!--<![endif]-->
  <style>
    :root{color-scheme:light dark;supported-color-schemes:light dark;}
    body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
    a{color:${LIGHT['brand-text']};}
    @media screen and (max-width:600px){.sp-pad{padding-left:20px !important;padding-right:20px !important;}.sp-outer{padding:16px 8px !important;}}
    ${darkStylesheet()}
  </style>
  <style>
    .sp-wash{background-image:${SPECTRUM_EMAIL_HERO.light};}
    @media (prefers-color-scheme: dark){.sp-wash{background-image:${SPECTRUM_EMAIL_HERO.dark} !important;}}
  </style>
</head>
<body class="sp-canvas" style="margin:0;padding:0;background-color:${LIGHT.surface};font-family:${SANS};color:${LIGHT.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sp-canvas" bgcolor="${LIGHT.surface}" style="background-color:${LIGHT.surface};border-collapse:collapse;">
    <tr>
      <td align="center" class="sp-outer" style="padding:32px 16px;">
        <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sp-card" bgcolor="${LIGHT['surface-raised']}" style="max-width:600px;width:100%;background-color:${LIGHT['surface-raised']};border:${HAIRLINE} solid ${LIGHT.line};border-radius:${RADIUS};border-collapse:separate;border-spacing:0;overflow:hidden;">
          <tr>
            <td class="sp-wash sp-pad" bgcolor="${LIGHT['brand-soft']}" style="padding:24px 32px 26px;background-color:${LIGHT['brand-soft']};border-radius:${RADIUS} ${RADIUS} 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td>
                    ${brandMarkHtml(brandKey, brand)}
                    ${eyebrow}
                    <h1 class="sp-ink" style="margin:${titleTop} 0 0;font-family:${SANS};font-size:22px;line-height:28px;font-weight:600;letter-spacing:-0.01em;color:${LIGHT.ink};">
                      ${escapeHtml(input.title)}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="sp-pad" style="padding:28px 32px 32px;font-family:${SANS};">
              <div class="sp-ink2" style="font-family:${SANS};font-size:15px;line-height:22px;color:${LIGHT['ink-2']};">
                ${input.bodyHtml}
              </div>
              ${cta}
              ${signature}
            </td>
          </tr>
          <tr>
            <td class="sp-sunken sp-muted sp-line-soft sp-pad" bgcolor="${LIGHT['surface-sunken']}" style="padding:16px 32px;background-color:${LIGHT['surface-sunken']};border-top:${HAIRLINE} solid ${LIGHT['line-soft']};border-radius:0 0 ${RADIUS} ${RADIUS};font-family:${SANS};font-size:12px;line-height:16px;color:${LIGHT['ink-muted']};">
              ${emailIdentifiers(escapeHtml(footer))}
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
        <p class="sp-faint" style="margin:16px 0 0;font-family:${SANS};font-size:11px;line-height:16px;color:${LIGHT['ink-faint']};">
          © ${new Date().getFullYear()} ${escapeHtml(brand.copyright)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ---- Body parts --------------------------------------------------------------------------- */

export function emailParagraph(htmlInner: string): string {
  return `<p style="margin:0 0 14px;">${htmlInner}</p>`;
}

/** An info notice: the info-soft tint with its line, ink text (no coloured left border, R-02). */
export function emailCallout(htmlInner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:separate;">
  <tr>
    <td class="sp-callout" bgcolor="${LIGHT['info-soft']}" style="padding:12px 16px;background-color:${LIGHT['info-soft']};border:${HAIRLINE} solid ${LIGHT['info-line']};border-radius:${RADIUS};font-family:${SANS};font-size:14px;line-height:20px;color:${LIGHT.ink};">${htmlInner}</td>
  </tr>
</table>`;
}

/** Labels whose values are identifiers, shown in the mono face (CIN, DIN, PAN, SRN, ARN ...). */
const IDENTIFIER_LABEL = /\b(CIN|DIN|PAN|TAN|SRN|ARN|GSTIN|LLPIN|FCRN|password)\b/i;
/** An identifier keyword followed by its code, inside already escaped text. */
const IDENTIFIER_IN_TEXT = /\b(CIN|DIN|PAN|TAN|SRN|ARN|GSTIN|LLPIN|FCRN)(:?\s+)([A-Z0-9][A-Z0-9-]{4,})\b/g;

/** Wrap a run of text in the identifier face. `htmlInner` must already be escaped. */
export function emailMono(htmlInner: string): string {
  return `<span style="font-family:${MONO};font-weight:500;letter-spacing:0;">${htmlInner}</span>`;
}

/** Put the code after CIN / DIN / PAN / SRN / ARN in the mono face; the words stay the same. */
export function emailIdentifiers(escapedText: string): string {
  return escapedText.replace(IDENTIFIER_IN_TEXT, (_m, word: string, gap: string, code: string) => `${word}${gap}${emailMono(code)}`);
}

export function emailMetaTable(rows: Array<{ label: string; value: string }>): string {
  const cells = rows
    .map((r, i) => {
      const top = i === 0 ? '' : `border-top:${HAIRLINE} solid ${LIGHT['line-soft']};`;
      const value = IDENTIFIER_LABEL.test(r.label) ? emailMono(escapeHtml(r.value)) : emailIdentifiers(escapeHtml(r.value));
      return `
    <tr>
      <td class="sp-sunken sp-muted sp-line-soft" bgcolor="${LIGHT['surface-sunken']}" style="padding:10px 14px;background-color:${LIGHT['surface-sunken']};color:${LIGHT['ink-muted']};width:38%;${top}font-family:${SANS};font-size:13px;line-height:18px;">${escapeHtml(r.label)}</td>
      <td class="sp-ink sp-line-soft" style="padding:10px 14px;${top}font-family:${SANS};font-size:14px;line-height:20px;color:${LIGHT.ink};font-weight:500;">${value}</td>
    </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sp-line" style="width:100%;margin:8px 0 18px;border:${HAIRLINE} solid ${LIGHT.line};border-radius:${RADIUS};border-collapse:separate;border-spacing:0;overflow:hidden;">${cells}</table>`;
}

/** Section label (the Spectrum `label` style): 11px, 600, tracked, uppercase by style only. */
export function emailLabel(text: string): string {
  return `<p class="sp-muted" style="margin:18px 0 8px;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${LIGHT['ink-muted']};font-weight:600;">${escapeHtml(text)}</p>`;
}

/**
 * Group heading inside the body (the Spectrum `title` style). `htmlInner` must already be escaped.
 * A status word at its start ("Overdue", "Due this week", "Waiting on clients") gets its tone's dot.
 */
export function emailHeading(htmlInner: string, opts: { status?: string } = {}): string {
  const tone = opts.status !== undefined ? emailStatusTone(opts.status) : null;
  const dot = tone
    ? `<span class="sp-dot-${tone}" style="display:inline-block;width:8px;height:8px;margin:0 8px 1px 0;border-radius:2px;background-color:${LIGHT[TONE_TOKENS[tone].mid]};vertical-align:middle;"></span>`
    : '';
  return `<h2 class="sp-ink" style="margin:24px 0 8px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:600;color:${LIGHT.ink};">${dot}${htmlInner}</h2>`;
}

/** Secondary text (ink-muted). `htmlInner` must already be escaped. */
export function emailMuted(htmlInner: string, size: 12 | 13 = 13): string {
  return `<span class="sp-muted" style="font-size:${size}px;line-height:${size + 5}px;color:${LIGHT['ink-muted']};">${htmlInner}</span>`;
}

/** Primary text (ink), for names and titles inside the body. `htmlInner` must already be escaped. */
export function emailInk(htmlInner: string, weight: 400 | 500 | 600 = 600): string {
  return `<span class="sp-ink" style="color:${LIGHT.ink};font-weight:${weight};">${htmlInner}</span>`;
}

/** A text link in brand-text. `label` is plain text. */
export function emailLink(href: string, label: string, opts: { bold?: boolean } = {}): string {
  return `<a href="${escapeHtml(href)}" class="sp-link" style="color:${LIGHT['brand-text']};text-decoration:none;${opts.bold ? 'font-weight:600;' : ''}">${escapeHtml(label)}</a>`;
}

/** A quoted message: sunken ground, line-strong edge all round (no coloured left border, R-02). */
export function emailQuote(htmlInner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;border-collapse:separate;">
  <tr>
    <td class="sp-quote" bgcolor="${LIGHT['surface-sunken']}" style="padding:10px 14px;background-color:${LIGHT['surface-sunken']};border:${HAIRLINE} solid ${LIGHT['line-strong']};border-radius:${RADIUS};color:${LIGHT['ink-2']};white-space:pre-wrap;">${htmlInner}</td>
  </tr>
</table>`;
}

/** "Regards, name, email" under the body. */
export function emailSignature(name: string, email: string): string {
  return `<p class="sp-ink2" style="margin:0;font-family:${SANS};font-size:14px;line-height:22px;color:${LIGHT['ink-2']};">Regards,<br/><strong class="sp-ink" style="color:${LIGHT.ink};font-weight:600;">${escapeHtml(name)}</strong><br/>${emailLink(`mailto:${email}`, email)}</p>`;
}

/* ---- Buttons (ui/button-variants.ts, R-12) ------------------------------------------------- */

type EmailButtonVariant = 'primary' | 'secondary';
type EmailButtonSize = 'sm' | 'default' | 'lg';
/** Heights 30 / 36 / 42px as padding around the label, so every client sizes them the same. */
const BUTTON_SIZE: Record<EmailButtonSize, { pad: string; font: number; line: number }> = {
  sm: { pad: '6px 10px', font: 13, line: 18 },
  default: { pad: '8px 14px', font: 14, line: 20 },
  lg: { pad: '11px 18px', font: 15, line: 20 },
};

/**
 * A button as a link: `primary` is the brand fill with on-brand text, `secondary` the raised fill
 * with a line-strong edge. 6px corners, weight 500. `margin` spaces buttons that sit in a row.
 */
export function emailButton(
  label: string,
  href: string,
  opts: { variant?: EmailButtonVariant; size?: EmailButtonSize; margin?: string } = {},
): string {
  const size = BUTTON_SIZE[opts.size ?? 'default'];
  const primary = (opts.variant ?? 'primary') === 'primary';
  const colours = primary
    ? `background-color:${LIGHT.brand};color:${LIGHT['on-brand']};border:${HAIRLINE} solid ${LIGHT.brand};`
    : `background-color:${LIGHT['surface-raised']};color:${LIGHT.ink};border:${HAIRLINE} solid ${LIGHT['line-strong']};`;
  return `<a href="${escapeHtml(href)}" class="${primary ? 'sp-btn' : 'sp-btn2'}" style="display:inline-block;${opts.margin ? `margin:${opts.margin};` : ''}padding:${size.pad};${colours}border-radius:${RADIUS};font-family:${SANS};font-size:${size.font}px;line-height:${size.line}px;font-weight:500;text-decoration:none;mso-padding-alt:0;">${escapeHtml(label)}</a>`;
}

/* ---- Status words (spectrum-chip.tsx, R-13) ------------------------------------------------ */

/** A status at the start of a label, read as one of the six words. */
const LEADING_STATUS: Array<[RegExp, SixWord]> = [
  [/^(not started|not due|upcoming|planned|scheduled)\b/i, 'Not started'],
  [/^(in progress|in review|under review|processing|drafting)\b/i, 'In progress'],
  [/^(waiting|awaiting|pending|with client|on hold)\b/i, 'Waiting'],
  [/^(overdue|late|failed|rejected|expired|stuck)\b/i, 'Overdue'],
  [/^(due|at risk|expiring)\b/i, 'Due soon'],
  [/^(done|complete|completed|filed|approved|paid|resolved|collected)\b/i, 'Done'],
];

/** The tone of a status label ("Overdue, daily", "Due today", "Waiting on clients"), or null. */
export function emailStatusTone(label: string): ChipTone | null {
  const text = label.trim();
  const hit = LEADING_STATUS.find(([re]) => re.test(text));
  return hit ? SIX_TONE[hit[1]] : null;
}

/** A status as a coloured word; the text is kept exactly as given. Plain when it is not a status. */
export function emailStatusWord(label: string, tone: ChipTone | null = emailStatusTone(label)): string {
  if (!tone) return escapeHtml(label);
  return `<span class="sp-word-${tone}" style="color:${LIGHT[TONE_TOKENS[tone].fg]};font-weight:600;">${escapeHtml(label)}</span>`;
}

/** A status chip: tone-soft ground, tone word, 7px square dot, 6px corners, 12px weight 500. */
export function emailStatusChip(label: string, tone: ChipTone | null = emailStatusTone(label)): string {
  const t = TONE_TOKENS[tone ?? 'idle'];
  const cls = tone ?? 'idle';
  return `<span class="sp-tone-${cls}" style="display:inline-block;padding:3px 9px;border-radius:${RADIUS};background-color:${LIGHT[t.soft]};color:${LIGHT[t.fg]};font-family:${SANS};font-size:12px;line-height:16px;font-weight:500;white-space:nowrap;"><span class="sp-dot-${cls}" style="display:inline-block;width:7px;height:7px;margin:0 7px 1px 0;border-radius:2px;background-color:${LIGHT[t.mid]};vertical-align:middle;"></span>${escapeHtml(label)}</span>`;
}
