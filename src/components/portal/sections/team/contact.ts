/**
 * Contact helpers (copied from the previous portal's team/common.tsx — pure).
 */

/** Real contact deep links: WhatsApp, phone, email, Microsoft Teams. */
export function contactHref(kind: 'wa' | 'call' | 'email' | 'teams', c: { email?: string; phoneE164?: string; whatsappE164?: string }): string | null {
  const digits = (v?: string) => (v ?? '').replace(/[^\d]/g, '');
  if (kind === 'wa') return digits(c.whatsappE164 ?? c.phoneE164) ? `https://wa.me/${digits(c.whatsappE164 ?? c.phoneE164)}` : null;
  if (kind === 'call') return c.phoneE164 ? `tel:${c.phoneE164.replace(/\s+/g, '')}` : null;
  if (kind === 'email') return c.email ? `mailto:${c.email}` : null;
  return c.email ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(c.email)}` : null;
}

/** "+91 90597 90014" from "+919059790014". */
export function prettyPhone(e164?: string | null): string {
  if (!e164) return '';
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** A readable one-off temporary password (interim sign-in until the set-password link ships). */
export function makeTempPassword(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const a = 'abcdefghijkmnpqrstuvwxyz';
  const n = '23456789';
  const s = '#@!$%';
  const rnd = new Uint32Array(10);
  crypto.getRandomValues(rnd);
  const pick = (set: string, i: number) => set[rnd[i]! % set.length];
  return `${pick(A, 0)}${pick(a, 1)}${pick(a, 2)}${pick(a, 3)}${pick(s, 4)}${pick(n, 5)}${pick(n, 6)}${pick(n, 7)}${pick(A, 8)}${pick(a, 9)}`;
}

/** "Chrome on Windows" from this browser's user agent. */
export function thisDevice(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'this device';
  return `${b} on ${o}`;
}
