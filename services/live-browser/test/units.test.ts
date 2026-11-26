import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { signBody, signViewerToken, verifyBody, verifyViewerToken } from '../../../src/lib/live-browser/contract';
import { cdpCommandFor, isInput, parseClientMessage } from '../src/input';
import { buildApproval, sha256, unapproved, withoutTypeOnPortal } from '../src/approval';
import { fieldViews, summarise } from '../src/status';
import { normalizeRecipe } from '../../../extensions/vcfo-assist/src/recipes/normalize';
import { PROFILE } from './fixtures';
import type { FieldOutcome, Run } from '../../../extensions/vcfo-assist/src/shared/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const SECRET = 'test-secret-that-is-long-enough-0123456789';
const SID = '11111111-2222-4333-8444-555555555555';
const signed = JSON.parse(readFileSync(path.join(here, '../../../extensions/vcfo-assist/src/recipes/bundled.json'), 'utf8')).recipes['spice-a'];


describe('contract signatures', () => {
  it('verifies a body it signed and refuses a changed, stale or unsigned one', () => {
    const body = JSON.stringify({ sessionId: SID });
    const now = 1_800_000_000;
    const header = signBody(SECRET, body, now);
    expect(verifyBody(SECRET, header, body, now + 10)).toBe(true);
    expect(verifyBody(SECRET, header, body.replace('1111', '9999'), now)).toBe(false);
    expect(verifyBody(SECRET, header, body, now + 301)).toBe(false);
    expect(verifyBody('another-secret-that-is-long-enough-012345', header, body, now)).toBe(false);
    expect(verifyBody(SECRET, null, body, now)).toBe(false);
    expect(verifyBody(SECRET, 't=abc,v1=zz', body, now)).toBe(false);
  });

  it('binds a viewer token to one session, one user, one role and a short life', () => {
    const now = 1_800_000_000;
    const token = signViewerToken(SECRET, { sid: SID, uid: 'user-1', role: 'watch' }, now);
    expect(verifyViewerToken(SECRET, token, SID, now + 60)).toMatchObject({ sid: SID, uid: 'user-1', role: 'watch' });
    expect(verifyViewerToken(SECRET, token, '99999999-2222-4333-8444-555555555555', now)).toBeNull();
    expect(verifyViewerToken(SECRET, token, SID, now + 121)).toBeNull();
    const [payload] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, sid: SID, uid: 'user-1', role: 'act', exp: now + 100 })).toString('base64url');
    expect(verifyViewerToken(SECRET, `${forged}.${token.split('.')[1]}`, SID, now)).toBeNull();
    expect(verifyViewerToken(SECRET, `${payload}.`, SID, now)).toBeNull();
  });
});

describe('viewer input', () => {
  const vp = { w: 1280, h: 800 };
  it('accepts the contract shapes, clamps numbers and drops anything else', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'mouse', type: 'mousePressed', x: 5000, y: -3, button: 'left', clickCount: 1 }), vp)).toMatchObject({ x: 1280, y: 0 });
    expect(parseClientMessage(JSON.stringify({ t: 'mouse', type: 'evil', x: 1, y: 1 }), vp)).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'key', type: 'keyDown', key: 'a', text: 'a' }), vp)).toMatchObject({ key: 'a', text: 'a' });
    expect(parseClientMessage(JSON.stringify({ t: 'text', text: 'x'.repeat(1001) }), vp)).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'event', event: 'SUBMIT' }), vp)).toBeNull();
    expect(parseClientMessage('not json', vp)).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'eval', code: 'alert(1)' }), vp)).toBeNull();
  });

  it('tells input from control, so a watch viewer can pause but not type', () => {
    expect(isInput({ t: 'key', type: 'keyDown', key: 'a' })).toBe(true);
    expect(isInput({ t: 'text', text: 'a' })).toBe(true);
    expect(isInput({ t: 'pause' })).toBe(false);
    expect(isInput({ t: 'event', event: 'CONFIRM_FILL' })).toBe(false);
  });

  it('maps to CDP input commands only', () => {
    expect(cdpCommandFor({ t: 'key', type: 'keyDown', key: 'a', text: 'a', keyCode: 65 })).toMatchObject({ method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', text: 'a' } });
    expect(cdpCommandFor({ t: 'key', type: 'keyDown', key: 'Tab', keyCode: 9 })).toMatchObject({ params: { type: 'rawKeyDown', windowsVirtualKeyCode: 9 } });
    expect(cdpCommandFor({ t: 'text', text: 'hello' })).toEqual({ method: 'Input.insertText', params: { text: 'hello' } });
    expect(cdpCommandFor({ t: 'wheel', x: 1, y: 2, dx: 0, dy: 100 })?.params).toMatchObject({ type: 'mouseWheel', deltaY: 100 });
    expect(cdpCommandFor({ t: 'pause' })).toBeNull();
  });
});

describe('G13 approval', () => {
  const recipe = normalizeRecipe(signed.recipe);
  it('covers every field Suite holds a value for, by key and value hash', () => {
    const approval = buildApproval(signed.recipe, PROFILE);
    expect(approval.get('company.proposedNames[0]')).toBe(sha256('Orbit Labs Private Limited'));
    expect(approval.has('company.nameSignificance')).toBe(false);
    const planned: FieldOutcome[] = [{ key: 'company.proposedNames[0]', label: 'I.', status: 'planned', tier: 'T0', value: 'Orbit Labs Private Limited' }];
    expect(unapproved(planned, approval)).toBeNull();
  });

  it('waits for the person on a changed value, a field outside the approval or an AI heal', () => {
    const approval = buildApproval(signed.recipe, PROFILE, ['company.type']);
    expect(unapproved([{ key: 'company.type', label: 'Type', status: 'planned', tier: 'T0', value: 'Nidhi Company' }], approval)).toEqual(['Type']);
    expect(unapproved([{ key: 'company.class', label: 'Class', status: 'planned', tier: 'T0', value: 'Private' }], approval)).toEqual(['Class']);
    expect(unapproved([{ key: 'company.type', label: 'Type', status: 'planned', tier: 'T3', value: 'New Company (Others)' }], approval)).toEqual(['Type']);
  });

  it('drops the fields the person types on the portal from the profile the engine sees', () => {
    const out = withoutTypeOnPortal(PROFILE, recipe, ['company.nicCode', 'company.proposedNames[1]']) as typeof PROFILE;
    expect(out.company.nicCode).toBeUndefined();
    expect(out.company.proposedNames[0]).toBe('Orbit Labs Private Limited');
    expect(out.company.proposedNames[1]).toBeUndefined();
    expect(PROFILE.company.nicCode).toBe('62011');
  });
});

describe('status mapping', () => {
  const run = (over: Partial<Run>): Run =>
    ({ id: 'r', engagementId: 'e', agentId: 'a', subAgentId: 's', recipeId: 'spice-a', recipeVersion: '1', portalTabId: 1, portalHost: '127.0.0.1', state: 'FILL', page: 0, fields: [], heals: [], refusals: [], aiCalls: 0, aiTokens: 0, log: [], startedAt: 0, updatedAt: 0, ...over }) as Run;

  it('names the human gate and the line for the banner', () => {
    expect(summarise(run({ state: 'WAIT_LOGIN', wait: { kind: 'login' } }))).toMatchObject({ status: 'your_turn', gate: 'LOGIN' });
    expect(summarise(run({ state: 'WAIT_SUBMIT_PAY', wait: { kind: 'certifier' } }))).toMatchObject({ gate: 'CERTIFIER' });
    expect(summarise(run({ state: 'WAIT_SUBMIT_PAY', wait: { kind: 'submit_pay' } }), { gates: [{ kind: 'SUBMIT', label: 'Submit' }] })).toMatchObject({ gate: 'SUBMIT' });
    expect(summarise(run({ state: 'FILL', fields: [{ key: 'a', label: 'A', status: 'filled' }, { key: 'b', label: 'B', status: 'planned' }] }))).toMatchObject({ status: 'running', fieldsDone: 1, fieldsTotal: 2 });
    expect(summarise(run({ state: 'DONE', srn: 'AB1234567' })).progressText).toContain('AB1234567');
    expect(summarise(run({ state: 'FILL' }), { unattended: true }).status).toBe('paused');
  });

  it('shows a value only in the confirm table', () => {
    const fields: FieldOutcome[] = [{ key: 'a', label: 'A', status: 'planned', value: 'secret-ish' }];
    expect(fieldViews(run({ fields }))[0]!.value).toBeUndefined();
    expect(fieldViews(run({ fields, wait: { kind: 'confirm' } }))[0]!.value).toBe('secret-ish');
  });
});
