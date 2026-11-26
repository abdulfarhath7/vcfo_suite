import { describe, expect, it } from 'vitest';
import { GST_RUN_TRANSITIONS, canMove, checkLabels, checksComplete, nextStatus, nextStep, runSteps, stepKeysFor, type RunFacts } from './run-state';
import type { GstReturnSummary, GstRunStatus } from './types';

const summary = (over: Partial<GstReturnSummary> = {}): GstReturnSummary => ({ form: 'gstr3b', table: { columns: [], rows: [] }, lines: [], fetchedAt: '2026-11-26T00:00:00Z', ...over });
const facts = (over: Partial<RunFacts> = {}): RunFacts => ({ form: 'gstr3b', status: 'draft', summary: null, flow: {}, sessionActive: true, pendingOtp: null, ...over });

describe('GST return state machine', () => {
  it('starts with consent when no GSTN session is active, else saves', () => {
    expect(nextStatus('draft', { type: 'start', sessionActive: false })).toBe('consent_needed');
    expect(nextStatus('draft', { type: 'start', sessionActive: true })).toBe('saving');
    expect(nextStatus('saved', { type: 'start', sessionActive: true })).toBeNull();
  });

  it('runs the happy path to filed', () => {
    const path: Array<[GstRunStatus, Parameters<typeof nextStatus>[1], GstRunStatus]> = [
      ['consent_needed', { type: 'consent_established' }, 'saving'],
      ['saving', { type: 'saved' }, 'saved'],
      ['saved', { type: 'check_complete' }, 'checked'],
      ['checked', { type: 'file_start' }, 'filing'],
      ['filing', { type: 'filed' }, 'filed'],
    ];
    for (const [from, ev, to] of path) expect(nextStatus(from, ev)).toBe(to);
  });

  it('refuses to file before both checks', () => {
    expect(nextStatus('saved', { type: 'file_start' })).toBeNull();
    expect(nextStatus('saving', { type: 'filed' })).toBeNull();
    expect(canMove('saved', 'filing')).toBe(false);
  });

  it('unticks back to saved and retries from where it failed', () => {
    expect(nextStatus('checked', { type: 'check_incomplete' })).toBe('saved');
    expect(nextStatus('failed', { type: 'retry', at: 'save' })).toBe('saving');
    expect(nextStatus('failed', { type: 'retry', at: 'file' })).toBe('checked');
    expect(nextStatus('saving', { type: 'failed', at: 'save' })).toBe('failed');
  });

  it('cancels anything but a filed or cancelled run, and a filed run never moves', () => {
    expect(nextStatus('filing', { type: 'cancel' })).toBe('cancelled');
    expect(nextStatus('filed', { type: 'cancel' })).toBeNull();
    expect(GST_RUN_TRANSITIONS.filed).toEqual([]);
  });

  it('needs both certifier checks', () => {
    expect(checksComplete({ figures: { by: 'u', at: 'x' } })).toBe(false);
    expect(checksComplete({ figures: { by: 'u', at: 'x' }, unmatched: { by: 'u', at: 'y' } })).toBe(true);
    expect(checkLabels('gstr3b', summary({ twoB: { itcIn2b: 1, itcClaimed: 10, difference: 9 } })).unmatched).toMatch(/differs from GSTR-2B/);
    expect(checkLabels('gstr1', null).unmatched).toMatch(/e-invoices/);
  });
});

describe('steps strip and next step', () => {
  it('has a Pay step only for GSTR-3B', () => {
    expect(stepKeysFor('gstr3b')).toContain('pay');
    expect(stepKeysFor('gstr1')).not.toContain('pay');
  });

  it('marks the current step', () => {
    const s = runSteps(facts({ status: 'saved', summary: summary() }));
    expect(s.find((x) => x.state === 'current')?.key).toBe('check');
    expect(s.filter((x) => x.state === 'done').map((x) => x.key)).toEqual(['data', 'consent', 'save']);
  });

  it('asks the person to pay when the cash ledger is short, then to set off', () => {
    const short = facts({ status: 'checked', summary: summary({ cashShort: 60000 }) });
    expect(runSteps(short).find((x) => x.state === 'current')?.key).toBe('pay');
    expect(nextStep(short)).toMatchObject({ kind: 'pay' });
    expect(nextStep(short).text).toContain('60,000');
    const paid = facts({ status: 'checked', summary: summary({ cashShort: 0 }) });
    expect(nextStep(paid).kind).toBe('offset');
    expect(runSteps(paid).find((x) => x.key === 'pay')?.state).toBe('done');
  });

  it('offers the EVC after the offset, then waits for the OTP', () => {
    expect(nextStep(facts({ status: 'filing', summary: summary(), flow: { offsetDone: true } })).kind).toBe('evc');
    expect(nextStep(facts({ status: 'filing', summary: summary(), flow: { offsetDone: true }, pendingOtp: 'evc' })).kind).toBe('evc_wait');
    expect(nextStep(facts({ form: 'gstr1', status: 'checked', summary: summary({ form: 'gstr1' }) })).kind).toBe('proceed');
  });

  it('asks for consent again when the session lapsed', () => {
    expect(nextStep(facts({ status: 'checked', summary: summary({ cashShort: 0 }), sessionActive: false })).kind).toBe('consent');
    expect(nextStep(facts({ status: 'consent_needed', pendingOtp: 'gstn_consent' })).kind).toBe('consent_wait');
    expect(nextStep(facts({ status: 'consent_needed', sessionActive: false })).kind).toBe('consent');
    // Consent given on another run: the session is open, so the run saves.
    expect(nextStep(facts({ status: 'consent_needed', sessionActive: true })).kind).toBe('start');
    expect(nextStatus('consent_needed', { type: 'save' })).toBe('saving');
  });

  it('shows the work while a job runs and the failure after', () => {
    expect(nextStep(facts({ status: 'saving', flow: { working: 'save' } })).kind).toBe('working');
    const failed = facts({ status: 'failed', flow: { failedAt: 'file' } });
    expect(nextStep(failed).kind).toBe('retry');
    expect(runSteps(failed).find((x) => x.state === 'attention')?.key).toBe('file');
    expect(runSteps(facts({ status: 'filed' })).every((x) => x.state === 'done')).toBe(true);
  });
});
