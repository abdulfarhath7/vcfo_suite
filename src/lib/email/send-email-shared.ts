/**
 * Shared outbound email types + helpers.
 * Transports: Resend (default) or AWS SES — selected by EMAIL_PROVIDER.
 */

export type EmailProvider = 'resend' | 'ses';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  cc?: string[];
  /**
   * Reply-To — human who should receive replies (lead, client, manager).
   * Pass `Name <email@…>` or a bare address.
   */
  replyTo?: string | string[];
  /** Optional override; defaults to EMAIL_FROM / RESEND_FROM_EMAIL / SES_FROM_EMAIL. */
  from?: string;
  /** Tag for console logs when skipping (e.g. 'welcome', 'progress.client_submitted.lead'). */
  purpose?: string;
}

/** @deprecated Prefer SendEmailInput — kept for existing imports. */
export type SendResendEmailInput = SendEmailInput;

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  /** Present when To/Cc were rewritten via EMAIL_DEV_REDIRECT_TO / RESEND_DEV_REDIRECT_TO. */
  redirectedTo?: string;
  intendedTo?: string[];
  provider?: EmailProvider;
}

/** @deprecated Prefer SendEmailResult */
export type SendResendResult = SendEmailResult;

export function parseQuotedEnv(raw: string | undefined): string {
  const t = raw?.trim() ?? '';
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export function normalizeAddresses(to: string | string[] | undefined): string[] {
  if (!to) return [];
  return (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean);
}

/** Strip display name → bare email for providers that need an address only. */
export function extractEmailAddress(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m?.[1] ?? addr).trim();
}

export function resolveEmailProvider(): EmailProvider {
  const raw = (process.env.EMAIL_PROVIDER ?? 'resend').trim().toLowerCase();
  return raw === 'ses' ? 'ses' : 'resend';
}

/**
 * Verified From address.
 * Prefer EMAIL_FROM, then provider-specific, then legacy RESEND_FROM_EMAIL.
 */
export function resolveFromEmail(override?: string): string | undefined {
  const from =
    override?.trim() ||
    parseQuotedEnv(process.env.EMAIL_FROM) ||
    parseQuotedEnv(process.env.SES_FROM_EMAIL) ||
    parseQuotedEnv(process.env.RESEND_FROM_EMAIL);
  return from || undefined;
}

/** Explicit test redirect — do not infer from progress CC. */
export function resolveEmailDevRedirect(): string | null {
  const explicit =
    parseQuotedEnv(process.env.EMAIL_DEV_REDIRECT_TO) ||
    parseQuotedEnv(process.env.RESEND_DEV_REDIRECT_TO);
  return explicit ? explicit.toLowerCase() : null;
}

/** @deprecated Prefer resolveEmailDevRedirect */
export function resolveResendDevRedirect(): string | null {
  return resolveEmailDevRedirect();
}

/** Format `Name <email>` for Reply-To. */
export function formatReplyTo(
  party: { name?: string | null; email?: string | null } | null | undefined,
): string | undefined {
  const email = party?.email?.trim();
  if (!email) return undefined;
  const name = party?.name?.trim();
  if (name && !/[<>]/.test(name)) return `${name} <${email}>`;
  return email;
}

/**
 * From header that shows who sent the mail, while staying on the verified domain.
 *
 * Resend (and SES) require the address to be on a verified domain — you cannot
 * put a personal Gmail in From. Instead we use the firm mailbox and put the
 * human in the display name:
 *   `Priya Sharma via VCFO Suite <noreply@sbctrack.in>`
 *
 * Pair with Reply-To = the real person so replies reach them.
 */
export function formatFromWithSender(
  sender: { name?: string | null } | string | null | undefined,
  baseFrom?: string,
): string | undefined {
  const base = resolveFromEmail(baseFrom);
  if (!base) return undefined;

  const address = extractEmailAddress(base);
  const brandMatch = base.match(/^"?([^"<]+)"?\s*</);
  const brand = brandMatch?.[1]?.trim() || 'VCFO Suite';

  const senderName =
    typeof sender === 'string' ? sender.trim() : sender?.name?.trim() || '';
  if (!senderName || /[<>]/.test(senderName)) return base;
  if (senderName.toLowerCase() === brand.toLowerCase()) return base;

  return `${senderName} via ${brand} <${address}>`;
}

/** Optional default Reply-To from env. */
export function defaultReplyToFromEnv(): string | undefined {
  const raw =
    parseQuotedEnv(process.env.EMAIL_REPLY_TO) ||
    parseQuotedEnv(process.env.RESEND_REPLY_TO);
  return raw || undefined;
}

export function applyDevRedirect(input: {
  to: string[];
  cc: string[];
  subject: string;
  purpose: string;
}): {
  to: string[];
  cc: string[];
  subject: string;
  redirectedTo?: string;
  intendedTo?: string[];
} {
  const redirect = resolveEmailDevRedirect();
  if (!redirect || input.to.length === 0) {
    return { to: input.to, cc: input.cc, subject: input.subject };
  }

  const intended = [...new Set([...input.to, ...input.cc].map((e) => e.toLowerCase()))];
  const alreadyOnlyRedirect =
    intended.length === 1 && intended[0] === redirect.toLowerCase();
  if (alreadyOnlyRedirect) {
    return { to: input.to, cc: input.cc, subject: input.subject };
  }

  console.warn(
    `[email] ${input.purpose} redirected to ${redirect} (EMAIL_DEV_REDIRECT_TO / RESEND_DEV_REDIRECT_TO; intended ${intended.join(', ')})`,
  );

  return {
    to: [redirect],
    cc: [],
    subject: `[dev → ${intended.join(', ')}] ${input.subject}`,
    redirectedTo: redirect,
    intendedTo: intended,
  };
}
