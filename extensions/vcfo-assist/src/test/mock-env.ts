/**
 * Test harness: loads a MOCK portal page into the jsdom document, runs its fake guideBridge, and
 * builds engine ports from the real portal agent plus a fake Suite that records every call.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PortalAgent } from '../portal/agent';
import { bridgeSetValue, readBridgeModel } from '../portal/bridge';
import { SECRET_FIELD_PATTERN } from '../guards';
import type { AttestationStatus, Persisted, PortalPort, ResolveContext, RunCreate, RunUpdate, StorePort, SuitePort } from '../engine/ports';
import type { Catalog, PatchProposal, ProfileResult, ResolvePayload, ResolveResponse, SignedRecipe } from '../shared/types';

const MOCK_DIR = path.resolve(__dirname, '../../mock-portal');

export function loadMockPage(file: 'spice-a.html' | 'spice-a-drift.html' | 'spice-b.html'): void {
  document.head.innerHTML = '';
  const html = readFileSync(path.join(MOCK_DIR, file), 'utf8');
  const body = /<body>([\s\S]*)<\/body>/.exec(html)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;
  const code = readFileSync(path.join(MOCK_DIR, 'mock-guide.js'), 'utf8');
  new Function(code)();
}

export function mockState(): { clicks: Record<string, number>; modelWrites: string[]; domEvents: string[]; infoClosed: boolean } {
  return (window as unknown as { __mock: ReturnType<typeof mockState> }).__mock;
}

/** Sentinel values (SAFETY.md G9): none of them may ever appear in a Suite or resolver payload. */
export const SENTINEL_PROFILE: ProfileResult = {
  schemaVersion: 1,
  companyName: 'Sentinel Alpha Private Limited',
  profile: {
    mcaLogin: { userId: '' },
    company: {
      proposedNames: ['Sentinel Alpha Private Limited', 'Sentinel Beta Private Limited'],
      nameSignificance: 'SENTINELWORD means sentinel',
      type: 'New Company (Others)',
      class: 'Private',
      category: 'Company limited by shares',
      subCategory: 'Indian non-government company',
      nicCode: '62011',
      trademarkSimilar: false,
    },
    directors: [{ id: 'e1', index: 1, firstName: 'Sentinelfirst', pan: 'SENTINELA1234Z', email: 'sentinel@example.test' }],
    subscribers: [],
    agile: {},
    moa: {},
    aoa: {},
  },
  missing: [{ key: 'pre-2.something', label: 'Something', stepId: 'pre-2' }],
};

export const PROFILE_VALUES = [
  'SENTINEL ALPHA PRIVATE LIMITED',
  'SENTINEL BETA PRIVATE LIMITED',
  'Sentinel Alpha Private Limited',
  'Sentinel Beta Private Limited',
  'SENTINELWORD',
  'SENTINELA1234Z',
  'sentinel@example.test',
  'Sentinelfirst',
];

/**
 * A Part B profile (sentinel values): capital, registered office, two subscribers without a DIN
 * (blocks 6c; subscriber 1 is also a director, so block 7b too) and two directors who are not
 * subscribers (director 1 with a DIN, block 7a; director 2 without, block 7b).
 */
export const PART_B_PROFILE: ProfileResult = {
  ...SENTINEL_PROFILE,
  profile: {
    ...SENTINEL_PROFILE.profile,
    company: {
      ...(SENTINEL_PROFILE.profile.company as Record<string, unknown>),
      aoaEntrenched: false,
      capital: { authorized: 1000000, subscribed: 100000, equity: { classes: 1, className: 'Equity', authorizedShares: 100000, subscribedShares: 10000, faceValue: 10 } },
    },
    registeredOffice: {
      line1: 'Sentinel Tower 1',
      line2: 'Sentinel Road',
      pincode: '500081',
      area: 'Gachibowli',
      city: 'Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      email: 'office@sentinel.test',
      mobile: '9581726353',
      longitude: '78.3489',
      latitude: '17.4401',
      rocOffice: 'Registrar of Companies, Hyderabad',
    },
    subscribers: [
      { index: 1, kind: 'individual', isDirector: true, firstName: 'Subone', surName: 'Sentinelson', father: { firstName: 'Fatherone', surName: 'Sentinelson' }, gender: 'Male', dob: '01/02/1980', nationality: 'India', placeOfBirth: 'Hyderabad, Telangana', citizenOfIndia: true, residentInIndia: true, pan: 'sentb1234c', email: 'sub1@sentinel.test', mobile: '9481726350', shares: { equity: { class: 'Equity', number: 5000 } } },
      { index: 2, kind: 'individual', isDirector: false, firstName: 'Subtwo', surName: 'Sentineldottir', father: { firstName: 'Fathertwo', surName: 'Sentineldottir' }, gender: 'Female', dob: '03/04/1985', nationality: 'India', placeOfBirth: 'Pune, Maharashtra', pan: 'SENTC5678D', email: 'sub2@sentinel.test', mobile: '9381726351', shares: { equity: { class: 'Equity', number: 5000 } } },
    ],
    directors: [
      { id: 'e3', index: 1, firstName: 'Dirone', surName: 'Sentinelli', din: '09876543', pan: 'SENTD1111E', dob: '05/06/1975', email: 'dir1@sentinel.test', mobile: '9681726354' },
      { id: 'e4', index: 2, firstName: 'Dirtwo', surName: 'Sentinelova', father: { firstName: 'Fatherfour', surName: 'Sentinelova' }, gender: 'Female', nationality: 'India', citizenOfIndia: true, residentInIndia: true, pan: 'SENTE2222F', dob: '07/08/1990', email: 'dir2@sentinel.test', mobile: '9281726352' },
    ],
  },
  missing: [],
};

export const PART_B_VALUES = [
  'Sentinel Tower 1',
  'Sentinel Road',
  'office@sentinel.test',
  'Subone',
  'Sentinelson',
  'Fatherone',
  'SENTB1234C',
  'sub1@sentinel.test',
  'Subtwo',
  'SENTC5678D',
  'Dirone',
  'Sentinelli',
  '09876543',
  'SENTD1111E',
  'dir1@sentinel.test',
  'Dirtwo',
  'SENTE2222F',
  '9681726354',
];

export class FakeSuite implements SuitePort {
  profileValue: ProfileResult = SENTINEL_PROFILE;
  catalogValue: Catalog = { liveAllowed: false, agents: [] };
  recipeValue: SignedRecipe | null = null;
  resolver: ((p: ResolvePayload) => ResolveResponse) | null = null;
  calls: Array<{ name: string; body?: unknown }> = [];
  resolvePayloads: ResolvePayload[] = [];
  patches: PatchProposal[] = [];
  updates: RunUpdate[] = [];
  resolveContexts: ResolveContext[] = [];

  async catalog(): Promise<Catalog> {
    this.calls.push({ name: 'catalog' });
    return this.catalogValue;
  }
  async recipe(id: string): Promise<SignedRecipe> {
    this.calls.push({ name: 'recipe', body: id });
    if (!this.recipeValue) throw new Error('404');
    return this.recipeValue;
  }
  async profile(id: string): Promise<ProfileResult> {
    this.calls.push({ name: 'profile', body: id });
    return structuredClone(this.profileValue);
  }
  async createRun(_id: string, body: RunCreate): Promise<{ runId: string }> {
    this.calls.push({ name: 'createRun', body });
    return { runId: '7d1f3c2a-ab12-4c34-8d56-e7f8a9b0c1d2' };
  }
  async updateRun(_id: string, _runId: string, body: RunUpdate): Promise<void> {
    this.calls.push({ name: 'updateRun', body });
    this.updates.push(body);
  }
  async resolve(payload: ResolvePayload, ctx: ResolveContext): Promise<ResolveResponse> {
    this.calls.push({ name: 'resolve', body: payload });
    this.resolveContexts.push(ctx);
    this.resolvePayloads.push(payload);
    if (!this.resolver) throw new Error('no resolver');
    return this.resolver(payload);
  }
  async proposePatch(p: PatchProposal): Promise<void> {
    this.calls.push({ name: 'proposePatch', body: p });
    this.patches.push(p);
  }
  /** G17: the certifier's checks; recorded by default so tests that do not test the gate reach Submit. */
  attestationValue: AttestationStatus = { recorded: true, certifierName: 'Test certifier' };
  async attestation(_id: string, runId: string): Promise<AttestationStatus> {
    this.calls.push({ name: 'attestation', body: runId });
    return this.attestationValue;
  }
}

export class MemoryStore implements StorePort {
  value: Persisted | null = null;
  async load(): Promise<Persisted | null> {
    return this.value ? structuredClone(this.value) : null;
  }
  async save(p: Persisted): Promise<void> {
    this.value = structuredClone(p);
  }
  async clear(): Promise<void> {
    this.value = null;
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function pdfDrop(text = '%PDF-1.4 signed mock', signers: string[] = ['professional:self']) {
  const bytes = new TextEncoder().encode(text);
  return sha256(bytes).then((sha) => ({
    type: 'PDF_DROPPED' as const,
    name: 'signed.pdf',
    base64: Buffer.from(bytes).toString('base64'),
    sha256: sha,
    size: bytes.length,
    signers,
  }));
}

/**
 * A PortalPort over the jsdom document using the real PortalAgent. jsdom has no DataTransfer, so
 * `attach` sets the input's files directly; the bytes are still hashed from what was attached.
 */
export class JsdomPortal implements PortalPort {
  readonly agent = new PortalAgent(document);
  clickCalls: string[] = [];
  url = 'http://127.0.0.1:4318/spice-a.html';
  active = true;

  async tabInfo() {
    return { url: this.url, active: this.active };
  }
  async readBridge() {
    return readBridgeModel();
  }
  async scan(opts: Parameters<PortalAgent['scan']>[0]) {
    return this.agent.scan(opts);
  }
  async prepareFill(target: Parameters<PortalAgent['prepareFill']>[0]) {
    return this.agent.prepareFill(target);
  }
  async bridgeSet(som: string, value: string) {
    return bridgeSetValue(som, value, SECRET_FIELD_PATTERN.source);
  }
  fillOpts: Array<Parameters<PortalAgent['fill']>[3]> = [];
  async fill(target: Parameters<PortalAgent['fill']>[0], value: string, _label: string, bridgeTried: boolean, opts?: Parameters<PortalAgent['fill']>[3]) {
    this.fillOpts.push(opts);
    // The tests do not sleep through the portal's lookups; the waits they asked for are recorded.
    return this.agent.fill(target, value, bridgeTried, { optionsMs: Math.min(opts?.optionsMs ?? 0, 1000), settleMs: 0 });
  }
  async pageReady(css: string) {
    return this.agent.pageReady(css);
  }
  async closePopups(css: string[]) {
    return this.agent.closePopups(css);
  }
  async click(target: { css?: string; text?: string }, _label: string, resultCss?: string) {
    this.clickCalls.push(target.css ?? target.text ?? '');
    const res = await this.agent.click(target.css, target.text, resultCss);
    const el = this.agent.findButton(target.css, target.text);
    if (res.ok && el?.id) this.clickedIds.push(el.id);
    return res;
  }
  clickedIds: string[] = [];
  async attach(css: string, name: string, base64: string) {
    const input = document.querySelector(css) as HTMLInputElement;
    const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    const file = new File([bytes], name, { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // jsdom File has no arrayBuffer(); the real agent hashes the attached File (see e2e).
    return { ok: true, sha256: await sha256(bytes) };
  }
  async highlightHuman(gates: Parameters<PortalAgent['highlightHuman']>[0]) {
    return this.agent.highlightHuman(gates);
  }
  async readSrn(pattern?: string) {
    return this.agent.readSrn(pattern);
  }
  async markForRecords(targets: Parameters<PortalAgent['markForRecords']>[0]) {
    return this.agent.markForRecords(targets);
  }
  teachAnswer: Awaited<ReturnType<PortalPort['teach']>> = null;
  async teach() {
    return this.teachAnswer;
  }
  async cancelTeach() {}
  async banner() {}
}
