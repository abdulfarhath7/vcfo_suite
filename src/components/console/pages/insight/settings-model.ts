/**
 * SETTINGS — the pure half: what the live Account settings (src/views/settings/
 * AccountSettings.tsx) sends and says, kept word for word so every setting
 * saves exactly as live. No React, no fetch.
 */
import { normalizeToE164 } from '@/lib/notify/phone';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import { sentenceCase } from './fmt';

export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  /** WhatsApp destination in E.164; '' when never given. */
  phoneE164: string;
  whatsappOptIn: boolean;
  role: string;
  avatarUrl: string | null;
}

export interface ProfileDraft {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  optIn: boolean;
  /** current password, only asked when the email changes */
  password: string;
}

/** GET /api/account/profile → the live view's profile shape. */
export function profileFromApi(p: {
  name: string;
  email: string;
  phone?: string | null;
  phoneE164?: string | null;
  whatsappOptIn?: boolean;
  role: string;
  avatarUrl?: string | null;
}): ProfileData {
  return {
    name: p.name,
    email: p.email,
    phone: p.phone ?? '',
    phoneE164: p.phoneE164 ?? '',
    whatsappOptIn: Boolean(p.whatsappOptIn),
    role: p.role,
    avatarUrl: p.avatarUrl ?? null,
  };
}

export const draftOf = (p: ProfileData): ProfileDraft => ({ name: p.name, email: p.email, phone: p.phone, whatsapp: p.phoneE164, optIn: p.whatsappOptIn, password: '' });

export const emailChanging = (p: ProfileData, d: ProfileDraft): boolean => d.email.trim().toLowerCase() !== p.email.toLowerCase();

export function isDirty(p: ProfileData, d: ProfileDraft): boolean {
  return d.name !== p.name || d.email !== p.email || d.phone !== p.phone || d.whatsapp !== p.phoneE164 || d.optIn !== p.whatsappOptIn;
}

/** The live PATCH /api/account/profile body. */
export function profileBody(p: ProfileData, d: ProfileDraft): Record<string, unknown> {
  const e164 = normalizeToE164(d.whatsapp);
  return {
    name: d.name.trim(),
    phone: d.phone.trim() || null,
    phoneE164: e164,
    // Consent only counts with a usable number behind it.
    whatsappOptIn: d.optIn && Boolean(e164),
    email: d.email.trim().toLowerCase(),
    ...(emailChanging(p, d) ? { currentPassword: d.password } : {}),
  };
}

/** The profile after a successful save, as the live view keeps it. */
export function savedProfile(p: ProfileData, d: ProfileDraft, resp: { name: string; email: string; phone: string | null }): ProfileData {
  const e164 = normalizeToE164(d.whatsapp);
  return { name: resp.name, email: resp.email, phone: resp.phone ?? '', phoneE164: e164 ?? '', whatsappOptIn: d.optIn && Boolean(e164), role: p.role, avatarUrl: p.avatarUrl };
}

/** The live messages for the two known profile errors; others fall to errorMessage(). */
export function profileErrorText(code: string): string | null {
  if (code === 'invalid_credentials') return 'Current password is incorrect.';
  if (code === 'email_already_registered') return 'That email is already in use.';
  return null;
}

/** The live password checks, before anything is sent. */
export function passwordProblem(next: string, confirm: string): { title: string; desc: string } | null {
  if (next.length < 8) return { title: 'Password too short', desc: 'Use at least 8 characters.' };
  if (next !== confirm) return { title: "Passwords don't match", desc: 'Re-enter the same new password in both fields.' };
  return null;
}

export function avatarErrorText(code: string): string | null {
  if (code === 'file_too_large') return 'That image is too large. Try a smaller photo.';
  if (code === 'unsupported_type') return 'Use a JPEG, PNG, WebP, or GIF.';
  return null;
}

export function outlookPhotoErrorText(code: string): string | null {
  if (code === 'outlook_not_connected') return 'Connect Outlook in the Outlook section, then try again.';
  if (code === 'outlook_photo_missing') return 'No photo on this Microsoft account.';
  return null;
}

export const WHATSAPP_TEST_REASON: Record<string, string> = {
  disabled: 'WhatsApp is switched off on the server (WHATSAPP_ENABLED or the sender number is not set).',
  no_template: 'The WhatsApp message template is not approved on Meta yet.',
  no_phone: 'Add your WhatsApp number with the country code first.',
  no_consent: 'Tick “Send me WhatsApp updates”, then save.',
  opted_out: 'You replied STOP earlier. Tick the consent box again to turn updates back on.',
  too_soon: 'A test was just sent. Wait 30 seconds before sending another.',
};

export function whatsappTestText(body: { reason?: string; error?: string }): string {
  const key = body.reason ?? body.error ?? '';
  return WHATSAPP_TEST_REASON[key] ?? (body.error || 'The message could not be sent.');
}

/** The Outlook callback's return (`?outlook=connected` / `?outlook=error&reason=`), and the query without it. */
export function readOutlookReturn(search: string): { result: 'connected' | 'error' | null; reason: string; rest: string } {
  const params = new URLSearchParams(search);
  const v = params.get('outlook');
  const reason = params.get('reason')?.trim() ?? '';
  params.delete('outlook');
  params.delete('reason');
  return { result: v ? (v === 'connected' ? 'connected' : 'error') : null, reason, rest: params.toString() };
}

export const roleLabelOf = (role: string): string => (role ? sentenceCase(ROLE_UI_LABEL[role as Role] ?? role) : '—');

/** The live rule: staff (not clients) link a mailbox and may use its photo. */
export const isStaffRole = (role: string): boolean => role === 'super_admin' || role === 'admin' || role === 'manager' || role === 'intern';
