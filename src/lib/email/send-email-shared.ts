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
  /** Provider message id (e.g. Resend) when the API accepted the send. */
  providerMessageId?: string;
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

/** RFC-ish From: quote the display name so Resend accepts it. */
export function quoteFromHeader(from: string): string {
  const raw = from.trim();
  if (!raw) return raw;
  const address = extractEmailAddress(raw);
  const nameMatch = raw.match(/^"?([^"<]*)"?\s*</);
  const name = nameMatch?.[1]?.trim() ?? '';
  const safe = name.replace(/[\r\n<>"]/g, '').replace(/\s+/g, ' ').trim();
  if (!safe || !address.includes('@')) return address.includes('@') ? address : raw;
  return `"${safe}" <${address}>`;
}

function pushUniqueFrom(out: string[], seen: Set<string>, raw?: string) {
  const v = raw?.trim();
  if (!v) return;
  const quoted = quoteFromHeader(v);
  const addr = extractEmailAddress(quoted);
  for (const candidate of [quoted, addr]) {
    const key = candidate.trim().toLowerCase();
    if (!candidate.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(candidate.trim());
  }
}

/**
 * From values to try with Resend. Custom display names and unverified
 * local-parts (e.g. info@ when only noreply@ is verified) are common 403s.
 */
export function resendFromCandidates(override?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  pushUniqueFrom(out, seen, override);
  pushUniqueFrom(out, seen, parseQuotedEnv(process.env.EMAIL_FROM));
  pushUniqueFrom(out, seen, parseQuotedEnv(process.env.SES_FROM_EMAIL));
  pushUniqueFrom(out, seen, parseQuotedEnv(process.env.RESEND_FROM_EMAIL));

  const firstAddr = out.map(extractEmailAddress).find((a) => a.includes('@'));
  const at = firstAddr?.lastIndexOf('@') ?? -1;
  const local = at > 0 ? firstAddr!.slice(0, at).toLowerCase() : '';
  const domain = at > 0 ? firstAddr!.slice(at + 1) : '';
  if (domain && local && local !== 'noreply') {
    pushUniqueFrom(out, seen, `VCFO Suite <noreply@${domain}>`);
  }
  return out;
}

export function parseProviderErrorMessage(body: string): string {
  const t = body.trim();
  if (!t) return '';
  try {
    const parsed = JSON.parse(t) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    /* plain text */
  }
  return t.slice(0, 280);
}

export function isRetryableFromIdentityError(status: number, message: string): boolean {
  if (status !== 403 && status !== 422) return false;
  const m = message.toLowerCase();
  return (
    m.includes('from') ||
    m.includes('domain') ||
    m.includes('not verified') ||
    m.includes('identity')
  );
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

/** Domain of the verified From (e.g. sbctrack.in). */
export function resolveFromEmailDomain(override?: string): string | undefined {
  const addr = extractEmailAddress(resolveFromEmail(override) ?? '');
  const at = addr.lastIndexOf('@');
  if (at <= 0) return undefined;
  const domain = addr.slice(at + 1).trim().toLowerCase();
  return domain.includes('.') ? domain : undefined;
}

/** RFC-ish local-part for company@domain From addresses. */
export function sanitizeEmailLocalPart(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 64);
  return s || 'project';
}

/**
 * Client → lead From: `{company_name}@verified-domain` (sanitized local-part).
 * Outlook can filter on that address. Falls back to `project@domain`.
 */
export function companyFromAddress(input: {
  slug?: string | null;
  companyName?: string | null;
  fromOverride?: string;
}): string | undefined {
  const domain = resolveFromEmailDomain(input.fromOverride);
  if (!domain) return undefined;
  const local = sanitizeEmailLocalPart(input.companyName || '');
  const display = (input.companyName?.trim() || local).replace(/[\r\n<>"]/g, '').trim() || local;
  return quoteFromHeader(`${display} <${local}@${domain}>`);
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
 *   `Priya Sharma via VCFO Suite <info@sbcllp.in>`
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
  if (!senderName || /[<>]/.test(senderName)) return quoteFromHeader(base);
  if (senderName.toLowerCase() === brand.toLowerCase()) return quoteFromHeader(base);

  return quoteFromHeader(`${senderName} via ${brand} <${address}>`);
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
