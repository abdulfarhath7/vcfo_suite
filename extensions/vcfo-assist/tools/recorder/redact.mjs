// Redaction for the portal recorder (tools/recorder/recorder.mjs). Pure functions, so they are
// tested (src/recorder/recorder.test.ts). Nothing the recorder writes skips these.
//
// The rules (README.md in this folder): no field value is ever stored; no cookie, Set-Cookie,
// Authorization, token, session, auth, key or CSRF header or parameter; no request or response
// body; PAN, Aadhaar, DIN, email and phone shaped text in saved pages is masked unless the capture
// is of a dummy client.

/** Secret-looking names: credentials, OTPs, captchas, tokens, sessions, keys. */
export const SECRET_NAME = /passw|pwd|passcode|(^|[^a-z])otp([^a-z]|$)|captcha|token|secret|session|sid$|jsessionid|auth|csrf|xsrf|api[-_]?key|cookie|mpin|cvv/i;

/** The only things kept about a network exchange. */
export const NETWORK_FIELDS = ['ts', 'step', 'type', 'method', 'path', 'status', 'contentType'];

const PII = [
  // Aadhaar: 12 digits, optionally in groups of four.
  { re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, mask: '[AADHAAR]' },
  { re: /\b[A-Z]{5}\d{4}[A-Z]\b/gi, mask: '[PAN]' },
  { re: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, mask: '[EMAIL]' },
  // Indian mobile numbers, with or without +91 / 0.
  { re: /(\+91[\s-]?|\b0)?\b[6-9]\d{9}\b/g, mask: '[PHONE]' },
  // DIN: eight digits.
  { re: /\b\d{8}\b/g, mask: '[DIN]' },
];

/** Masks PAN, Aadhaar, DIN, email and phone shaped text. */
export function maskPii(text) {
  let out = String(text ?? '');
  for (const { re, mask } of PII) out = out.replace(re, mask);
  return out;
}

/** A URL without its query string or fragment: the path is kept, every parameter value is dropped. */
export function stripQuery(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return String(url ?? '').split(/[?#]/)[0];
  }
}

/**
 * The network record: method, path (no query), status and content type. No headers, no cookies,
 * no bodies, whatever the request carried.
 */
export function networkRecord({ ts, step, type, method, url, status, contentType }) {
  return { ts, step, type, method, path: stripQuery(url), status, contentType: (contentType ?? '').split(';')[0] || undefined };
}

/**
 * Cleans a saved page or frame. Removes every inline script body (they can carry CSRF and session
 * tokens), every `value` attribute, the text inside textareas, `selected` and `checked` flags,
 * secret-looking meta tags, and query strings in href, src and action. With `dummyClient` false
 * (the default) it also masks PAN, Aadhaar, DIN, email and phone shaped text.
 */
export function redactHtml(html, { dummyClient = false } = {}) {
  let out = String(html ?? '');
  out = out.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1/* removed by the VCFO recorder */$2');
  out = out.replace(/(<textarea\b[^>]*>)[\s\S]*?(<\/textarea>)/gi, '$1$2');
  out = out.replace(/\s(value|data-value|data-val)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/\s(selected|checked)(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?(?=[\s>/])/gi, '');
  out = out.replace(/<meta\b[^>]*>/gi, (tag) => (SECRET_NAME.test(tag) ? '<meta name="removed-by-vcfo-recorder">' : tag));
  out = out.replace(/\s(href|src|action|data-url)\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m, attr, _q, dq, sq) => {
    const v = dq ?? sq ?? '';
    return ` ${attr}="${v.startsWith('data:') ? v.slice(0, 64) : v.split(/[?#]/)[0]}"`;
  });
  if (!dummyClient) {
    // Text between tags only; attribute names and ids stay readable.
    out = out.replace(/>([^<]+)</g, (_m, text) => `>${maskPii(text)}<`);
  }
  return out;
}

/** The element facts a capture keeps: never a value, only whether the control holds one. */
export function elementRecord(el, { dummyClient = false } = {}) {
  // camelCase and snake_case are split first, so `MobileOTP` and `captcha_text` read as words.
  const words = `${el.name ?? ''} ${el.id ?? ''} ${el.label ?? ''}`.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ');
  const secret = el.type === 'password' || el.autocomplete === 'one-time-code' || SECRET_NAME.test(words);
  const text = (t) => (t == null ? undefined : dummyClient ? String(t) : maskPii(t));
  const rec = {
    tag: el.tag,
    type: el.type,
    id: el.id,
    name: el.name,
    key: el.key,
    label: text(el.label),
    placeholder: text(el.placeholder),
    ariaLabel: text(el.ariaLabel),
    text: el.isButton ? text(el.text) : undefined,
    filled: el.hasValue ? 'yes' : 'no',
    secret: secret || undefined,
    required: el.required || undefined,
    disabled: el.disabled || undefined,
    maxlength: el.maxlength,
    visible: el.visible,
    css: el.css,
    // Option lists are the portal's own; a list the portal fills from the filing's people (names
    // with DINs) is masked like any other text.
    options: Array.isArray(el.options) ? el.options.map((o) => ({ v: secret ? '' : text(o.v), t: text(o.t) })) : undefined,
  };
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
  return rec;
}

/** A user event: what was touched, never what was typed. */
export function eventRecord(ev, { dummyClient = false } = {}) {
  const t = ev.target ?? {};
  const out = { kind: ev.kind, ts: ev.ts, step: ev.step, target: { tag: t.tag, type: t.type, id: t.id, name: t.name, key: t.key, label: dummyClient ? t.label : maskPii(t.label ?? '') || undefined } };
  if (t.isButton && t.text) out.target.text = dummyClient ? t.text : maskPii(t.text);
  if (ev.kind === 'change') out.filled = ev.hasValue ? 'yes' : 'no';
  if (ev.kind === 'key') out.key = ev.key === 'Enter' || ev.key === 'Tab' ? ev.key : undefined;
  if (ev.kind === 'navigate') out.url = stripQuery(ev.url);
  for (const k of Object.keys(out.target)) if (out.target[k] === undefined) delete out.target[k];
  return out;
}

/** Chrome flags and calls a recorder must never use: they hide automation or defeat portal controls. */
export const FORBIDDEN_RECORDER_CODE = [
  /AutomationControlled/,
  /ignoreDefaultArgs/,
  /navigator\s*,\s*['"]webdriver['"]/,
  /webdriver['"]?\s*[:,]\s*\{?\s*get/,
  /clientlib-devtool/,
  /disable-devtool/i,
  /stealth/i,
  /puppeteer-extra/,
];
