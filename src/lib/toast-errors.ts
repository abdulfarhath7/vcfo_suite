import toast from 'react-hot-toast';
import {
  getToastVariantStyle,
  infoToastIcon,
  warningToastIcon,
} from '@/components/ui/hot-toast';
import {
  formatEmailRecipients,
  type EmailDispatchResult,
} from '@/lib/email/email-dispatch';
import type { NotificationKind } from '@/lib/checklist-notifications';

const ERROR_DURATION_MS = 6000;
const SUCCESS_DURATION_MS = 4500;
const WARNING_DURATION_MS = 5500;

const NETWORK_MESSAGE =
  'No internet connection. Check your network and try again.';

export interface ApiErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  error?: string;
}

export class AppApiError extends Error {
  readonly code?: string;
  readonly kind: 'network' | 'database' | 'auth' | 'validation' | 'server' | 'unknown';

  constructor(
    message: string,
    options?: {
      code?: string;
      kind?: AppApiError['kind'];
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'AppApiError';
    this.code = options?.code;
    this.kind = options?.kind ?? 'unknown';
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const CODE_MESSAGES: Record<string, string> = {
  '42703': 'Database setup incomplete — contact support.',
  '42P01': 'Database setup incomplete — contact support.',
  PGRST116: 'Not found or you do not have access.',
  PGRST204: 'Database setup incomplete — contact support.',
  '23505': 'That record already exists.',
  '23503': 'This item is linked to other data and cannot be removed.',
  '42501': 'You do not have permission for this action.',
  invalid_credentials: 'Invalid email or password.',
  user_not_found: 'No account found for that email.',
  email_not_confirmed: 'Confirm your email before signing in.',
};

function looksLikeDatabaseMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('42703') ||
    lower.includes('42p01') ||
    lower.includes('does not exist') ||
    lower.includes('duplicate key') ||
    lower.includes('23505') ||
    lower.includes('violates foreign key') ||
    lower.includes('permission denied') ||
    lower.includes('pgrst')
  );
}

function readMessage(err: unknown): string | undefined {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === 'object' && err !== null) {
    const record = err as ApiErrorLike;
    if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
    if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
  }
  return undefined;
}

function readCode(err: unknown): string | undefined {
  if (err instanceof AppApiError && err.code) return err.code;
  if (err instanceof Error && 'code' in err) {
    const code = (err as Error & { code?: string }).code;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  if (typeof err === 'object' && err !== null) {
    const code = (err as ApiErrorLike).code;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  return undefined;
}

/** True only for genuine transport / offline failures — not API or database errors. */
function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof AppApiError && err.kind === 'network') return true;

  if (err instanceof TypeError) {
    const lower = err.message.toLowerCase();
    return (
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('network request failed') ||
      lower.includes('load failed')
    );
  }

  const message = readMessage(err)?.toLowerCase() ?? '';
  if (!message) return false;
  if (looksLikeDatabaseMessage(message)) return false;

  return (
    message === 'failed to fetch' ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('failed to send a request to the edge function') ||
    message.includes('err_internet_disconnected') ||
    message.includes('err_network_changed')
  );
}

export function mapSupabaseError(
  code: string | undefined,
  rawMessage: string,
): string {
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const lower = rawMessage.toLowerCase();
  if (lower.includes('column') && lower.includes('does not exist')) {
    return CODE_MESSAGES['42703'];
  }
  if (lower.includes('relation') && lower.includes('does not exist')) {
    return CODE_MESSAGES['42P01'];
  }
  if (lower.includes('duplicate key') || lower.includes('23505')) {
    return CODE_MESSAGES['23505'];
  }
  if (lower.includes('permission denied') || lower.includes('42501')) {
    return CODE_MESSAGES['42501'];
  }
  if (lower.includes('jwt') || lower.includes('session') || lower.includes('not authenticated')) {
    return 'Session expired — sign in again.';
  }
  if (lower.includes('edge function returned a non-2xx')) {
    return 'The server could not complete this request. Try again or contact support.';
  }

  return rawMessage;
}

/** Extract a user-facing message from unknown thrown values. */
export function errorMessage(err: unknown, fallback = 'Try again in a moment.'): string {
  if (isNetworkError(err)) return NETWORK_MESSAGE;

  const raw = readMessage(err);
  if (!raw) return fallback;

  return mapSupabaseError(readCode(err), raw);
}

export function fromPostgrestError(error: ApiErrorLike, fallback = 'Request failed.'): AppApiError {
  const raw = error.message?.trim() || fallback;
  const code = error.code?.trim();
  const kind =
    code === '42501'
      ? 'auth'
      : code === '42703' || code === '42P01' || code === 'PGRST204' || looksLikeDatabaseMessage(raw)
        ? 'database'
        : 'server';

  return new AppApiError(mapSupabaseError(code, raw), {
    code,
    kind,
    cause: error,
  });
}

export async function fromFunctionInvokeError(
  error: unknown,
  data: unknown,
  fallback = 'Failed to create project.',
): Promise<AppApiError> {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const bodyError = (data as { error?: string }).error;
    if (bodyError?.trim()) {
      return new AppApiError(mapSupabaseError(undefined, bodyError.trim()), {
        kind: looksLikeDatabaseMessage(bodyError) ? 'database' : 'server',
        cause: error,
      });
    }
  }

  if (typeof error === 'object' && error !== null && 'context' in error) {
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      try {
        const body = (await response.clone().json()) as { error?: string; message?: string };
        const bodyError = body.error?.trim() || body.message?.trim();
        if (bodyError) {
          return new AppApiError(mapSupabaseError(undefined, bodyError), {
            kind: looksLikeDatabaseMessage(bodyError) ? 'database' : 'server',
            cause: error,
          });
        }
      } catch {
        // Ignore malformed JSON bodies.
      }
    }
  }

  if (isNetworkError(error)) {
    return new AppApiError(NETWORK_MESSAGE, { kind: 'network', cause: error });
  }

  const raw = readMessage(error) ?? fallback;
  return new AppApiError(mapSupabaseError(readCode(error), raw), {
    code: readCode(error),
    kind: 'server',
    cause: error,
  });
}

function toastMessage(title: string, description?: string): string {
  if (!description) return title;
  return `${title} — ${description}`;
}

export function toastError(title: string, description?: string) {
  toast.error(toastMessage(title, description), {
    duration: ERROR_DURATION_MS,
  });
}

export function toastSuccess(title: string, description?: string) {
  toast.success(toastMessage(title, description), {
    duration: SUCCESS_DURATION_MS,
  });
}

export function toastWarning(title: string, description?: string) {
  toast(toastMessage(title, description), {
    duration: WARNING_DURATION_MS,
    icon: warningToastIcon(),
    style: getToastVariantStyle('warning'),
  });
}

export function toastInfo(title: string, description?: string) {
  toast(toastMessage(title, description), {
    duration: SUCCESS_DURATION_MS,
    icon: infoToastIcon(),
    style: getToastVariantStyle('info'),
  });
}

export const EMAIL_DISPATCH_NOTIFICATIONS_EVENT = 'vcfo:notifications-refresh';

export type EmailDispatchToastMeta = {
  engagementId?: string;
  companyName?: string;
  itemId?: string;
  href?: string;
};

function emailNotificationDraft(
  email: EmailDispatchResult,
  meta?: EmailDispatchToastMeta,
): {
  kind: NotificationKind;
  title: string;
  body: string;
  engagementId: string;
  companyName: string;
  itemId?: string;
  href: string;
} | null {
  if (email.attempted === 0) return null;

  if (email.sent.length > 0) {
    return {
      kind: 'email.sent',
      title: 'Email sent',
      body: formatEmailRecipients(email.sent),
      engagementId: meta?.engagementId ?? '',
      companyName: meta?.companyName ?? '',
      itemId: meta?.itemId,
      href: meta?.href ?? '#',
    };
  }
  if (email.skipped.length > 0) {
    return {
      kind: 'email.skipped',
      title: 'Email not configured',
      body: `Would send to ${formatEmailRecipients(email.skipped)}. Set EMAIL_PROVIDER and From (EMAIL_FROM / RESEND_FROM_EMAIL) — plus RESEND_API_KEY for Resend, or SES identity for SES.`,
      engagementId: meta?.engagementId ?? '',
      companyName: meta?.companyName ?? '',
      itemId: meta?.itemId,
      href: meta?.href ?? '#',
    };
  }
  if (email.failed.length > 0) {
    return {
      kind: 'email.failed',
      title: "Email didn't send",
      body: `Could not deliver to ${formatEmailRecipients(email.failed)}.`,
      engagementId: meta?.engagementId ?? '',
      companyName: meta?.companyName ?? '',
      itemId: meta?.itemId,
      href: meta?.href ?? '#',
    };
  }
  return null;
}

function persistEmailDispatchNotification(
  draft: NonNullable<ReturnType<typeof emailNotificationDraft>>,
) {
  if (typeof window === 'undefined') return;
  void fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification: draft }),
  })
    .catch(() => {
      /* toast already shown; bell will catch up on next poll */
    })
    .finally(() => {
      window.dispatchEvent(new CustomEvent(EMAIL_DISPATCH_NOTIFICATIONS_EVENT));
    });
}

/**
 * Toast after an API action that dispatched email(s), and add a matching
 * row to the notifications bell.
 */
export function toastEmailDispatch(
  email: EmailDispatchResult | null | undefined,
  meta?: EmailDispatchToastMeta,
) {
  if (!email || email.attempted === 0) return;

  const draft = emailNotificationDraft(email, meta);
  if (!draft) return;

  if (draft.kind === 'email.sent') {
    toastSuccess(draft.title, draft.body);
  } else {
    toastWarning(draft.title, draft.body);
  }

  persistEmailDispatchNotification(draft);
}

export { toast };
