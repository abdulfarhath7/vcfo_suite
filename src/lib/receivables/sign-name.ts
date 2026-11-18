/**
 * The sender's name in "Regards, <name>" (owner, 18 Nov 2026). Every receivables email wraps it in
 * one marked span, so the name box in the email pop-ups can change it in the body as the person
 * types, and the saved name signs the automatic emails too. Pure; safe in the browser.
 */

const ATTR = 'data-sign-name="1"';
const SPAN = /(<span data-sign-name="1">)([^<]*)(<\/span>)/g;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The marked span around a signer's name. */
export function signNameSpan(name: string): string {
  return `<span ${ATTR}>${esc(name.trim() || 'Accounts Team')}</span>`;
}

/** The body with every signer name replaced by `name`. */
export function withSignName(html: string, name: string): string {
  return html.replace(SPAN, (_m, open: string, _old: string, close: string) => `${open}${esc(name.trim() || 'Accounts Team')}${close}`);
}

/** A clean sign name: one line, at most 80 characters; empty means "use the profile name". */
export function cleanSignName(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s ? s.slice(0, 80) : null;
}
