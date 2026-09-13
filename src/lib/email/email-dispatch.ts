/**
 * Shared email-dispatch summary (safe for client + server).
 * API routes include this on responses so the UI can toast.
 */

/** Lead → client compose payload (sent via Graph Mail.Send after in-app edit). */
export type OutgoingEmailDraft = {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  engagementId?: string;
  companyName?: string;
  itemId?: string;
};

export type EmailDispatchResult = {
  attempted: number;
  /** Addresses that the provider accepted. */
  sent: string[];
  /** Addresses skipped because email is not configured. */
  skipped: string[];
  /** Addresses that failed to send. */
  failed: string[];
  /** Subjects of outbound messages (for Sent tab / toasts). */
  subjects?: string[];
  /** Last provider error (safe to show in a toast). */
  error?: string;
  /** When set, UI should open compose instead of auto-sending to clients. */
  outgoingDraft?: OutgoingEmailDraft;
};

export function emptyEmailDispatch(): EmailDispatchResult {
  return { attempted: 0, sent: [], skipped: [], failed: [], subjects: [] };
}

export function formatEmailRecipients(emails: string[]): string {
  const unique = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]} and ${unique.length - 1} others`;
}

export function pushEmailSubject(
  email: EmailDispatchResult,
  subject: string | null | undefined,
): void {
  const s = subject?.trim();
  if (!s) return;
  if (!email.subjects) email.subjects = [];
  if (!email.subjects.includes(s)) email.subjects.push(s);
}

/** Stable react-hot-toast id so retries replace instead of stacking. */
export function emailDispatchToastId(
  draft: { kind: string; title: string },
  meta?: { engagementId?: string; itemId?: string },
): string {
  return ['email-dispatch', draft.kind, meta?.engagementId, meta?.itemId, draft.title]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(':');
}
