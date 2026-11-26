import type { AssistProfileResult } from '@/lib/assist-profile/types';
import type { GstMissing, GstSource } from '@/lib/registrations/gst-profile';

/**
 * "BEFORE I FILL" — the card agent's check after Start and before any portal work
 * (docs/specs/live-portal-browser/MASTER-PLAN.md screen 4, CARD-AGENTS.md "the Before I fill
 * check"). Pure and client-safe: the panel, the tests and any later server use share it.
 *
 * Every value and document the form needs is one item in one of three states: ready (Suite holds
 * it, with its source), confirm (the client entered it and the lead has not confirmed it; it does
 * not block), or missing (required or optional). For each missing item the person picks one
 * action. "Fill now" unlocks only when every required item is present or set to "I type it on the
 * portal" (the agent then leaves that field and marks it, G16). Nothing is filled before "Fill now".
 */

export type BeforeFillSource = GstSource;
export type BeforeFillStatus = 'ready' | 'confirm' | 'missing';

export interface BeforeFillItem {
  key: string;
  label: string;
  kind: 'value' | 'document';
  status: BeforeFillStatus;
  /** Required on the form. Ready and confirm items are counted as required; they never block. */
  required: boolean;
  /** What Suite holds (a value or a file name), for ready and confirm items. */
  value?: string;
  /** Where the item comes from, or the best place to get it when it is missing. */
  source: BeforeFillSource;
  /** One plain line: where in Suite it is typed, or which paper it is read from. */
  where?: string;
  /** The checklist step that holds it, for "Type it now". */
  stepId?: string;
  /** Suite cannot hold this value at all: it is typed on the portal. */
  portalOnly?: boolean;
}

export type BeforeFillChoice = 'sharepoint' | 'zoho' | 'client' | 'type-now' | 'portal' | 'skip';

export const BEFORE_FILL_CHOICES: readonly BeforeFillChoice[] = ['sharepoint', 'zoho', 'client', 'type-now', 'portal', 'skip'];

export function choiceLabel(choice: BeforeFillChoice, kind: BeforeFillItem['kind'] = 'value'): string {
  switch (choice) {
    case 'sharepoint':
      return 'Get from SharePoint';
    case 'zoho':
      return 'Get from Zoho';
    case 'client':
      return 'Ask the client';
    case 'type-now':
      return kind === 'document' ? 'Add it now' : 'Type it now';
    case 'portal':
      return kind === 'document' ? 'I upload on the portal' : 'I type on the portal';
    case 'skip':
      return 'Skip';
  }
}

/** What this card can do for a missing item: SharePoint needs a reading path; Zoho needs a linked org. */
export interface BeforeFillContext {
  sharepoint: boolean;
  zohoLinked: boolean;
}

/** The actions allowed for one item, in a fixed order. Ready and confirm items have none. */
export function choicesFor(item: BeforeFillItem, ctx: BeforeFillContext): BeforeFillChoice[] {
  if (item.status !== 'missing') return [];
  const out: BeforeFillChoice[] = [];
  if (!item.portalOnly) {
    const papers = item.kind === 'document' || item.source === 'sharepoint' || item.source === 'client';
    if (ctx.sharepoint && papers) out.push('sharepoint');
    if (ctx.zohoLinked && item.source === 'zoho' && item.kind === 'value') out.push('zoho');
    out.push('client', 'type-now');
  }
  out.push('portal');
  if (!item.required) out.push('skip');
  return out;
}

/** The action the panel picks first: the item's own source, or Skip for an optional item. */
export function suggestedChoice(item: BeforeFillItem, ctx: BeforeFillContext): BeforeFillChoice | null {
  const allowed = choicesFor(item, ctx);
  if (allowed.length === 0) return null;
  if (!item.required) return 'skip';
  const bySource: Record<BeforeFillSource, BeforeFillChoice> = {
    sharepoint: 'sharepoint',
    zoho: 'zoho',
    client: 'client',
    portal: 'portal',
    tool: 'type-now',
  };
  const want = item.portalOnly ? 'portal' : bySource[item.source];
  if (allowed.includes(want)) return want;
  return allowed.includes('client') ? 'client' : allowed[0]!;
}

export type BeforeFillChoices = Record<string, BeforeFillChoice>;

/**
 * The choices for the items as they stand now: a saved choice stays while it is still allowed;
 * every other missing item gets its suggested choice. Items that arrived (no longer missing) drop
 * out, so the screen refreshes itself when data comes in.
 */
export function reconcileChoices(items: readonly BeforeFillItem[], saved: BeforeFillChoices, ctx: BeforeFillContext): BeforeFillChoices {
  const out: BeforeFillChoices = {};
  for (const item of items) {
    const allowed = choicesFor(item, ctx);
    if (allowed.length === 0) continue;
    const kept = saved[item.key];
    const pick = kept && allowed.includes(kept) ? kept : suggestedChoice(item, ctx);
    if (pick) out[item.key] = pick;
  }
  return out;
}

export interface FillNowState {
  unlocked: boolean;
  /** Required items that are missing and not set to "I type on the portal". */
  blocking: BeforeFillItem[];
  /** The keys the agent leaves for the person to type on the portal (G16). */
  typeOnPortal: string[];
  /** Optional items the person skipped. */
  skipped: string[];
}

export function fillNowState(items: readonly BeforeFillItem[], choices: BeforeFillChoices): FillNowState {
  const missing = items.filter((i) => i.status === 'missing');
  const blocking = missing.filter((i) => i.required && choices[i.key] !== 'portal');
  return {
    unlocked: blocking.length === 0,
    blocking,
    typeOnPortal: missing.filter((i) => choices[i.key] === 'portal').map((i) => i.key),
    skipped: missing.filter((i) => !i.required && choices[i.key] === 'skip').map((i) => i.key),
  };
}

export interface BeforeFillGroups {
  ready: BeforeFillItem[];
  confirm: BeforeFillItem[];
  missingRequired: BeforeFillItem[];
  missingOptional: BeforeFillItem[];
}

/** The four groups of the screen; documents sit in the same groups, after the values. */
export function groupBeforeFill(items: readonly BeforeFillItem[]): BeforeFillGroups {
  const order = (list: BeforeFillItem[]) => [...list.filter((i) => i.kind === 'value'), ...list.filter((i) => i.kind === 'document')];
  return {
    ready: order(items.filter((i) => i.status === 'ready')),
    confirm: order(items.filter((i) => i.status === 'confirm')),
    missingRequired: order(items.filter((i) => i.status === 'missing' && i.required)),
    missingOptional: order(items.filter((i) => i.status === 'missing' && !i.required)),
  };
}

export interface BeforeFillCount {
  need: number;
  have: number;
  missing: number;
}

export interface BeforeFillSummary {
  values: BeforeFillCount;
  documents: BeforeFillCount;
  /** Required items missing, values and documents together. */
  requiredMissing: number;
  /** Share of everything needed that Suite holds, 0 to 100. */
  pct: number;
}

export function beforeFillSummary(items: readonly BeforeFillItem[]): BeforeFillSummary {
  const count = (kind: BeforeFillItem['kind']): BeforeFillCount => {
    const of = items.filter((i) => i.kind === kind);
    const have = of.filter((i) => i.status !== 'missing').length;
    return { need: of.length, have, missing: of.length - have };
  };
  const values = count('value');
  const documents = count('document');
  const need = values.need + documents.need;
  const have = values.have + documents.have;
  return {
    values,
    documents,
    requiredMissing: items.filter((i) => i.status === 'missing' && i.required).length,
    pct: need === 0 ? 100 : Math.floor((have / need) * 100),
  };
}

/** The items set to one action, for the action row ("Read 2 from SharePoint"). */
export function itemsChosen(items: readonly BeforeFillItem[], choices: BeforeFillChoices, choice: BeforeFillChoice): BeforeFillItem[] {
  return items.filter((i) => i.status === 'missing' && choices[i.key] === choice);
}

/** The draft request list for the items set to "Ask the client". Nothing reaches the client until a person sends it. */
export function clientRequestItems(
  items: readonly BeforeFillItem[],
  choices: BeforeFillChoices,
  formName: string,
): Array<{ kind: 'answer' | 'document'; label: string; help: string }> {
  const seen = new Set<string>();
  const out: Array<{ kind: 'answer' | 'document'; label: string; help: string }> = [];
  for (const item of itemsChosen(items, choices, 'client')) {
    const label = item.kind === 'document' ? `${item.label} (upload)` : item.label;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ kind: item.kind === 'document' ? 'document' : 'answer', label: label.slice(0, 300), help: `Needed for ${formName}.`.slice(0, 500) });
  }
  return out.slice(0, 60);
}

// ---------- saved choices ("Save and come back") ----------

export function beforeFillStorageKey(engagementId: string, taskId: string): string {
  return `vcfo.card-agent.before-fill.${engagementId}.${taskId}`;
}

/** The saved choices, or none when storage is blocked, empty or holds something else. */
export function loadChoices(storage: Pick<Storage, 'getItem'> | null | undefined, key: string): BeforeFillChoices {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { v?: number; choices?: Record<string, unknown> };
    if (parsed?.v !== 1 || !parsed.choices || typeof parsed.choices !== 'object') return {};
    const out: BeforeFillChoices = {};
    for (const [k, v] of Object.entries(parsed.choices)) {
      if (typeof v === 'string' && (BEFORE_FILL_CHOICES as readonly string[]).includes(v)) out[k] = v as BeforeFillChoice;
    }
    return out;
  } catch {
    return {};
  }
}

/** Saves the choices; returns false when the browser refuses (private window, blocked storage). */
export function saveChoices(storage: Pick<Storage, 'setItem'> | null | undefined, key: string, choices: BeforeFillChoices): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify({ v: 1, choices, at: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

// ---------- labels ----------

const SECTION_WORD: Record<string, string> = {
  partA: '',
  business: '',
  jurisdiction: 'Jurisdiction',
  company: '',
  capital: 'Capital',
  equity: 'Equity',
  preference: 'Preference',
  promoters: 'Promoter',
  signatory: 'Signatory',
  principalPlace: 'Principal place',
  additionalPlaces: 'Additional place',
  existingRegistrations: 'Existing registration',
  goods: 'Goods',
  services: 'Services',
  bank: 'Bank',
  stateSpecific: '',
  aadhaar: 'Aadhaar',
  verification: 'Verification',
  address: 'address',
  registeredOffice: 'Registered office',
  directors: 'Director',
  subscribers: 'Subscriber',
  agile: 'AGILE-PRO-S',
  moa: 'MoA',
  aoa: 'AoA',
  witness: 'witness',
  father: 'father',
};

const WORD: Record<string, string> = {
  pan: 'PAN',
  cin: 'CIN',
  din: 'DIN',
  dob: 'date of birth',
  hsn: 'HSN',
  sac: 'SAC',
  ifsc: 'IFSC',
  nic: 'NIC',
  roc: 'ROC',
  noc: 'NOC',
  gstin: 'GSTIN',
  aoa: 'AoA',
  moa: 'MoA',
  ec: 'EC',
  rc: 'RC',
};

function words(camel: string): string {
  return camel
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((w) => WORD[w.toLowerCase()] ?? w.toLowerCase())
    .join(' ');
}

const capital = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A plain label for a flat key (`promoters.1.firstName` → "Promoter 1 first name"). */
export function fieldLabel(key: string): string {
  const parts: string[] = [];
  for (const seg of key.split('.')) {
    if (/^\d+$/.test(seg)) parts.push(seg);
    else if (seg in SECTION_WORD) {
      if (SECTION_WORD[seg]) parts.push(SECTION_WORD[seg]!);
    } else parts.push(words(seg));
  }
  return capital(parts.join(' ').replace(/\s+/g, ' ').trim()) || key;
}

/** How a value shows on the screen; bank account numbers keep their last four digits only. */
export function displayValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value).trim();
  if (!text) return null;
  if (/accountNumber$/i.test(key)) return text.length > 4 ? `•••• ${text.slice(-4)}` : '••••';
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

// ---------- the two data sources ----------

/** What the GST REG-01 read gives (`GET /api/engagements/[id]/gst-registration`). */
export interface GstBeforeFillInput {
  missing: GstMissing[];
  fields?: Record<string, string | number | boolean>;
  documents: Array<{ key: string; label: string; fileName: string; source: string }>;
  view: { confirm?: Array<{ key: string; label: string }> };
}

const SOURCES: ReadonlySet<string> = new Set(['tool', 'sharepoint', 'zoho', 'client', 'portal']);
const asSource = (s: string | undefined): BeforeFillSource => (s && SOURCES.has(s) ? (s as BeforeFillSource) : 'tool');

export function buildGstBeforeFill(read: GstBeforeFillInput): BeforeFillItem[] {
  const items: BeforeFillItem[] = [];
  for (const [key, raw] of Object.entries(read.fields ?? {})) {
    if (key.startsWith('meta.')) continue;
    const value = displayValue(key, raw);
    if (value === null) continue;
    items.push({ key, label: fieldLabel(key), kind: 'value', status: 'ready', required: true, value, source: 'tool' });
  }
  for (const doc of read.documents) {
    items.push({ key: `doc:${doc.key}`, label: doc.label, kind: 'document', status: 'ready', required: true, value: doc.fileName, source: asSource(doc.source) });
  }
  for (const c of read.view.confirm ?? []) {
    items.push({ key: `confirm:${c.key}`, label: c.label, kind: 'value', status: 'confirm', required: false, source: 'client' });
  }
  const seen = new Set<string>();
  for (const m of read.missing) {
    const key = m.kind === 'document' ? `doc:${m.key}` : m.key;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      label: m.label,
      kind: m.kind,
      status: 'missing',
      required: m.required,
      source: m.source,
      where: m.where,
      stepId: m.stepId,
      portalOnly: Boolean(m.reason) || m.source === 'portal',
    });
  }
  return items;
}

const DOCUMENT_KEY = /(photo|proof|signature|document|attachment|upload|scan|certificate)/i;

function flatten(prefix: string, value: unknown, out: Array<[string, unknown]>, depth = 0) {
  if (value === null || value === undefined || depth > 5) return;
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== 'object')) {
      const joined = value.filter((v) => v !== null && v !== undefined && String(v).trim()).join(', ');
      if (joined) out.push([prefix, joined]);
      return;
    }
    value.forEach((v, i) => flatten(`${prefix}.${i + 1}`, v, out, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'id' || k === 'index') continue;
      flatten(prefix ? `${prefix}.${k}` : k, v, out, depth + 1);
    }
    return;
  }
  out.push([prefix, value]);
}

/**
 * The profile section a key sits in (`directors[0].din` and `director.1.din` are both
 * `director`), so a form's check lists only the sections its recipe fills.
 */
export function profileSection(key: string): string {
  return (key.split(/[.[]/)[0] ?? '').replace(/s$/, '');
}

/**
 * The MCA forms' check from the VCFO Assist profile (`GET /api/engagements/[id]/assist-profile`).
 * The profile serves every MCA form; `sections` (from the task's recipe) keeps only what this
 * form fills, so SPICe+ Part A does not list the directors Part B needs.
 */
export function buildMcaBeforeFill(result: Pick<AssistProfileResult, 'profile' | 'missing'>, sections?: readonly string[] | null): BeforeFillItem[] {
  const keep = sections?.length ? new Set(sections) : null;
  const inScope = (key: string) => !keep || keep.has(profileSection(key));
  const items: BeforeFillItem[] = [];
  const flat: Array<[string, unknown]> = [];
  const { mcaLogin: _login, ...profile } = result.profile;
  flatten('', profile, flat);
  for (const [key, raw] of flat) {
    if (!inScope(key)) continue;
    const value = displayValue(key, raw);
    if (value === null) continue;
    items.push({ key, label: fieldLabel(key), kind: DOCUMENT_KEY.test(key) ? 'document' : 'value', status: 'ready', required: true, value, source: 'tool' });
  }
  const seen = new Set<string>();
  for (const m of result.missing) {
    if (seen.has(m.key) || !inScope(m.key)) continue;
    seen.add(m.key);
    items.push({
      key: m.key,
      label: m.label,
      kind: DOCUMENT_KEY.test(`${m.key} ${m.label}`) ? 'document' : 'value',
      status: 'missing',
      required: true,
      source: m.reason ? 'portal' : 'tool',
      where: m.reason ?? undefined,
      stepId: m.stepId,
      portalOnly: Boolean(m.reason),
    });
  }
  return items;
}
