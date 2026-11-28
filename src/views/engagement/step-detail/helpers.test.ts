import { describe, expect, it } from 'vitest';
import { getPreIncPhases } from '@/data/checklist';
import { gateActiveCatalog } from '@/lib/checklist/checklist-step-gate';
import { journeyRailItems } from './helpers';

describe('SB-01 step side rail', () => {
  const partB = getPreIncPhases()[1]!.items;
  const gates = gateActiveCatalog({}, 'staff');

  it('lists Part B in MCA form order with MCA section codes, and the rest in checklist order', () => {
    const rows = journeyRailItems(partB, gates, {}, null, undefined, undefined, false);
    expect(rows.map((r) => r.item.id).slice(0, 5)).toEqual(['pre-13', 'pre-14', 'pre-16', 'pre-15', 'pre-7']);
    expect(rows.slice(0, 4).map((r) => r.stepCode)).toEqual(['MCA 3A', 'MCA 4', 'MCA 5–6', 'MCA 7']);
    expect(rows[4]!.stepCode).toMatch(/^Step \d+$/);
  });

  it('keeps each step number at its checklist (gating) position', () => {
    const rows = journeyRailItems(partB, gates, {}, null, undefined, undefined, true);
    const byId = Object.fromEntries(rows.map((r) => [r.item.id, r.stepNumber]));
    expect(byId['pre-15']).toBe(3);
    expect(byId['pre-16']).toBe(4);
    expect(rows[0]!.stepCode).toBeUndefined();
  });
});

describe('PLAN K completeness marks on the lead rail', () => {
  const phase1 = getPreIncPhases()[0]!.items;

  it('marks the open step and steps holding drafts, never untouched later steps or the manager rail', () => {
    const state = { 'pre-5': { status: 'in-progress', responses: { approvedCompanyName: 'Bonterra Private Limited' } } } as never;
    const gates = gateActiveCatalog(state, 'intern');
    const rows = journeyRailItems(phase1, gates, state, null, 'independent', undefined, false, { ownershipType: 'independent' });
    const byId = Object.fromEntries(rows.map((r) => [r.item.id, r.completeness]));
    // Client Details is the open step: it shows what it still needs.
    expect(byId['pre-1']).toMatchObject({ complete: false });
    // Name Approval is not open yet but holds a draft, so it is marked too.
    expect(byId['pre-5']).toMatchObject({ complete: false });
    expect(byId['pre-5']!.missing).toBeGreaterThan(0);
    // Name Application is untouched and not open: no mark.
    expect(byId['pre-4']).toBeUndefined();
    const managerRows = journeyRailItems(phase1, gates, state, null, 'independent', undefined, false);
    expect(managerRows.every((r) => r.completeness === undefined)).toBe(true);
  });
});

describe('rail marks follow the step head', () => {
  const phase1 = getPreIncPhases()[0]!.items;
  const done = (rows: ReturnType<typeof journeyRailItems>) => rows.filter((r) => r.gate.kind === 'done').map((r) => r.item.id);

  // Client Details is filled but not submitted, so every later step is gated behind it.
  const filledNotSubmitted = { status: 'in-progress', responses: { proposedName1: 'Emburse India' } };

  it('ticks and counts a direct-flow step complete by its data, even behind an open step', () => {
    const state = {
      'pre-1': filledNotSubmitted,
      'pre-4': { status: 'in-progress', locked: true, clientSubmittedAt: '2026-11-20T10:00:00Z' },
    } as never;
    const rows = journeyRailItems(phase1, gateActiveCatalog(state, 'staff'), state, null, 'independent', undefined, false);
    const pre4 = rows.find((r) => r.item.id === 'pre-4')!;
    expect(pre4.status).toBe('completed');
    expect(done(rows)).toEqual(['pre-4']);
    // Opening and editing still follow the real gate.
    expect(pre4.gate.canEdit).toBe(false);
  });

  it('ticks the board resolution step the head shows as Done', () => {
    const state = { 'pre-1': filledNotSubmitted, 'pre-2': { status: 'completed' } } as never;
    const rows = journeyRailItems(phase1, gateActiveCatalog(state, 'staff'), state, null, 'independent', undefined, false);
    expect(done(rows)).toEqual(['pre-2']);
    expect(rows.find((r) => r.item.id === 'pre-1')!.gate.kind).not.toBe('done');
  });

  it('still needs the usual approval for a normal step', () => {
    const state = { 'pre-1': filledNotSubmitted, 'pre-2': { status: 'in-progress', responses: { resolutionDate: '2026-11-20' } } } as never;
    const rows = journeyRailItems(phase1, gateActiveCatalog(state, 'staff'), state, null, 'independent', undefined, false);
    expect(done(rows)).toEqual([]);
  });

  it('counts the same steps for an admin, a lead and the client', () => {
    const state = {
      'pre-1': filledNotSubmitted,
      'pre-2': { status: 'completed' },
      'pre-4': { status: 'in-progress', locked: true, clientSubmittedAt: '2026-11-20T10:00:00Z' },
    } as never;
    const admin = journeyRailItems(phase1, gateActiveCatalog(state, 'staff'), state, null, 'independent', undefined, false);
    const lead = journeyRailItems(phase1, gateActiveCatalog(state, 'intern'), state, null, 'independent', undefined, false, { ownershipType: 'independent' });
    const client = journeyRailItems(phase1, gateActiveCatalog(state, 'client'), state, null, 'independent', undefined, true);
    expect(done(admin)).toEqual(['pre-2', 'pre-4']);
    expect(done(lead)).toEqual(done(admin));
    expect(done(client)).toEqual(done(admin));
  });
});
