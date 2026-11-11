import { beforeEach, describe, expect, it } from 'vitest';
import { RunEngine, StartRefused } from './runner';
import { canTransition, transition, IllegalTransition, TERMINAL } from './machine';
import { applyTransform, getPath } from './values';
import { liveAllowedFor, isMockHost } from './live';
import { RECIPE_PUBLIC_KEYS, canonicalJson, validateRecipe, verifySignature } from './recipe';
import { globMatch, pageMatchesUrl } from './url';
import { entryMatches, expandFields, expandRecipe, MAX_REPEAT } from './expand';
import { normalizeRecipe } from '../recipes/normalize';
import { BUNDLED_RECIPES } from '../recipes';
import { FakeSuite, JsdomPortal, MemoryStore, PART_B_PROFILE, PART_B_VALUES, PROFILE_VALUES, SENTINEL_PROFILE, loadMockPage, mockState, pdfDrop } from '../test/mock-env';
import { compareVersions } from './kill';
import type { Run, RunState, SignedRecipe } from '../shared/types';

type Raw = { title: string; version: string; actions: Array<Record<string, unknown>> };

const START = { engagementId: 'eng-1', engagementName: 'Sentinel', agentId: 'incorporation', subAgentId: 'spice-a', recipeId: 'spice-a', portalTabId: 7 };

function setup(page: Parameters<typeof loadMockPage>[0] = 'spice-a.html') {
  loadMockPage(page);
  const suite = new FakeSuite();
  const portal = new JsdomPortal();
  const store = new MemoryStore();
  let t = 1_000;
  const engine = new RunEngine({ suite, store, portalFor: () => portal, bundledRecipes: BUNDLED_RECIPES, now: () => (t += 10), newId: () => 'run-1' });
  return { suite, portal, store, engine };
}

const value = (name: string) => (document.querySelector(`[name="${name}"]`) as HTMLInputElement).value;
const checked = (name: string) => (document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null)?.value ?? null;

/** Part B's wizard: the person opens a section from the step list (li.listep), as on MCA. */
function openSection(id: string) {
  (document.querySelector(`li.listep[data-section="${id}"]`) as HTMLElement).click();
}
const states = (run: Run): RunState[] =>
  run.log.filter((l) => l.kind === 'transition').map((l) => l.text.split(' → ')[1]!.split(' ')[0] as RunState);

/** A throwaway Ed25519 key, for recipes the tests sign themselves. */
async function testKey(): Promise<{ raw: string; sign: (recipe: unknown) => Promise<string> }> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const raw = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
  return {
    raw,
    sign: async (recipe) => Buffer.from(await crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, new TextEncoder().encode(canonicalJson(recipe)))).toString('base64'),
  };
}

describe('state machine', () => {
  it('allows only the table moves and any live state to FAILED or CANCELLED', () => {
    expect(canTransition('READY', 'PULL_PROFILE')).toBe(true);
    expect(canTransition('READY', 'FILL')).toBe(false);
    expect(canTransition('WAIT_SUBMIT_PAY', 'READ_SRN')).toBe(true);
    expect(canTransition('FILL', 'WAIT_SUBMIT_PAY')).toBe(false);
    expect(canTransition('WAIT_DSC', 'CANCELLED')).toBe(true);
    for (const s of TERMINAL) expect(canTransition(s, 'FAILED')).toBe(false);
  });

  it('logs every transition and throws on an illegal one', () => {
    const run = { state: 'READY', log: [] } as unknown as Run;
    const moved = transition(run, 'PULL_PROFILE', 'x', 5);
    expect(moved.log[0]).toMatchObject({ kind: 'transition', text: 'READY → PULL_PROFILE (x)' });
    expect(() => transition(moved, 'DONE', '', 6)).toThrow(IllegalTransition);
  });
});

describe('values', () => {
  it('reads key paths and applies transforms', () => {
    expect(getPath({ a: { b: ['x', 'y'] } }, 'a.b.1')).toBe('y');
    expect(applyTransform('Test Co', 'upper')).toBe('TEST CO');
    expect(applyTransform('2026-01-31', 'date')).toBe('31/01/2026');
    // MCA dates are DD/MM/YYYY, from any of the shapes Suite or a person might hold.
    expect(applyTransform('2026-01-31T00:00:00Z', 'date')).toBe('31/01/2026');
    expect(applyTransform('2026/1/5', 'date')).toBe('05/01/2026');
    expect(applyTransform('5-1-2026', 'date')).toBe('05/01/2026');
    expect(applyTransform('31.01.2026', 'date')).toBe('31/01/2026');
    expect(applyTransform('2026-13-01', 'date')).toBeUndefined();
    expect(applyTransform('Jan 5 2026', 'date')).toBeUndefined();
    expect(applyTransform(false, 'yesNo')).toBe('No');
    expect(applyTransform('62011', 'nicDivision')).toBe('62');
    expect(applyTransform(undefined, 'upper')).toBeUndefined();
    expect(applyTransform({ a: 1 })).toBeUndefined();
  });
});

describe('live switch (G11)', () => {
  it('allows mock hosts and refuses live hosts unless Suite allows them', () => {
    expect(isMockHost('127.0.0.1')).toBe(true);
    expect(liveAllowedFor(null, 'www.mca.gov.in')).toBe(false);
    expect(liveAllowedFor({ liveAllowed: false, agents: [] }, 'www.mca.gov.in')).toBe(false);
    expect(liveAllowedFor({ liveAllowed: true, agents: [] }, 'www.mca.gov.in')).toBe(true);
    expect(liveAllowedFor({ liveAllowed: true, liveHosts: ['www.mca.gov.in'], agents: [] }, 'www.gst.gov.in')).toBe(false);
  });
});

describe('recipes (G15)', () => {
  const bundled = BUNDLED_RECIPES['spice-a']!;
  const raw = () => structuredClone(bundled.recipe) as Raw;

  it('the bundled recipes carry the dev signature, verify on the mock and are well formed', async () => {
    expect(Object.keys(BUNDLED_RECIPES).sort()).toEqual(['agile-pro-s', 'eaoa', 'emoa', 'spice-a', 'spice-b']);
    for (const signed of Object.values(BUNDLED_RECIPES)) {
      expect(signed).toMatchObject({ alg: 'ed25519', keyId: 'dev' });
      expect(await verifySignature(signed, '127.0.0.1')).toEqual({ ok: true, keyId: 'dev' });
      expect(validateRecipe(normalizeRecipe(signed.recipe))).toEqual([]);
    }
    const recipe = normalizeRecipe(bundled.recipe);
    // Part A has no DSC step and no attach slot on MCA V3: Save and Auto check only.
    expect(recipe.attachCss).toBeUndefined();
    expect(recipe.actions.filter((a) => a.kind === 'safe').map((a) => a.role)).toEqual(['save', 'check']);
    expect(recipe.gates.map((g) => g.kind)).toEqual(['LOGIN', 'CAPTCHA', 'OTP', 'SUBMIT', 'PAY']);
    expect(recipe.gates.find((g) => g.kind === 'SUBMIT')).toMatchObject({ text: 'Submit' });
    expect(recipe.pages[0]).toMatchObject({ readyCss: '#guideContainer-rootPanel__ .guideFieldNode.type-of-company', closePopups: ['#okInfoModalBtn'] });
    expect(recipe.waits).toEqual({ readyMs: 30000, optionsMs: 8000, afterPincodeMs: 2000 });
    const b = normalizeRecipe(BUNDLED_RECIPES['spice-b']!.recipe);
    expect(b.attachCss).toContain('#signed-pdf');
    expect(b.pages.map((pg) => pg.id)).toEqual(['structure', 'address', 'subscribers', 'directors']);
  });

  it('the dev key is refused on a live host, before its signature counts', async () => {
    const r = await verifySignature(bundled, 'www.mca.gov.in');
    expect(r).toMatchObject({ ok: false });
    expect(r.reason).toMatch(/dev key.*mock hosts only/);
  });

  it('refuses an unknown key id, the prod placeholder, another algorithm and no key id', async () => {
    expect(RECIPE_PUBLIC_KEYS.prod).toBeNull();
    expect((await verifySignature({ ...bundled, keyId: 'prod' }, '127.0.0.1')).reason).toMatch(/not built into the extension/);
    expect((await verifySignature({ ...bundled, keyId: 'evil' }, '127.0.0.1')).ok).toBe(false);
    expect((await verifySignature({ ...bundled, keyId: '__proto__' }, '127.0.0.1')).ok).toBe(false);
    expect((await verifySignature({ ...bundled, keyId: undefined }, '127.0.0.1')).ok).toBe(false);
    expect((await verifySignature({ ...bundled, alg: 'HMAC-SHA256' }, '127.0.0.1')).reason).toMatch(/not ed25519/);
  });

  it('a recipe with one changed byte, or a bad signature, is refused', async () => {
    const tampered: SignedRecipe = { ...bundled, recipe: { ...raw(), title: `${raw().title.slice(0, -1)}X` } };
    expect((await verifySignature(tampered, '127.0.0.1')).reason).toMatch(/does not match/);
    expect((await verifySignature({ ...bundled, sig: 'not base64!' }, '127.0.0.1')).ok).toBe(false);
    expect((await verifySignature({ ...bundled, sig: Buffer.alloc(64).toString('base64') }, '127.0.0.1')).ok).toBe(false);
  });

  it('a key other than dev is accepted on a live host when it is built in', async () => {
    const key = await testKey();
    const signed: SignedRecipe = { recipe: raw(), sig: await key.sign(raw()), alg: 'ed25519', keyId: 'prod' };
    expect(await verifySignature(signed, 'www.mca.gov.in', { ...RECIPE_PUBLIC_KEYS, prod: key.raw })).toEqual({ ok: true, keyId: 'prod' });
    expect((await verifySignature(signed, 'www.mca.gov.in')).ok).toBe(false);
  });

  it('a validly signed recipe with a new action kind, or a "safe" Submit, is refused by shape', async () => {
    const newKind = raw();
    newKind.actions.push({ id: 'solve', kind: 'auto', label: 'Solve captcha', match: { css: '#x' } });
    expect(validateRecipe(normalizeRecipe(newKind)).join(' ')).toMatch(/unknown kind/);
    const safeSubmit = raw();
    safeSubmit.actions.push({ id: 'go', kind: 'safe', label: 'Final Submit', match: { text: 'Final Submit' } });
    expect(validateRecipe(normalizeRecipe(safeSubmit)).join(' ')).toMatch(/G4/);
    const key = await testKey();
    expect((await verifySignature({ recipe: newKind, sig: await key.sign(newKind), alg: 'ed25519', keyId: 't' }, '127.0.0.1', { t: key.raw })).ok).toBe(true);
  });
});

describe('page check (urlPattern)', () => {
  const page = { urlPattern: '/content/mca/global/en/mca/e-filing/incorporation-change-services/spice.html', mockUrlPattern: '/spice-a*.html' };

  it('matches the glob against the whole path', () => {
    expect(globMatch('/spice-a*.html', '/spice-a.html')).toBe(true);
    expect(globMatch('/spice-a*.html', '/spice-a-drift.html')).toBe(true);
    expect(globMatch('/spice-a*.html', '/spice-b.html')).toBe(false);
    expect(globMatch('/a?c', '/abc')).toBe(true);
    expect(globMatch('/a.c', '/abc')).toBe(false);
  });

  it('uses the mock pattern on a mock host and the real MCA URL elsewhere', () => {
    expect(pageMatchesUrl(page, 'http://127.0.0.1:4318/spice-a.html')).toBe(true);
    expect(pageMatchesUrl(page, 'http://127.0.0.1:4318/spice-b.html')).toBe(false);
    expect(pageMatchesUrl(page, 'https://www.mca.gov.in/content/mca/global/en/mca/e-filing/incorporation-change-services/spice.html')).toBe(true);
    expect(pageMatchesUrl(page, 'https://www.mca.gov.in/spice-a.html')).toBe(false);
    expect(pageMatchesUrl(page, 'not a url')).toBe(false);
  });
});

describe('repeating groups (each, where, nth)', () => {
  const recipe = normalizeRecipe(BUNDLED_RECIPES['spice-b']!.recipe);
  const templates = recipe.pages.flatMap((p) => p.fields);

  it('splits subscribers and directors into the MCA blocks by DIN, and numbers each block per selector', () => {
    const fields = expandFields(templates, PART_B_PROFILE.profile);
    // Both subscribers have no DIN: block 6c, entries 1 and 2.
    expect(fields.filter((f) => f.css === '.guideFieldNode.firstName6c').map((f) => [f.key, f.nth])).toEqual([
      ['subscribers[0].firstName@6c', 0],
      ['subscribers[1].firstName@6c', 1],
    ]);
    expect(fields.some((f) => f.key.endsWith('@6b'))).toBe(false);
    // Block 7b: the subscriber-director first, then the director without a DIN.
    expect(fields.filter((f) => f.css === '.guideFieldNode.firstName7bp').map((f) => [f.key, f.path, f.nth])).toEqual([
      ['subscribers[0].firstName@7b', 'subscribers[0].firstName', 0],
      ['directors[1].firstName@7b', 'directors[1].firstName', 1],
    ]);
    // Block 7a: the director with a DIN.
    expect(fields.filter((f) => f.css === '.guideFieldNode.din7a').map((f) => [f.key, f.nth])).toEqual([['directors[0].din@7a', 0]]);
    const din = fields.find((f) => f.key === 'directors[0].din@7a')!;
    expect(din).toMatchObject({ label: 'Director 1: DIN' });
    expect(din.each).toBeUndefined();
    expect(din.where).toBeUndefined();
    expect(fields.filter((f) => f.key.includes('{'))).toEqual([]);
  });

  it('filters entries with where: true is present, false is absent, a string is equal', () => {
    expect(entryMatches({ din: '01234567' }, { din: true })).toBe(true);
    expect(entryMatches({ din: '' }, { din: true })).toBe(false);
    expect(entryMatches({}, { din: false })).toBe(true);
    expect(entryMatches({ kind: 'bodyCorporate' }, { kind: 'individual' })).toBe(false);
    expect(entryMatches({ isDirector: false }, { isDirector: true })).toBe(false);
  });

  it('fills no block for an empty or absent array, and caps a huge one', () => {
    const none = expandFields(templates, { ...PART_B_PROFILE.profile, directors: [], subscribers: undefined });
    expect(none.some((f) => /^(directors|subscribers)\[/.test(f.key))).toBe(false);
    const many = expandFields(templates, { directors: Array.from({ length: 99 }, () => ({ din: '01234567' })) });
    expect(many.filter((f) => f.key.endsWith('.din@7a'))).toHaveLength(MAX_REPEAT);
  });

  it('leaves a recipe without templates as it is', () => {
    const a = normalizeRecipe(BUNDLED_RECIPES['spice-a']!.recipe);
    expect(expandRecipe(a, PART_B_PROFILE.profile).pages[0]!.fields.map((f) => f.key)).toEqual(a.pages[0]!.fields.map((f) => f.key));
  });
});

describe('run engine on the mock portal (real MCA keys)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('runs a full Part A filing with 0 AI calls, stops at every human gate and never clicks Submit or Pay', async () => {
    const { engine, suite, portal } = setup();
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.state).toBe('WAIT_LOGIN');
    expect(engine.run!.wait).toEqual({ kind: 'login' });

    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    expect(engine.run!.state).toBe('FILL');
    expect(engine.run!.wait).toEqual({ kind: 'confirm' });
    // The MCA information pop-up was closed, through the guarded click.
    expect(mockState().infoClosed).toBe(true);
    // G13: nothing is written before the user confirms the table.
    expect(mockState().modelWrites).toEqual([]);
    expect(value('proposedname1')).toBe('');
    const planned = engine.run!.fields.filter((f) => f.status === 'planned');
    expect(planned.map((f) => f.key).sort()).toEqual(
      ['company.category', 'company.class', 'company.nicCode', 'company.proposedNames[0]', 'company.proposedNames[1]', 'company.subCategory', 'company.type'].sort(),
    );
    // T0 is the real key class (.guideFieldNode.<key>).
    expect(planned.every((f) => f.tier === 'T0')).toBe(true);
    // askUser fields are the user's, whatever the profile holds.
    expect(engine.run!.fields.filter((f) => f.status === 'user').map((f) => f.key).sort()).toEqual(['company.nameSignificance', 'company.trademarkSimilar']);

    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(value('proposedname1')).toBe('Sentinel Alpha Private Limited');
    expect(value('proposedname2')).toBe('Sentinel Beta Private Limited');
    expect(value('significance')).toBe('');
    expect(value('type-of-company')).toBe('New Company (Others)');
    // Dependent dropdowns: their options load after the field before them, and the agent waits.
    expect(value('class-of-company')).toBe('Private');
    expect(value('category-of-company')).toBe('Company limited by shares');
    expect(value('subcategory-of-company')).toBe('Indian non-government company');
    expect(value('nic-text-box')).toBe('62011');
    expect(checked('trademarkSimilar')).toBeNull();
    expect(portal.fillOpts.filter((o) => (o?.optionsMs ?? 0) > 0)).toHaveLength(3);
    // The writes went through guideBridge first, and the DOM saw input, keyup and change.
    expect(mockState().modelWrites).toContain('proposedname1');
    expect(engine.run!.fields.filter((f) => f.status === 'filled')).toHaveLength(7);
    expect(engine.run!.aiCalls).toBe(0);
    expect(suite.resolvePayloads).toHaveLength(0);

    // Guards: the login controls were refused and stay empty.
    const codes = engine.run!.refusals.map((r) => r.code);
    expect(codes).toEqual(expect.arrayContaining(['G1', 'G2', 'G3']));
    for (const id of ['login-user', 'login-password', 'login-captcha', 'login-otp']) {
      expect((document.getElementById(id) as HTMLInputElement).value).toBe('');
    }

    // Part A has no DSC step: straight to Submit and Pay once Auto check passes.
    expect(engine.run!.state).toBe('WAIT_SUBMIT_PAY');
    await engine.tick();
    await engine.settle();
    expect(engine.run!.state).toBe('WAIT_SUBMIT_PAY');
    expect(mockState().clicks['btn-submit']).toBeUndefined();
    expect(mockState().clicks['btn-pay']).toBeUndefined();
    expect(mockState().clicks['btn-send-otp']).toBeUndefined();
    expect(portal.clickedIds).toEqual(['btn-check', 'btn-check']);
    expect(portal.agent.overlay.snapshot().filter((m) => m.kind === 'human')).toHaveLength(2);

    // The human clicks Submit and Pay.
    document.getElementById('btn-submit')!.click();
    document.getElementById('btn-pay')!.click();
    await engine.tick();
    await engine.settle();
    expect(engine.run!.state).toBe('DONE');
    expect(engine.run!.srn).toBe('AB1234567');
    expect(states(engine.run!)).toEqual([
      'PULL_PROFILE', 'WAIT_LOGIN', 'FILL', 'CHECK', 'DOWNLOAD', 'WAIT_DSC', 'ATTACH', 'RECHECK', 'WAIT_SUBMIT_PAY', 'READ_SRN', 'WRITE_BACK', 'DONE',
    ]);
    const last = suite.updates.at(-1)!;
    expect(last).toMatchObject({ srn: 'AB1234567', status: 'done', state: 'DONE', fieldsFilled: 7 });
    expect(last.refusals!.map((r) => r.kind)).toEqual(expect.arrayContaining(['login', 'captcha', 'otp']));

    // G9 and G14: nothing sent to Suite carries a profile value.
    const sent = JSON.stringify(suite.calls.filter((c) => c.name !== 'profile'));
    for (const v of PROFILE_VALUES) expect(sent).not.toContain(v);
  });

  it('moves past WAIT_LOGIN by itself once the login controls are gone', async () => {
    const { engine } = setup();
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.state).toBe('WAIT_LOGIN');
    document.getElementById('login-strip')!.hidden = true;
    await engine.tick();
    await engine.settle();
    expect(engine.run!.state).toBe('FILL');
  });

  it('waits for the form to be ready (#guideContainer-rootPanel__) before it plans anything', async () => {
    const { engine } = setup();
    const root = document.getElementById('guideContainer-rootPanel__')!;
    root.hidden = true;
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    expect(engine.run!.wait).toMatchObject({ kind: 'human_step', page: 'SPICe+ Part A' });
    expect(engine.run!.fields).toEqual([]);
    root.hidden = false;
    await engine.tick();
    await engine.settle();
    expect(engine.run!.wait).toEqual({ kind: 'confirm' });
  });

  it('resumes the FILL confirmation after a restart without writing anything', async () => {
    const { engine, store, suite, portal } = setup();
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    const again = new RunEngine({ suite, store, portalFor: () => portal, bundledRecipes: BUNDLED_RECIPES });
    await again.restore();
    await again.settle();
    expect(again.run!.wait).toEqual({ kind: 'confirm' });
    expect(mockState().modelWrites).toEqual([]);
  });

  it('heals the drift page at T1 with 0 tokens and proposes a patch', async () => {
    const { engine, suite } = setup('spice-a-drift.html');
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    const name2 = engine.run!.fields.find((f) => f.key === 'company.proposedNames[1]')!;
    expect(name2).toMatchObject({ tier: 'T1', foundLabel: 'Proposed Name II (Option 2)' });
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(value('nameOption2')).toBe('Sentinel Beta Private Limited');
    expect(value('proposedname1')).toBe('Sentinel Alpha Private Limited');
    expect(engine.run!.aiTokens).toBe(0);
    expect(suite.resolvePayloads).toHaveLength(0);
    expect(suite.patches).toHaveLength(1);
    expect(suite.patches[0]).toMatchObject({ fieldKey: 'company.proposedNames[1]', sourceTier: 'T1', proposed: { css: 'input#nameOption2', som: 'guide[0].guide1[0].guideRootPanel[0].nameOption2[0]', label: 'Proposed Name II (Option 2)' } });
    expect(engine.run!.heals).toEqual([{ fieldKey: 'company.proposedNames[1]', tier: 'T1', label: 'Proposed name II' }]);
  });

  it('heals at T3 when rules fail, sending labels only', async () => {
    const { engine, suite } = setup('spice-a-drift.html');
    document.querySelector('label[for="nameOption2"]')!.textContent = 'Alternative choice';
    suite.resolver = (p) => ({ choice: p.candidates.find((c) => c.name === 'nameOption2')!.i, tier: 'haiku', tokens: 1400 });
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(value('nameOption2')).toBe('Sentinel Beta Private Limited');
    expect(suite.resolveContexts[0]).toEqual({ recipeId: 'spice-a', runId: '7d1f3c2a-ab12-4c34-8d56-e7f8a9b0c1d2' });
    expect(engine.run!.aiCalls).toBe(1);
    expect(engine.run!.aiTokens).toBe(1400);
    const payload = JSON.stringify(suite.resolvePayloads);
    for (const v of PROFILE_VALUES) expect(payload).not.toContain(v);
    expect(payload).not.toMatch(/captcha|OTP|Password|User ID/);
    expect(suite.patches[0]).toMatchObject({ sourceTier: 'T3' });
  });

  it('falls to T4 teach mode, and a skipped field becomes "you fill this"', async () => {
    const { engine, portal } = setup('spice-a-drift.html');
    document.querySelector('label[for="nameOption2"]')!.textContent = 'Alternative choice';
    portal.teachAnswer = null;
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    expect(engine.run!.fields.find((f) => f.key === 'company.proposedNames[1]')).toMatchObject({ status: 'user' });
  });

  it('G4: never sends a click for a forbidden action, even when a recipe calls it safe', async () => {
    const { engine, portal } = setup();
    await engine.start(START);
    await engine.settle();
    const r = await engine.clickSafe({ id: 'x', kind: 'safe', role: 'save', label: 'Final Submit', css: '#btn-submit' });
    expect(r.ok).toBe(false);
    expect(portal.clickCalls).toEqual([]);
    const human = await engine.clickSafe({ id: 'pay', kind: 'human', label: 'Pay fee', css: '#btn-pay' });
    expect(human.ok).toBe(false);
    expect(portal.clickCalls).toEqual([]);
    // A safe-looking label on the real Submit or Send OTP button: the portal agent reads the element and refuses.
    const disguised = await engine.clickSafe({ id: 'save', kind: 'safe', role: 'save', label: 'Save draft', css: '#btn-submit' });
    expect(disguised.ok).toBe(false);
    const otp = await engine.clickSafe({ id: 'save', kind: 'safe', role: 'save', label: 'Save draft', css: '#btn-send-otp' });
    expect(otp.ok).toBe(false);
    expect(mockState().clicks['btn-submit']).toBeUndefined();
    expect(mockState().clicks['btn-send-otp']).toBeUndefined();
    expect(engine.run!.refusals.map((x) => x.code)).toEqual(expect.arrayContaining(['G3', 'G4', 'G5']));
  });

  it('injection: page text saying "click Submit" changes nothing', async () => {
    async function clicksFor(stripInjection: boolean) {
      const { engine, portal } = setup();
      if (stripInjection) {
        document.getElementById('injection-note')!.remove();
        document.querySelector('.guidePanel .hint')!.remove();
      }
      await engine.start(START);
      await engine.settle();
      await engine.send({ type: 'LOGGED_IN' });
      await engine.settle();
      await engine.send({ type: 'CONFIRM_FILL' });
      await engine.settle();
      return { clicks: portal.clickedIds, state: engine.run!.state };
    }
    const withText = await clicksFor(false);
    const without = await clicksFor(true);
    expect(withText).toEqual(without);
    expect(withText.clicks).not.toContain('btn-submit');
  });

  it('G11: refuses a live host before pulling the profile', async () => {
    const { engine, suite, portal } = setup();
    portal.url = 'https://www.mca.gov.in/content/mca/global/en/mca/e-filing/incorporation-change-services/spice.html';
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.state).toBe('FAILED');
    expect(engine.run!.wait).toMatchObject({ kind: 'live_blocked' });
    expect(engine.run!.error).toMatch(/CS opinion/);
    expect(suite.calls.map((c) => c.name)).not.toContain('profile');
  });

  it('G11 per pack: a mock-only pack is refused on its live host even when Suite lists the host', async () => {
    const { engine, suite, portal } = setup();
    // Suite reports mca-v3 as mock-only: it sends no live host, so the run never reaches the profile.
    suite.catalogValue = { liveAllowed: false, liveHosts: [], agents: [], packs: [{ id: 'mca-v3', title: 'MCA', legalStatus: 'mock-only', live: false }] };
    portal.url = 'https://www.mca.gov.in/content/mca/global/en/mca/e-filing/incorporation-change-services/spice.html';
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.state).toBe('FAILED');
    expect(engine.run!.wait).toMatchObject({ kind: 'live_blocked', host: 'www.mca.gov.in' });
    expect(suite.calls.map((c) => c.name)).not.toContain('profile');
  });

  it('G11 + G15: even with live allowed, the dev-signed recipe is refused on a live host', async () => {
    const { engine, suite, portal } = setup();
    suite.catalogValue = { liveAllowed: true, agents: [] };
    portal.url = 'https://www.mca.gov.in/form';
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.state).toBe('FAILED');
    expect(engine.run!.error).toMatch(/no usable recipe/);
    expect(suite.calls.map((c) => c.name)).not.toContain('profile');
  });

  it('G15: a tampered Suite recipe is refused and the bundled one is used on the mock', async () => {
    const { engine, suite } = setup();
    const bundled = BUNDLED_RECIPES['spice-a']!;
    suite.recipeValue = { ...bundled, recipe: { ...(bundled.recipe as Raw), version: '9.9.9' } };
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.recipeVersion).toBe((bundled.recipe as Raw).version);
    expect(engine.run!.recipeFrom).toBe('bundled');
    expect(engine.run!.log.some((l) => l.text.startsWith('G15: Suite recipe refused'))).toBe(true);
  });

  it("uses Suite's recipe on the mock when Suite serves it (dev key, mock hosts only)", async () => {
    const { engine, suite } = setup();
    suite.recipeValue = structuredClone(BUNDLED_RECIPES['spice-a']!);
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.recipeFrom).toBe('suite');
    expect(suite.calls.find((c) => c.name === 'createRun')!.body).toEqual({ subAgent: 'spice-a', portalHost: '127.0.0.1', recipeVersion: '2.0.0', fieldsTotal: 9, state: 'PULL_PROFILE' });
  });

  it('fills nothing while the portal tab shows another page, and goes on once the form page is back', async () => {
    const { engine, portal } = setup();
    portal.url = 'http://127.0.0.1:4318/somewhere-else.html';
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    expect(engine.run!.state).toBe('FILL');
    expect(engine.run!.wait).toEqual({ kind: 'wrong_page', page: 'SPICe+ Part A', path: '/somewhere-else.html' });
    expect(engine.run!.fields).toEqual([]);
    expect(engine.run!.log.some((l) => l.kind === 'refusal' && l.text.includes('/spice-a*.html'))).toBe(true);
    portal.url = 'http://127.0.0.1:4318/spice-a.html';
    await engine.tick();
    await engine.settle();
    expect(engine.run!.wait).toEqual({ kind: 'confirm' });
    // Navigating away between the confirmation and the write stops the write too.
    portal.url = 'http://127.0.0.1:4318/other.html';
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(engine.run!.wait).toMatchObject({ kind: 'wrong_page' });
    expect(mockState().modelWrites).toEqual([]);
    portal.url = 'http://127.0.0.1:4318/spice-a.html';
    await engine.send({ type: 'RETRY' });
    await engine.settle();
    expect(value('proposedname1')).toBe('Sentinel Alpha Private Limited');
  });

  it('G12: refuses to start in a tab that is not in front, and refuses a second run', async () => {
    const { engine, portal } = setup();
    portal.active = false;
    await expect(engine.start(START)).rejects.toBeInstanceOf(StartRefused);
    portal.active = true;
    await engine.start(START);
    await engine.settle();
    await expect(engine.start(START)).rejects.toBeInstanceOf(StartRefused);
  });

  it('cancels from a waiting state', async () => {
    const { engine } = setup();
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'CANCEL' });
    await engine.settle();
    expect(engine.run!.state).toBe('CANCELLED');
  });

  it('waits on check errors and lets the user retry', async () => {
    const { engine } = setup();
    await engine.start(START);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    // The user clears a required field before confirming; Auto check then fails.
    const fields = engine.run!.fields;
    (engine as unknown as { p: { run: Run } }).p.run.fields = fields.map((f) => (f.key === 'company.proposedNames[0]' ? { ...f, status: 'missing' } : f));
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(engine.run!.state).toBe('CHECK');
    expect(engine.run!.wait).toMatchObject({ kind: 'check_failed' });
    (document.querySelector('[name="proposedname1"]') as HTMLInputElement).value = 'Typed By The User Private Limited';
    await engine.send({ type: 'RETRY' });
    await engine.settle();
    expect(engine.run!.state).toBe('WAIT_SUBMIT_PAY');
  });
});

describe('SPICe+ Part B on the mock portal (wizard sections, real MCA keys)', () => {
  const START_B = { ...START, subAgentId: 'spice-b', recipeId: 'spice-b' };

  function setupB() {
    const env = setup('spice-b.html');
    env.portal.url = 'http://127.0.0.1:4318/spice-b.html';
    env.suite.profileValue = PART_B_PROFILE;
    return env;
  }

  /** Logs in, then confirms each wizard section, opening sections 2 to 4 itself as the person would. */
  async function fillAllSections(engine: RunEngine) {
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    for (const section of ['structure', 'address', 'subscribers', 'directors']) {
      if (section !== 'structure') {
        expect(engine.run!.wait).toMatchObject({ kind: 'human_step' });
        openSection(section);
        await engine.tick();
        await engine.settle();
      }
      expect(engine.run!.wait, section).toEqual({ kind: 'confirm' });
      await engine.send({ type: 'CONFIRM_FILL' });
      await engine.settle();
    }
  }

  it('fills the four sections, two subscriber and three director blocks at T0 with 0 AI calls, and stops at the human gates', async () => {
    const { engine, suite, portal } = setupB();
    await engine.start(START_B);
    await engine.settle();
    expect(engine.run!.recipeVersion).toBe('2.0.0');
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    expect(engine.run!.wait).toEqual({ kind: 'confirm' });
    expect(mockState().modelWrites).toEqual([]);
    // Only section 1 is planned until the person opens section 2.
    expect(engine.run!.fields.every((f) => f.key.startsWith('company.'))).toBe(true);
    const expected = expandRecipe(normalizeRecipe(BUNDLED_RECIPES['spice-b']!.recipe), PART_B_PROFILE.profile).pages.reduce((n, p) => n + p.fields.length, 0);
    expect(suite.calls.find((c) => c.name === 'createRun')!.body).toMatchObject({ subAgent: 'spice-b', fieldsTotal: expected });

    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(value('numberofeshares_1')).toBe('100000');
    expect(value('subeshare_1')).toBe('10000');
    expect(value('amountpershare_1')).toBe('10');
    expect(checked('aoaEntrenched')).toBe('No');
    // Section 2 is the person's to open (the li.listep wizard); the agent waits and never clicks it.
    expect(engine.run!.wait).toMatchObject({ kind: 'human_step', page: 'SPICe+ Part B, section 2: address of the company' });
    expect(portal.clickedIds).toEqual([]);
    openSection('address');
    await engine.tick();
    await engine.settle();
    expect(engine.run!.wait).toEqual({ kind: 'confirm' });
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(value('correspondenceaddressline1')).toBe('Sentinel Tower 1');
    expect(value('correspondenceaddress_pinCode')).toBe('500081');
    // The area list loads after the PIN code; the PIN code asked for the lookup wait.
    expect(value('Area1')).toBe('Gachibowli');
    expect(portal.fillOpts.some((o) => o?.settleMs === 2000)).toBe(true);
    expect(value('correspondenceaddress_emailID')).toBe('office@sentinel.test');
    expect(mockState().clicks['btn-send-otp']).toBeUndefined();
    expect(mockState().clicks['btn-verify-otp']).toBeUndefined();

    openSection('subscribers');
    await engine.tick();
    await engine.settle();
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    expect(value('firstName6c')).toBe('Subone');
    expect(value('firstName6c__2')).toBe('Subtwo');
    expect(value('pan6c')).toBe('SENTB1234C');
    expect(value('date6c')).toBe('01/02/1980');
    expect(value('fatherSurName__2')).toBe('Sentineldottir');
    expect(value('nationality')).toBe('India');
    expect(value('din6b')).toBe('');

    openSection('directors');
    await engine.tick();
    await engine.settle();
    // Designations are the user's (Suite does not hold them).
    expect(engine.run!.fields.filter((f) => f.status === 'user').map((f) => f.key).sort()).toEqual(['directors[0].designation@7a', 'directors[1].designation@7b', 'subscribers[0].designation@7b']);
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    // Block 7a: the director with a DIN. Block 7b: the subscriber-director, then the director without one.
    expect(value('din7a')).toBe('09876543');
    expect(value('din7a__2')).toBe('');
    expect(value('firstName7bp')).toBe('Subone');
    expect(value('firstName7bp__2')).toBe('Dirtwo');
    expect(value('pan7b__2')).toBe('SENTE2222F');
    expect(checked('citizenOfIndia7b')).toBe('Yes');
    expect(value('designation7a_1')).toBe('');
    expect(mockState().modelWrites).toContain('firstName7bp__2');
    expect(engine.run!.aiCalls).toBe(0);
    expect(suite.resolvePayloads).toHaveLength(0);
    expect(engine.run!.fields.filter((f) => f.tier && f.tier !== 'T0')).toEqual([]);
    expect(engine.run!.state).toBe('WAIT_DSC');

    await engine.send(await pdfDrop());
    await engine.settle();
    expect(engine.run!.state).toBe('WAIT_SUBMIT_PAY');
    expect(mockState().clicks['btn-submit']).toBeUndefined();
    // The captured Part B has no Auto check button: the agent clicks Download PDF only.
    expect(portal.clickedIds).toEqual(['btn-download']);
    document.getElementById('btn-submit')!.click();
    document.getElementById('btn-pay')!.click();
    await engine.tick();
    await engine.settle();
    expect(engine.run!.state).toBe('DONE');
    expect(engine.run!.srn).toBe('AC7654321');

    const sent = JSON.stringify(suite.calls.filter((c) => c.name !== 'profile'));
    for (const v of [...PART_B_VALUES, ...PROFILE_VALUES]) expect(sent).not.toContain(v);
  });

  it('leaves a block whose Add/Edit panel is not open to the person, never healing into another block', async () => {
    const { engine } = setupB();
    // Only one 6c block is open on the page.
    document.querySelectorAll('fieldset[data-block="6c"]')[1]!.remove();
    await engine.start(START_B);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    openSection('address');
    await engine.tick();
    await engine.settle();
    await engine.send({ type: 'CONFIRM_FILL' });
    await engine.settle();
    openSection('subscribers');
    await engine.tick();
    await engine.settle();
    const second = engine.run!.fields.find((f) => f.key === 'subscribers[1].firstName@6c')!;
    expect(second).toMatchObject({ status: 'user' });
    expect(second.note).toMatch(/open the Add\/Edit panel for block 2/);
    expect(engine.run!.fields.find((f) => f.key === 'subscribers[0].firstName@6c')).toMatchObject({ status: 'planned', tier: 'T0' });
    expect(engine.run!.aiCalls).toBe(0);
  });

  it('keeps the expanded plan across a restart', async () => {
    const { engine, store, suite, portal } = setupB();
    await engine.start(START_B);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    const again = new RunEngine({ suite, store, portalFor: () => portal, bundledRecipes: BUNDLED_RECIPES });
    await again.restore();
    await again.settle();
    await again.send({ type: 'CONFIRM_FILL' });
    await again.settle();
    for (const section of ['address', 'subscribers', 'directors']) {
      openSection(section);
      await again.tick();
      await again.settle();
      await again.send({ type: 'CONFIRM_FILL' });
      await again.settle();
    }
    expect(value('pan7b__2')).toBe('SENTE2222F');
  });

  it('resumes from storage after a restart (WAIT_DSC)', async () => {
    const { engine, store, suite, portal } = setupB();
    await engine.start(START_B);
    await engine.settle();
    await fillAllSections(engine);
    expect(engine.run!.state).toBe('WAIT_DSC');

    const again = new RunEngine({ suite, store, portalFor: () => portal, bundledRecipes: BUNDLED_RECIPES });
    await again.restore();
    await again.settle();
    expect(again.run!.state).toBe('WAIT_DSC');
    await again.send(await pdfDrop());
    await again.settle();
    expect(again.run!.state).toBe('WAIT_SUBMIT_PAY');
  });

  it('refuses to fill the Part B recipe on the Part A page', async () => {
    const { engine, portal } = setupB();
    portal.url = 'http://127.0.0.1:4318/spice-a.html';
    await engine.start(START_B);
    await engine.settle();
    await engine.send({ type: 'LOGGED_IN' });
    await engine.settle();
    expect(engine.run!.wait).toMatchObject({ kind: 'wrong_page', page: 'SPICe+ Part B, section 1: structure and capital' });
  });

  it('evidence: the MCA login label, the device and the signers reach Suite as labels and refs only', async () => {
    loadMockPage('spice-b.html');
    const suite = new FakeSuite();
    suite.profileValue = PART_B_PROFILE;
    const portal = new JsdomPortal();
    portal.url = 'http://127.0.0.1:4318/spice-b.html';
    const engine = new RunEngine({
      suite,
      store: new MemoryStore(),
      portalFor: () => portal,
      bundledRecipes: BUNDLED_RECIPES,
      extensionVersion: '0.2.0',
      device: async () => ({ installId: '0f6c1a2e-1111-4222-8333-944445555666', userAgent: 'TestAgent/1.0' }),
    });
    await engine.start({ ...START_B, mcaLoginLabel: 'lead@sbcfirm.in' });
    await engine.settle();
    expect(suite.calls.find((c) => c.name === 'createRun')!.body).toMatchObject({
      mcaLoginLabel: 'lead@sbcfirm.in',
      device: { installId: '0f6c1a2e-1111-4222-8333-944445555666', userAgent: 'TestAgent/1.0' },
      extensionVersion: '0.2.0',
    });
    expect(engine.run!.signerChoices!.map((c) => c.ref)).toEqual(['director:e3', 'director:e4', 'subscriber:1', 'subscriber:2', 'professional:self']);
    await fillAllSections(engine);
    // A drop with no signer (or one the panel never offered) is not taken.
    await engine.send(await pdfDrop(undefined, []));
    await engine.settle();
    await engine.send(await pdfDrop(undefined, ['director:forged']));
    await engine.settle();
    expect(engine.run!.state).toBe('WAIT_DSC');
    await engine.send(await pdfDrop(undefined, ['director:e3', 'professional:self']));
    await engine.settle();
    expect(engine.run!.state).toBe('WAIT_SUBMIT_PAY');
    expect(suite.updates.at(-1)!.dscSigners).toEqual(['director:e3', 'professional:self']);
    const sent = JSON.stringify(suite.calls.filter((c) => c.name !== 'profile'));
    for (const v of PART_B_VALUES) expect(sent).not.toContain(v);
  });
});

describe('filing safeguards (G16, G17, G18)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  async function toConfirm(env: ReturnType<typeof setup>, start = START) {
    await env.engine.start(start);
    await env.engine.settle();
    await env.engine.send({ type: 'LOGGED_IN' });
    await env.engine.settle();
  }

  it('G16: a placeholder or the firm’s own contact is never typed; the field is marked and recorded', async () => {
    const env = setup();
    const company = SENTINEL_PROFILE.profile.company as Record<string, unknown>;
    env.suite.profileValue = { ...SENTINEL_PROFILE, profile: { ...SENTINEL_PROFILE.profile, company: { ...company, proposedNames: ['N/A', 'desk@sbcfirm.in'] } } };
    env.suite.catalogValue = { liveAllowed: false, agents: [], firmContacts: { emails: ['desk@sbcfirm.in'], phones: [] } };
    await toConfirm(env);
    const f1 = env.engine.run!.fields.find((f) => f.key === 'company.proposedNames[0]')!;
    const f2 = env.engine.run!.fields.find((f) => f.key === 'company.proposedNames[1]')!;
    expect(f1).toMatchObject({ status: 'placeholder', blank: 'placeholder' });
    expect(f2).toMatchObject({ status: 'placeholder', blank: 'firm_contact' });
    expect(f1.value).toBeUndefined();
    expect(env.portal.agent.overlay.snapshot().filter((m) => m.kind === 'records').map((m) => m.text)).toEqual([
      "You fill this from the client's records",
      "You fill this from the client's records",
    ]);
    await env.engine.send({ type: 'CONFIRM_FILL' });
    await env.engine.settle();
    expect(value('proposedname1')).toBe('');
    expect(value('proposedname2')).toBe('');
    expect(env.engine.run!.log.some((l) => l.text.startsWith('G16:'))).toBe(true);
    const last = env.suite.updates.at(-1)!;
    expect(last.blanks).toEqual(
      expect.arrayContaining([
        { field: 'company.proposedNames[0]', reason: 'placeholder' },
        { field: 'company.proposedNames[1]', reason: 'firm_contact' },
      ]),
    );
    expect(JSON.stringify(env.suite.calls.filter((c) => c.name !== 'profile' && c.name !== 'catalog'))).not.toContain('desk@sbcfirm.in');
  });

  it('G16: a mandatory field Suite lacks is marked for the client’s records; an optional one is only listed', async () => {
    const env = setup();
    const company = { ...(SENTINEL_PROFILE.profile.company as Record<string, unknown>) };
    delete company.type;
    company.proposedNames = ['Sentinel Alpha Private Limited'];
    env.suite.profileValue = { ...SENTINEL_PROFILE, profile: { ...SENTINEL_PROFILE.profile, company } };
    await toConfirm(env);
    expect(env.engine.run!.fields.find((f) => f.key === 'company.type')).toMatchObject({ status: 'missing', blank: 'missing' });
    const optional = env.engine.run!.fields.find((f) => f.key === 'company.proposedNames[1]')!;
    expect(optional.status).toBe('missing');
    expect(optional.blank).toBeUndefined();
  });

  it('G17: the Submit card and the Submit highlight wait for the certifier’s checks in Suite', async () => {
    const env = setup();
    env.suite.attestationValue = { recorded: false };
    await toConfirm(env);
    await env.engine.send({ type: 'CONFIRM_FILL' });
    await env.engine.settle();
    expect(env.engine.run!.state).toBe('WAIT_SUBMIT_PAY');
    expect(env.engine.run!.wait).toEqual({ kind: 'certifier' });
    expect(env.portal.agent.overlay.snapshot().filter((m) => m.kind === 'human')).toHaveLength(0);
    await env.engine.tick();
    await env.engine.settle();
    expect(env.engine.run!.wait).toEqual({ kind: 'certifier' });
    expect(env.suite.calls.filter((c) => c.name === 'attestation').length).toBeGreaterThanOrEqual(2);

    env.suite.attestationValue = { recorded: true, certifierName: 'CA Partner' };
    await env.engine.tick();
    await env.engine.settle();
    expect(env.engine.run!.wait).toEqual({ kind: 'submit_pay' });
    expect(env.engine.run!.attestation).toMatchObject({ certifierName: 'CA Partner' });
    expect(env.portal.agent.overlay.snapshot().filter((m) => m.kind === 'human')).toHaveLength(2);
    expect(mockState().clicks['btn-submit']).toBeUndefined();
  });

  it('G17: an SRN that appears before the checks is read and the bypass is logged', async () => {
    const env = setup();
    env.suite.attestationValue = { recorded: false };
    await toConfirm(env);
    await env.engine.send({ type: 'CONFIRM_FILL' });
    await env.engine.settle();
    document.getElementById('btn-submit')!.click();
    document.getElementById('btn-pay')!.click();
    await env.engine.tick();
    await env.engine.settle();
    expect(env.engine.run!.state).toBe('DONE');
    expect(env.engine.run!.log.some((l) => /G17: the SRN appeared before/.test(l.text))).toBe(true);
  });

  it('G18: Suite’s kill switch stops the run before the profile is pulled', async () => {
    const env = setup();
    env.suite.catalogValue = { liveAllowed: false, agents: [], extensionDisabled: true };
    await env.engine.start(START);
    await env.engine.settle();
    expect(env.engine.run!.state).toBe('FAILED');
    expect(env.engine.run!.wait).toMatchObject({ kind: 'disabled' });
    expect(env.suite.calls.some((c) => c.name === 'profile' || c.name === 'recipe')).toBe(false);
  });

  it('G18: an extension below Suite’s minimum version refuses to run; an unreadable catalog waits', async () => {
    loadMockPage('spice-a.html');
    const suite = new FakeSuite();
    suite.catalogValue = { liveAllowed: false, agents: [], minExtensionVersion: '0.3.0' };
    const portal = new JsdomPortal();
    const engine = new RunEngine({ suite, store: new MemoryStore(), portalFor: () => portal, bundledRecipes: BUNDLED_RECIPES, extensionVersion: '0.2.9' });
    await engine.start(START);
    await engine.settle();
    expect(engine.run!.state).toBe('FAILED');
    expect(engine.run!.error).toMatch(/older than the version Suite requires \(0\.3\.0\)/);
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);

    const env = setup();
    env.suite.catalog = async () => {
      throw new Error('offline');
    };
    await env.engine.start(START);
    await env.engine.settle();
    expect(env.engine.run!.state).toBe('READY');
    expect(env.engine.run!.wait).toMatchObject({ kind: 'suite_error' });
    expect(env.suite.calls.some((c) => c.name === 'profile')).toBe(false);
  });
});
