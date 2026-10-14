import type { SkipReason } from '@/lib/notify/types';

/**
 * Plain words for staff reading the Send log. PURE — no env, no db — so it can
 * run in the browser. Codes are Meta Cloud API codes (from EUM and the SNS
 * status events) or AWS SDK exception names; matching is case-insensitive.
 */

const ERROR_TEXT: Record<string, string> = {
  '131026': 'Number is not on WhatsApp',
  '132001': 'Template not approved on Meta under this name',
  '131047': 'More than 24 hours since the client last wrote; a template is needed',
  '132000': 'Template variables do not match the approved template',
  '132012': 'Template variables do not match the approved template',
  '132015': 'Template is paused on Meta',
  '132016': 'Template is disabled on Meta',
  '131049': 'Meta held the message back to protect the recipient',
  '100': 'WhatsApp rejected a parameter',
  accessdeniedexception: 'AWS account is not allowed to send WhatsApp',
  accessdeniedbymetaexception: 'Meta refused the send for this business account',
  validationexception: 'WhatsApp rejected the request',
  resourcenotfoundexception: 'WhatsApp sender number not found in AWS',
};

const RATE_LIMIT_CODES = new Set([
  '130429',
  '131048',
  '133016',
  'throttledrequestexception',
  'limitexceededexception',
]);

export function whatsappErrorText(code: string | null | undefined): string {
  const key = code?.trim().toLowerCase() ?? '';
  if (!key) return 'WhatsApp failed (no code)';
  if (RATE_LIMIT_CODES.has(key)) return 'WhatsApp rate limit; will retry';
  return ERROR_TEXT[key] ?? `WhatsApp failed (${code!.trim()})`;
}

const SKIP_TEXT: Record<SkipReason, string> = {
  disabled: 'WhatsApp is switched off',
  no_template: 'No approved template for this message',
  no_phone: 'No WhatsApp number on the profile',
  no_consent: 'Has not opted in to WhatsApp',
  opted_out: 'Replied STOP on WhatsApp',
};

export function skipReasonText(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return SKIP_TEXT[reason as SkipReason] ?? reason;
}
