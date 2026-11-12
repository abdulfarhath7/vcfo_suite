import { SRN_FIELD_ID } from '@/lib/checklist/checklist-responses';
import { listPacks } from './registry';
import { packHasHost, packLive } from './pack';

/**
 * THE AGENT CATALOG — the VCFO Assist agents as a tree of any depth, as the side panel lists them
 * (docs/specs/vcfo-assist-agents/PLAN.md): agent → sub-agent → … → task, for example
 * Compliance › Income tax & TDS › TDS › Monthly TDS challan (`compliance/income-tax-tds/tds/challan-281`).
 * Pure data and helpers.
 *
 * A task is what a person runs. Its id is unique across the tree and never changes (`spice-a`,
 * `challan-281`), so runs, recipes and links keep working when the tree is regrouped. Each task
 * names its portal pack (`packs/<id>.json`), its kind and its human gates:
 *  - `portal-fill`: the agent fills a web form; the person logs in, signs, submits and pays.
 *  - `challan-prepare`: the agent PREPARES a tax challan (Challan 280, Challan 281) and stops before
 *    the payment mode and bank page; the person checks it, creates it and PAYS through their own bank.
 *  - `file-builder`: no web fill at all. Suite builds a file (for example a 24Q or 26Q return for
 *    Protean's FVU); the person validates, uploads and signs it.
 *
 * `stepId` is the checklist step (`src/data/checklist.ts`) a finished run advances; compliance
 * filings have no checklist step and name their compliance activity (`activityId`,
 * `src/data/compliance-activities.ts`) instead, or nothing yet. `srnField` is the step's
 * "Acknowledgement number (SRN)" field (SA-01) the SRN is written to; a task without one keeps its
 * SRN on the run.
 *
 * `status`: `beta` has a recipe checked against a capture or the mock portal; `later` has none
 * yet. No task is `ready` until a supervised live run has verified its recipe (PLAN phase 4).
 */

export type AssistAgentId = 'incorporation' | 'post-incorporation' | 'registration' | 'compliance';
export type AssistSubAgentStatus = 'ready' | 'beta' | 'later';
export type AssistPortal = 'mca' | 'gst' | 'udyam' | 'dgft' | 'state' | 'income-tax' | 'traces' | 'protean';
export type AssistTaskKind = 'portal-fill' | 'file-builder' | 'challan-prepare';
export type AssistTaskGate = 'LOGIN' | 'CAPTCHA' | 'OTP' | 'DSC' | 'SUBMIT' | 'PAY' | 'EVC';

/** One task (the name `AssistSubAgent` is kept: every existing caller means a runnable task). */
export interface AssistSubAgent {
  id: string;
  /** The top-level agent this task sits under. */
  agent: AssistAgentId;
  title: string;
  /** The form's own name, for example `SPICe+ Part A`. */
  form: string;
  status: AssistSubAgentStatus;
  portal: AssistPortal;
  /** The live portal host; null where the portal is a state site that differs by state. */
  portalHost: string | null;
  /** The portal pack the task runs on; null for state portals that have no pack yet. */
  pack: string | null;
  kind: AssistTaskKind;
  /** The steps only a person takes on this task. */
  gates: AssistTaskGate[];
  recipeId: string | null;
  stepId: string | null;
  activityId?: string;
  srnField?: string;
  /** One plain sentence for the panel, for example who pays a challan. */
  note?: string;
  /** Ids from the agent down to this task, for example `['compliance', 'income-tax-tds', 'tds', 'challan-281']`. */
  path: string[];
}

/** A node of the tree: an agent or a group of tasks, or one task. */
export type AssistCatalogNode =
  | { type: 'group'; id: string; title: string; path: string[]; children: AssistCatalogNode[] }
  | ({ type: 'task' } & AssistSubAgent);

export interface AssistAgent {
  id: AssistAgentId;
  title: string;
  /** Every task under this agent, at any depth, in tree order (the flat list older clients read). */
  subAgents: AssistSubAgent[];
}

const MCA_HOST = 'www.mca.gov.in';
const MCA_GATES: AssistTaskGate[] = ['LOGIN', 'CAPTCHA', 'OTP', 'DSC', 'SUBMIT', 'PAY'];
const PORTAL_GATES: AssistTaskGate[] = ['LOGIN', 'CAPTCHA', 'OTP', 'SUBMIT', 'PAY'];

type TaskInput = Omit<AssistSubAgent, 'agent' | 'path' | 'kind' | 'gates'> & { kind?: AssistTaskKind; gates?: AssistTaskGate[] };
type TreeInput = { group: string; title: string; children: TreeInput[] } | { task: TaskInput };

const task = (t: TaskInput): TreeInput => ({ task: t });
const group = (id: string, title: string, children: TreeInput[]): TreeInput => ({ group: id, title, children });

const mca = (t: Omit<TaskInput, 'portal' | 'portalHost' | 'pack'>): TreeInput =>
  task({ portal: 'mca', portalHost: MCA_HOST, pack: 'mca-v3', gates: MCA_GATES, ...t });

/** The tree as authored. Each top-level group is an agent (a robot in the panel). */
const TREE: readonly TreeInput[] = [
  group('incorporation', 'Incorporation', [
    mca({ id: 'spice-a', title: 'Name reservation', form: 'SPICe+ Part A', status: 'beta', recipeId: 'spice-a', stepId: 'pre-4', srnField: SRN_FIELD_ID, gates: ['LOGIN', 'CAPTCHA', 'OTP', 'SUBMIT', 'PAY'] }),
    mca({ id: 'spice-b', title: 'Incorporation form', form: 'SPICe+ Part B', status: 'beta', recipeId: 'spice-b', stepId: 'pre-10', srnField: SRN_FIELD_ID }),
    // The linked forms are filed with Part B under its SRN, so only Part B writes the SRN back.
    mca({ id: 'agile-pro-s', title: 'GST, EPFO, ESIC and bank', form: 'AGILE-PRO-S', status: 'beta', recipeId: 'agile-pro-s', stepId: 'pre-10', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'DSC', 'SUBMIT'] }),
    mca({ id: 'emoa', title: 'Memorandum of association', form: 'e-MoA (INC-33)', status: 'beta', recipeId: 'emoa', stepId: 'pre-10', gates: ['LOGIN', 'DSC', 'SUBMIT'] }),
    mca({ id: 'eaoa', title: 'Articles of association', form: 'e-AoA (INC-34)', status: 'beta', recipeId: 'eaoa', stepId: 'pre-10', gates: ['LOGIN', 'DSC', 'SUBMIT'] }),
    mca({ id: 'inc-9', title: 'Subscriber and director declaration', form: 'INC-9', status: 'later', recipeId: null, stepId: 'pre-10', gates: ['LOGIN', 'DSC', 'SUBMIT'] }),
  ]),
  group('post-incorporation', 'Post-incorporation', [
    mca({ id: 'inc-20a', title: 'Commencement of business', form: 'INC-20A', status: 'later', recipeId: null, stepId: 'post-6', srnField: SRN_FIELD_ID }),
    mca({ id: 'adt-1', title: 'Auditor appointment', form: 'ADT-1', status: 'later', recipeId: null, stepId: 'post-2', srnField: SRN_FIELD_ID }),
  ]),
  group('registration', 'Registration', [
    // GST, Udyam and IEC return an ARN or a certificate number, not an MCA SRN; it stays on the run.
    task({ id: 'gst-reg-01', title: 'GST registration', form: 'GST REG-01', status: 'later', portal: 'gst', portalHost: 'reg.gst.gov.in', pack: 'gst', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'DSC', 'EVC', 'SUBMIT'], recipeId: null, stepId: 'reg-4', note: 'The GST portal bars unauthorised interfaces: the agent prepares the data in Suite and you type it, until the CS opinion.' }),
    task({ id: 'udyam', title: 'Udyam (MSME) registration', form: 'Udyam', status: 'later', portal: 'udyam', portalHost: 'udyamregistration.gov.in', pack: 'udyam', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'SUBMIT'], recipeId: null, stepId: 'reg-15' }),
    task({ id: 'iec', title: 'Import Export Code', form: 'IEC', status: 'later', portal: 'dgft', portalHost: 'www.dgft.gov.in', pack: 'dgft', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'DSC', 'SUBMIT', 'PAY'], recipeId: null, stepId: 'reg-8' }),
    task({ id: 'shops-establishment', title: 'Shops and establishments', form: 'Shops and Establishments', status: 'later', portal: 'state', portalHost: null, pack: null, gates: PORTAL_GATES, recipeId: null, stepId: 'reg-9' }),
    task({ id: 'pt', title: 'Professional tax', form: 'PT registration', status: 'later', portal: 'state', portalHost: null, pack: null, gates: PORTAL_GATES, recipeId: null, stepId: 'reg-7' }),
  ]),
  group('compliance', 'Compliance', [
    group('mca-annual', 'MCA annual filings', [
      mca({ id: 'dir-3-kyc', title: 'Director KYC', form: 'DIR-3 KYC', status: 'later', recipeId: null, stepId: null, activityId: 'ACT-M08' }),
      mca({ id: 'aoc-4', title: 'Financial statements', form: 'AOC-4', status: 'later', recipeId: null, stepId: null, activityId: 'ACT-015-AOC4' }),
      mca({ id: 'mgt-7', title: 'Annual return', form: 'MGT-7 / MGT-7A', status: 'later', recipeId: null, stepId: null, activityId: 'ACT-015-MGT7' }),
    ]),
    group('income-tax-tds', 'Income tax & TDS', [
      group('tds', 'TDS', [
        task({ id: 'challan-281', title: 'Monthly TDS challan', form: 'Challan 281 (ITNS 281)', status: 'later', kind: 'challan-prepare', portal: 'income-tax', portalHost: 'eportal.incometax.gov.in', pack: 'income-tax-efiling', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'PAY'], recipeId: null, stepId: null, note: 'The agent prepares the challan; you create it and pay it through your own bank.' }),
        task({ id: 'tds-return-24q-26q', title: 'Quarterly TDS return (24Q / 26Q)', form: '24Q / 26Q', status: 'later', kind: 'file-builder', portal: 'protean', portalHost: null, pack: 'protean-tin', gates: ['LOGIN', 'DSC', 'SUBMIT'], recipeId: null, stepId: null, note: 'A file builder, not a web fill: Suite builds the return file for the FVU; you validate, upload and sign it.' }),
        task({ id: 'form-16', title: 'Form 16 / 16A download', form: 'Form 16 / 16A', status: 'later', kind: 'portal-fill', portal: 'traces', portalHost: 'www.tdscpc.gov.in', pack: 'traces', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'SUBMIT'], recipeId: null, stepId: null, note: 'The KYC page asks for real deductee details; it stays yours.' }),
      ]),
      group('income-tax', 'Income tax', [
        task({ id: 'challan-280', title: 'Advance tax challan', form: 'Challan 280 (ITNS 280)', status: 'later', kind: 'challan-prepare', portal: 'income-tax', portalHost: 'eportal.incometax.gov.in', pack: 'income-tax-efiling', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'PAY'], recipeId: null, stepId: null, note: 'The agent prepares the challan; you create it and pay it through your own bank.' }),
        task({ id: 'itr', title: 'Income tax return', form: 'ITR', status: 'later', kind: 'portal-fill', portal: 'income-tax', portalHost: 'eportal.incometax.gov.in', pack: 'income-tax-efiling', gates: ['LOGIN', 'CAPTCHA', 'OTP', 'SUBMIT', 'EVC'], recipeId: null, stepId: null, note: 'Later. E-verification is always yours.' }),
      ]),
    ]),
  ]),
];

function build(input: TreeInput, agent: AssistAgentId, parent: string[]): AssistCatalogNode {
  if ('task' in input) {
    const t = input.task;
    return { type: 'task', kind: 'portal-fill', gates: PORTAL_GATES, ...t, agent, path: [...parent, t.id] };
  }
  const path = [...parent, input.group];
  return { type: 'group', id: input.group, title: input.title, path, children: input.children.map((c) => build(c, agent, path)) };
}

/** The catalog tree: one group per agent, groups and tasks below, to any depth. */
export const ASSIST_CATALOG_TREE: readonly AssistCatalogNode[] = TREE.map((t) => build(t, (t as { group: AssistAgentId }).group, []));

/** Every task under a node, in tree order. */
export function tasksUnder(node: AssistCatalogNode): AssistSubAgent[] {
  if (node.type === 'task') {
    const { type: _type, ...rest } = node;
    return [rest];
  }
  return node.children.flatMap(tasksUnder);
}

/** The deepest a branch goes (an agent with tasks directly below it is 2). */
export function treeDepth(nodes: readonly AssistCatalogNode[] = ASSIST_CATALOG_TREE): number {
  return nodes.reduce((max, n) => Math.max(max, n.type === 'task' ? 1 : 1 + treeDepth(n.children)), 0);
}

/** The agents with their tasks flattened, the shape every caller before the tree reads. */
export const ASSIST_AGENTS: readonly AssistAgent[] = ASSIST_CATALOG_TREE.map((node) => ({
  id: node.id as AssistAgentId,
  title: node.title,
  subAgents: tasksUnder(node),
}));

export function allSubAgents(): AssistSubAgent[] {
  return ASSIST_AGENTS.flatMap((agent) => agent.subAgents);
}

export function findSubAgent(id: string): AssistSubAgent | undefined {
  return allSubAgents().find((s) => s.id === id);
}

/**
 * True when any pack is live (PLAN §4). Kept for older callers: the per-pack switch is
 * `packLive` in `pack.ts` (`ASSIST_LIVE_PACKS`, plus the pack's own `legalStatus: 'cs-cleared'`).
 * `ASSIST_LIVE_PORTALS=true` is a deprecated alias that names `mca-v3` only.
 */
export function assistLivePortalsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return listPacks().some((p) => packLive(p, env));
}

/** Each pack with its legal status and whether the server lets it run live now. */
export function assistPackStatus(env: Record<string, string | undefined> = process.env) {
  return listPacks().map((p) => ({
    id: p.id,
    title: p.title,
    hosts: p.hosts,
    legalStatus: p.legalStatus,
    needsCsOpinionFirst: p.needsCsOpinionFirst,
    live: packLive(p, env),
  }));
}

/** The live hosts of every live pack (exact names only; `*.` patterns are matched by `packHasHost`). */
export function assistLiveHosts(env: Record<string, string | undefined> = process.env): string[] {
  return listPacks()
    .filter((p) => packLive(p, env))
    .flatMap((p) => p.hosts);
}

/** Hosts that count as the mock portal (`ASSIST_MOCK_HOSTS`, comma separated; localhost by default). */
export function assistMockHosts(env: Record<string, string | undefined> = process.env): string[] {
  const named = (env.ASSIST_MOCK_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return named.length ? named : ['localhost', '127.0.0.1'];
}

/**
 * True when a run may start against this host: always on the mock; on a live host only when a live
 * pack holds that host, and, given `packId`, only that pack (so approval for one portal never
 * extends to another).
 */
export function assistHostAllowed(host: string, env: Record<string, string | undefined> = process.env, packId?: string | null): boolean {
  const bare = host.trim().toLowerCase().replace(/:\d+$/, '');
  if (assistMockHosts(env).includes(bare)) return true;
  return listPacks().some((p) => (packId === undefined || p.id === packId) && packLive(p, env) && packHasHost(p, bare));
}

/**
 * The extension's remote kill switch (SAFETY.md G18, risk 6 in the legal review). The extension
 * reads the catalog at every run start and refuses to run while `ASSIST_EXTENSION_DISABLED=true`,
 * or while its own version is below `ASSIST_MIN_EXTENSION_VERSION`. Both are env settings so they
 * can be flipped on App Runner without a deploy of new code.
 */
export function assistExtensionDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ASSIST_EXTENSION_DISABLED?.trim().toLowerCase() === 'true';
}

/** The lowest extension version allowed to run, or null for no floor. Must look like `1.2.3`. */
export function assistMinExtensionVersion(env: Record<string, string | undefined> = process.env): string | null {
  const v = env.ASSIST_MIN_EXTENSION_VERSION?.trim();
  return v && /^\d{1,4}(\.\d{1,5}){0,3}$/.test(v) ? v : null;
}

/**
 * Extra firm contact details the extension must never type into a company, director or
 * subscriber field (`ASSIST_FIRM_CONTACTS`, comma separated emails and phone numbers). The
 * catalog route adds the firm settings' support email and phone and the signed-in user's email.
 */
export function assistFirmContactsFromEnv(env: Record<string, string | undefined> = process.env): { emails: string[]; phones: string[] } {
  const items = (env.ASSIST_FIRM_CONTACTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return splitContacts(items);
}

/** Sorts contact strings into lower-cased emails and digit-only phone numbers (the last ten digits). */
export function splitContacts(items: ReadonlyArray<string | null | undefined>): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const raw of items) {
    const item = raw?.trim();
    if (!item) continue;
    if (item.includes('@')) emails.add(item.toLowerCase());
    else {
      const digits = item.replace(/\D/g, '');
      if (digits.length >= 8) phones.add(digits.slice(-10));
    }
  }
  return { emails: [...emails].sort(), phones: [...phones].sort() };
}
