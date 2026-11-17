import 'server-only';

/**
 * DOUBLETICK WhatsApp transport (receivables v2, docs/specs/receivables/V2.md).
 *
 * Ported from the owner's Litigation Command Center (`lcc/src-tauri/src/notify/whatsapp.rs`,
 * decision D-120 there) and adapted to this codebase: the firm's WhatsApp Business number already
 * runs on DoubleTick, a Meta BSP, so messages go through DoubleTick's public API with the account
 * key, from that number.
 *
 * What LCC learnt against the live API, kept here:
 *  - The base URL is `https://public.doubletick.io`; `Authorization` takes the raw key (no "Bearer").
 *  - A template goes to `POST /whatsapp/message/template` inside a `messages` list, each with
 *    `from`, `to` and `content: { templateName, language, templateData: { body: { placeholders } } }`.
 *    Placeholders are positional (`{{1}}`, `{{2}}` …). DoubleTick refuses a template whose body
 *    starts or ends with a variable.
 *  - Plain text goes to `POST /whatsapp/message/text` with a flat body `{ from, to, content: { text } }`.
 *    WhatsApp delivers it only inside the 24 hours after the person last wrote to the number, so it
 *    is for the "Send test message" button; anything else needs an approved template.
 *  - 401 or 403 means the key was refused; 429 is a rate limit worth retrying; a 200 whose first
 *    message has `status: FAILED` is a refusal with `errorMessage`.
 *
 * Settings (server-only env; the key never reaches the browser bundle):
 *  - DOUBLETICK_API_KEY       the account API key.
 *  - DOUBLETICK_BASE_URL      optional, defaults to https://public.doubletick.io.
 *  - DOUBLETICK_FROM_NUMBER   the firm's WhatsApp Business number, for example +91 90140 79600.
 *  - DOUBLETICK_TEMPLATE_LANG optional, defaults to `en`.
 *  - DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT the approved template of the receivables ping
 *    (four placeholders: subject, recipient name, recipient email, what it was about). Without it
 *    the ping falls back to plain text, which only arrives inside the 24-hour window.
 *
 * Contract: `sendDoubleTickMessage` NEVER throws. Every outcome comes back as a value.
 */

export const DOUBLETICK_DEFAULT_BASE_URL = 'https://public.doubletick.io';

export type DoubleTickConfig = {
  apiKey: string;
  baseUrl: string;
  fromNumber: string;
  templateLanguage: string;
  receivablesTemplate: string;
};

export function readDoubleTickConfig(env: NodeJS.ProcessEnv = process.env): DoubleTickConfig {
  return {
    apiKey: env.DOUBLETICK_API_KEY?.trim() ?? '',
    baseUrl: (env.DOUBLETICK_BASE_URL?.trim() || DOUBLETICK_DEFAULT_BASE_URL).replace(/\/+$/, ''),
    fromNumber: env.DOUBLETICK_FROM_NUMBER?.trim() ?? '',
    templateLanguage: env.DOUBLETICK_TEMPLATE_LANG?.trim() || 'en',
    receivablesTemplate: env.DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT?.trim() ?? '',
  };
}

/** The env var names still missing for DoubleTick to send (the People tab shows them). */
export function doubleTickMissing(config: DoubleTickConfig = readDoubleTickConfig()): string[] {
  const missing: string[] = [];
  if (!config.apiKey) missing.push('DOUBLETICK_API_KEY');
  if (!digits(config.fromNumber)) missing.push('DOUBLETICK_FROM_NUMBER');
  return missing;
}

export function isDoubleTickConfigured(config: DoubleTickConfig = readDoubleTickConfig()): boolean {
  return doubleTickMissing(config).length === 0;
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

/** `+<digits>`, the number form DoubleTick takes for both `from` and `to`. */
export function doubleTickNumber(s: string): string {
  return `+${digits(s)}`;
}

export type DoubleTickResult = { ok: true; messageId: string | null } | { ok: false; error: string; permanent: boolean };

/** DoubleTick's error as a short reason, and whether sending again could help (as LCC's `dt_error`). */
export function doubleTickError(body: unknown, http: number): { error: string; permanent: boolean } {
  const raw = body && typeof body === 'object' ? (body as { message?: unknown }).message : undefined;
  const msg = Array.isArray(raw) ? raw.filter((m) => typeof m === 'string').join('; ') : typeof raw === 'string' ? raw : '';
  let error: string;
  if (http === 401 || http === 403) error = 'The DoubleTick API key was refused';
  else if (http === 429) error = 'DoubleTick rate limit; try again later';
  else error = msg ? `DoubleTick ${http}: ${msg}` : `DoubleTick ${http}`;
  return { error, permanent: http >= 400 && http < 500 && http !== 429 };
}

/** Text that is safe as a template placeholder: no new lines or tabs, no four spaces in a row (Meta's rules). */
function placeholder(v: string): string {
  return v.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 1000) || '-';
}

/**
 * Sends one WhatsApp message through DoubleTick: an approved template when `templateName` is given
 * (with `variables` as its positional placeholders), else plain `text`.
 */
export async function sendDoubleTickMessage(input: {
  to: string;
  templateName?: string | null;
  text?: string | null;
  variables?: string[];
  config?: DoubleTickConfig;
  fetchImpl?: typeof fetch;
}): Promise<DoubleTickResult> {
  const config = input.config ?? readDoubleTickConfig();
  if (!isDoubleTickConfigured(config)) return { ok: false, error: 'doubletick_not_configured', permanent: true };
  const to = doubleTickNumber(input.to);
  if (to.length < 9) return { ok: false, error: 'no_phone', permanent: true };
  const from = doubleTickNumber(config.fromNumber);
  const name = input.templateName?.trim();
  let path: string;
  let body: unknown;
  if (name) {
    const vars = (input.variables ?? []).map(placeholder);
    const content: Record<string, unknown> = { templateName: name, language: config.templateLanguage };
    if (vars.length) content.templateData = { body: { placeholders: vars } };
    path = '/whatsapp/message/template';
    body = { messages: [{ from, to, content }] };
  } else {
    const text = input.text?.trim();
    if (!text) return { ok: false, error: 'DoubleTick: nothing to send', permanent: true };
    path = '/whatsapp/message/text';
    body = { from, to, content: { text: text.slice(0, 4000) } };
  }
  const doFetch = input.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return { ok: false, error: `DoubleTick unreachable: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), permanent: false };
  }
  const json: unknown = await res.json().catch(() => null);
  if (res.status >= 500) return { ok: false, error: `DoubleTick ${res.status}`, permanent: false };
  if (!res.ok) return { ok: false, ...doubleTickError(json, res.status) };
  const obj = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const first = (Array.isArray(obj.messages) && obj.messages[0] && typeof obj.messages[0] === 'object' ? obj.messages[0] : obj) as Record<string, unknown>;
  const state = typeof first.status === 'string' ? first.status.toUpperCase() : '';
  if (state === 'FAILED') {
    const why = typeof first.errorMessage === 'string' ? first.errorMessage : 'DoubleTick refused the message';
    const lower = why.toLowerCase();
    return { ok: false, error: `DoubleTick: ${why}`.slice(0, 300), permanent: lower.includes('not on whatsapp') || lower.includes('24') };
  }
  const id = typeof first.messageId === 'string' ? first.messageId : typeof first.id === 'string' ? first.id : null;
  return { ok: true, messageId: id };
}
