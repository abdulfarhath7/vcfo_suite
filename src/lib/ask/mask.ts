/**
 * Masks identity numbers wherever text can reach chat, logs, stored prompts or a run trace. It runs
 * on text, so it also catches a number somebody pasted. GSTIN and CIN are public registry numbers
 * and stay readable; a PAN inside a GSTIN does not match, because it has no word boundary.
 */
const lastFour = (value: string): string => {
  const compact = value.replace(/[\s-]/g, '');
  return `${'X'.repeat(compact.length - 4)}${compact.slice(-4)}`;
};

const PATTERNS: readonly RegExp[] = [
  /\b[A-Z]{5}\d{4}[A-Z]\b/gi, // PAN
  /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Aadhaar
  /\b[A-Z][1-9]\d{6}\b/gi, // Passport
];

const DIN_IN_CONTEXT = /\b(DIN[\s:#-]*)(\d{8})\b/gi;

export function maskIdentityNumbers(text: string): string {
  const masked = PATTERNS.reduce((out, pattern) => out.replace(pattern, lastFour), text);
  return masked.replace(DIN_IN_CONTEXT, (_all, label: string, digits: string) => `${label}${lastFour(digits)}`);
}

/** The whole of one identity value, for a field already known to hold one. */
export function maskIdentityValue(value: string): string {
  const compact = value.replace(/[\s-]/g, '');
  return compact.length > 4 ? lastFour(compact) : 'X'.repeat(compact.length);
}

/**
 * Swaps identity numbers for placeholders, so a model reading the text never sees one. `restore`
 * puts them back into what the model returned; a placeholder the model made up stays as it is and
 * then fails the format check.
 */
export function tokeniseIdentityNumbers(text: string): { text: string; restore: (value: string) => string } {
  const found: string[] = [];
  const hold = (value: string): string => `IDTOKEN${found.push(value)}X`;
  const swapped = PATTERNS.reduce((out, pattern) => out.replace(pattern, hold), text).replace(
    DIN_IN_CONTEXT,
    (_all, label: string, digits: string) => `${label}${hold(digits)}`,
  );
  return { text: swapped, restore: (value) => value.replace(/IDTOKEN(\d+)X/g, (all, n: string) => found[Number(n) - 1] ?? all) };
}

/*
 * ---- The model-bound masker (docs/specs/ask-vcfo/PRIVACY.md) ----
 *
 * `createAskMasker` swaps personal data for numbered placeholders such as [EMAIL_1] before text
 * reaches a model, and `unmask` puts the values back into what the model wrote, so the answer the
 * person reads still says their own email. One masker serves one turn of one conversation; the
 * pipeline feeds it the conversation's history first, in order, so a value keeps its number across
 * turns. Identity numbers (PAN, Aadhaar, passport, DIN) come back only in their last-four form, so a
 * full Aadhaar number can never be restored into a later prompt. IFSC codes stay visible: they name
 * a bank branch, not a person, and an answer about a bank account often needs the bank.
 */

export type MaskKind =
  | 'EMAIL'
  | 'PHONE'
  | 'BANK_ACCOUNT'
  | 'PINCODE'
  | 'PAN'
  | 'AADHAAR'
  | 'PASSPORT'
  | 'DIN'
  | 'DIRECTOR'
  | 'SUBSCRIBER'
  | 'CLIENT';

/** A person the pipeline already knows from the engagement, whose name is masked wherever it appears. */
export interface KnownPerson {
  name: string;
  kind: 'DIRECTOR' | 'SUBSCRIBER' | 'CLIENT';
}

export interface AskMasker {
  mask(text: string): string;
  unmask(text: string): string;
  maskDeep<T>(value: T): T;
  unmaskDeep<T>(value: T): T;
}

const IDENTITY_KINDS: ReadonlySet<MaskKind> = new Set(['PAN', 'AADHAAR', 'PASSPORT', 'DIN']);

interface MaskRule {
  kind: MaskKind;
  pattern: RegExp;
  /** Only lines that match this (or, with `nearLines`, one of the lines just above) are searched. */
  context?: RegExp;
  nearLines?: number;
  /** The capture group that holds the value; the rest of the match stays as it is. */
  group?: number;
  accept?: (value: string) => boolean;
}

const digitCount = (value: string) => value.replace(/\D/g, '').length;

const DIRECTOR_CONTEXT = /\b(?:directors?|DIN|DIR-3|subscribers?|promoters?)\b/i;
const ADDRESS_CONTEXT =
  /\b(?:address|addr|road|rd|street|lane|nagar|colony|floor|flat|sector|block|marg|building|bldg|apartments?|layout|village|taluk|tehsil|district|pin|pincode|pin code|postal code|post office|p\.?o\.?)\b/i;

/** Order matters: an international phone number before Aadhaar, Aadhaar before a bare long number. */
const MASK_RULES: readonly MaskRule[] = [
  { kind: 'EMAIL', pattern: /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi },
  { kind: 'PHONE', pattern: /\+91[\s-]?(?:[6-9]\d{4}[\s-]?\d{5}|\(?\d{2,4}\)?[\s-]?\d{6,8})(?!\d)/g },
  { kind: 'PAN', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/gi },
  { kind: 'AADHAAR', pattern: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { kind: 'PASSPORT', pattern: /\b[A-Z][1-9]\d{6}\b/gi },
  {
    kind: 'BANK_ACCOUNT',
    pattern: /\b((?:bank\s+)?(?:a\/c|acct|account)(?:\s*(?:no|number|num))?\.?[\s:#-]*)(\d[\d\s-]{7,20}\d)\b/gi,
    group: 2,
    accept: (value) => digitCount(value) >= 9 && digitCount(value) <= 18,
  },
  { kind: 'BANK_ACCOUNT', pattern: /(?<![\d])\d{13,18}(?![\d])/g },
  { kind: 'PHONE', pattern: /(?<![\w+])(?:91[\s-])?0?[6-9]\d{4}[\s-]?\d{5}(?!\w)/g },
  { kind: 'PHONE', pattern: /(?<![\w])\(0\d{2,4}\)\s?\d{3,4}[\s-]?\d{4}(?!\w)/g },
  { kind: 'PHONE', pattern: /(?<![\w])0\d{2,4}[\s-]\d{6,8}(?!\w)/g },
  { kind: 'DIN', pattern: /\b(DIN[\s:#-]*)(\d{8})\b/gi, group: 2 },
  { kind: 'DIN', pattern: /\b\d{8}\b/g, context: DIRECTOR_CONTEXT },
  { kind: 'PINCODE', pattern: /\b[1-9]\d{2}\s?\d{3}\b/g, context: ADDRESS_CONTEXT, nearLines: 2 },
];

const PLACEHOLDER = /\[([A-Z_]+?)_(\d+)\]/g;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nameVariants(name: string): string[] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const variants = [parts.join(' ')];
  if (parts.length > 2) variants.push(`${parts[0]} ${parts.at(-1)}`);
  // One short word ("Ali") is too likely to be an ordinary word; only longer single names count.
  return variants.filter((v) => (v.includes(' ') ? v.length >= 5 : v.length >= 4));
}

function mapStrings(value: unknown, fn: (text: string) => string): unknown {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, mapStrings(v, fn)]));
  }
  return value;
}

export function createAskMasker(options: { people?: readonly KnownPerson[] } = {}): AskMasker {
  const byKey = new Map<string, string>();
  const display = new Map<string, string>();
  const counters = new Map<MaskKind, number>();

  const placeholderFor = (kind: MaskKind, key: string, shown: string): string => {
    const existing = byKey.get(`${kind}:${key}`);
    if (existing) return existing;
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    const placeholder = `[${kind}_${n}]`;
    byKey.set(`${kind}:${key}`, placeholder);
    display.set(placeholder, IDENTITY_KINDS.has(kind) ? lastFour(shown) : shown);
    return placeholder;
  };

  const keyOf = (kind: MaskKind, value: string) =>
    kind === 'EMAIL' ? value.toLowerCase() : kind === 'PHONE' ? value.replace(/\D/g, '').slice(-10) : value.replace(/[\s()-]/g, '').toUpperCase();

  // Each person gets one placeholder, whichever form of the name matched; longest names go first.
  const people = (options.people ?? [])
    .map((person, index) => ({ ...person, id: `${person.kind}:${person.name.trim().toLowerCase().replace(/\s+/g, ' ')}`, index }))
    .filter((p) => p.name.trim());
  const nameRules = people
    .flatMap((person) => nameVariants(person.name).map((variant) => ({ person, variant })))
    .sort((a, b) => b.variant.length - a.variant.length)
    .map(({ person, variant }) => ({
      person,
      pattern: new RegExp(`(?<![\\w])${variant.split(' ').map(escapeRegExp).join('\\s+')}(?![\\w])`, 'gi'),
    }));

  const applyRule = (text: string, rule: MaskRule): string => {
    const swap = (all: string, ...groups: unknown[]) => {
      const value = rule.group ? (groups[rule.group - 1] as string) : all;
      if (!value || (rule.accept && !rule.accept(value))) return all;
      const placeholder = placeholderFor(rule.kind, keyOf(rule.kind, value), value.trim());
      return rule.group ? all.replace(value, placeholder) : placeholder;
    };
    if (!rule.context) return text.replace(rule.pattern, swap);
    const lines = text.split('\n');
    return lines
      .map((line, i) => {
        const near = lines.slice(Math.max(0, i - (rule.nearLines ?? 0)), i + 1);
        return near.some((l) => rule.context!.test(l)) ? line.replace(rule.pattern, swap) : line;
      })
      .join('\n');
  };

  const mask = (text: string): string => {
    if (!text) return text;
    let out = text;
    for (const { person, pattern } of nameRules) {
      out = out.replace(pattern, () => placeholderFor(person.kind, person.id, person.name.trim().replace(/\s+/g, ' ')));
    }
    for (const rule of MASK_RULES) out = applyRule(out, rule);
    return out;
  };

  const unmask = (text: string): string => (text ? text.replace(PLACEHOLDER, (all) => display.get(all) ?? all) : text);

  return {
    mask,
    unmask,
    maskDeep: <T,>(value: T) => mapStrings(value, mask) as T,
    unmaskDeep: <T,>(value: T) => mapStrings(value, unmask) as T,
  };
}

/** Names from labelled lines ("Name: Asha Rao", "Director 2: Ravi Kumar"), for a paste the engagement does not know yet. */
export function namesFromLabelledText(text: string): KnownPerson[] {
  const out: KnownPerson[] = [];
  const line = /^\s*(?:[-*•]\s*)?(?:(?:full|director|subscriber|applicant|card ?holder)\s+)?(?:name(?:\s+of\s+(?:the\s+)?(?:director|subscriber|applicant))?|director\s*\d*|subscriber\s*\d*)\s*[:=|-]\s*([A-Za-z][A-Za-z .'’-]{2,80}?)\s*$/gim;
  for (const match of text.matchAll(line)) {
    const name = match[1]!.trim();
    if (name.split(/\s+/).length >= 2) out.push({ name, kind: /subscriber/i.test(match[0]) ? 'SUBSCRIBER' : 'DIRECTOR' });
  }
  return out;
}
