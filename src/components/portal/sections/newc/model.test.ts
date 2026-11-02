import { describe, expect, it } from 'vitest';
import { getItem } from '@/data/checklist';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import type { ClientFileRequestDto } from '@/lib/client-portal/incorporation-types';
import {
  boardStateOf,
  boardStepId,
  declarationsOf,
  intakeProgress,
  intakeSteps,
  intakeTotals,
  newcStages,
  newcStatus,
  requiredDetails,
  signBadge,
  spiceStageOf,
  type StateMap,
} from './model';

const TODAY = '2026-10-28';
const done = (responses: Record<string, string> = {}) => ({ status: 'completed', responses, completedOn: '2026-10-01' });

/** Part A, board resolution and name approval done: Part B is the client's. */
function partBOpen(extra: StateMap = {}): StateMap {
  return {
    'pre-1': done({ director1FirstName: 'Asha', director1LastName: 'Rao', director1IndiaResident: 'yes', director2FirstName: 'Tom', director2LastName: 'Lee', director2IndiaResident: 'no', directorCount: '2' }),
    'pre-2': done(),
    'pre-3': done({ signedBoardResolutionUrl: 'eng/x/br.pdf' }),
    'pre-4': done(),
    'pre-5': done(),
    ...extra,
  } as StateMap;
}

describe('intake progress', () => {
  it('counts the visible required details and the real validator errors', () => {
    const item = getItem('pre-13')!;
    const empty = intakeProgress(item, {});
    expect(empty.required).toBe(2); // equityShares + preferenceShares
    expect(empty.filled).toBe(0);
    expect(empty.ready).toBe(false);

    const state = { 'pre-13': { status: 'in-progress', responses: { equityShares: 'yes', equityQuantity: '10000', equityNominalValue: 'ten', preferenceShares: 'no' } } } as StateMap;
    const p = intakeProgress(item, state);
    // equityQuantity + equityNominalValue appear once equity is chosen
    expect(p.required).toBe(4);
    expect(p.filled).toBe(3);
    expect(p.missing.map((m) => m.id)).toEqual(['equityNominalValue']);
    expect(p.missing[0]!.message).toMatch(/nominal value/i);
  });

  it('is ready when the validator passes', () => {
    const state = { 'pre-13': { status: 'in-progress', responses: { equityShares: 'yes', equityQuantity: '10000', equityNominalValue: '10', preferenceShares: 'no' } } } as StateMap;
    const p = intakeProgress(getItem('pre-13')!, state);
    expect(p).toMatchObject({ required: 4, filled: 4, missing: [], ready: true });
  });

  it('never counts a lead-only field (the NIC codes) against the client', () => {
    const ids = requiredDetails(getItem('pre-1')!, {}, 'subsidiary').map((r) => r.id);
    expect(ids).not.toContain('nicCode');
    const p = intakeProgress(getItem('pre-1')!, {}, { ownershipType: 'subsidiary' });
    expect(p.missing.some((m) => m.id === 'nicCode')).toBe(false);
  });

  it('expands repeat entries (one set of required details per proposed director)', () => {
    const one = requiredDetails(getItem('pre-15')!, { directors: 'e1' }).length;
    const two = requiredDetails(getItem('pre-15')!, { directors: 'e1,e2' }).length;
    expect(one).toBeGreaterThan(0);
    expect(two).toBe(one * 2);
  });
});

describe('intake steps and totals', () => {
  it('lists Part A and Part B intake steps in order with their state', () => {
    const state = partBOpen();
    const model = buildIncorporationModel(state as never, null, TODAY);
    const steps = intakeSteps(model, state);
    expect(steps.map((s) => s.id)).toEqual(['pre-1', 'pre-13', 'pre-14', 'pre-15', 'pre-16']);
    expect(steps[0]).toMatchObject({ state: 'done', part: 'SPICe+ Part A' });
    expect(steps[0]!.filled).toBe(steps[0]!.required);
    expect(steps[1]).toMatchObject({ state: 'open', part: 'SPICe+ Part B' });
    const t = intakeTotals(steps);
    expect(t.open).toBeGreaterThan(0);
    expect(t.first?.id).toBe('pre-13');
    expect(t.allSent).toBe(false);
  });

  it('a fresh project: only Part A is open, Part B is locked and not counted', () => {
    const model = buildIncorporationModel({} as never, null, TODAY);
    const steps = intakeSteps(model, {});
    expect(steps[0]!.state).toBe('open');
    expect(steps.slice(1).every((s) => s.state === 'locked')).toBe(true);
    const t = intakeTotals(steps);
    expect(t.required).toBe(steps[0]!.required);
    expect(t.first?.id).toBe('pre-1');
  });
});

describe('declarations', () => {
  const pre15 = {
    status: 'completed',
    responses: {
      directors: 'e1,e2',
      'directors.e1.firstName': 'Asha',
      'directors.e1.lastName': 'Rao',
      'directors.e1.indiaResident': 'yes',
      'directors.e2.firstName': 'Tom',
      'directors.e2.lastName': 'Lee',
      'directors.e2.indiaResident': 'no',
    },
  };

  it('lists what SBC prepares per director before anything is generated', () => {
    const d = declarationsOf({ 'pre-15': pre15 } as StateMap, []);
    const names = d.signers.map((s) => s.name);
    expect(names).toEqual(['Asha Rao', 'Tom Lee', 'Company documents']);
    const tom = d.signers.find((s) => s.name === 'Tom Lee')!;
    expect(tom.sub).toMatch(/Non-resident/);
    expect(tom.docs.map((x) => x.label)).toContain('PAN Undertaking');
    expect(d.signers.find((s) => s.name === 'Asha Rao')!.docs.map((x) => x.label)).not.toContain('PAN Undertaking');
    expect(d.generated).toBe(0);
    expect(d.toSign).toBe(0);
    expect(tom.docs.every((x) => x.state === 'todo')).toBe(true);
  });

  it('shared drafts are to sign; a signed copy comes from a file request or the legacy pre-8 upload', () => {
    const state = {
      'pre-15': pre15,
      'pre-7': {
        status: 'in-progress',
        responses: { residentDirectorDir2DraftUrl: 'eng/d/dir2-r.docx', nrDirectorDir2DraftUrl: 'eng/d/dir2-nr.docx', residentDirectorDir8DraftUrl: 'eng/d/dir8-r.docx' },
        sharedIncorpDraftDocs: ['dir-2:resident', 'dir-2:non-resident'],
        incorpDraftsSharedAt: '2026-10-20T10:00:00Z',
      },
      'pre-8': { status: 'in-progress', responses: { nrDirectorDir2SignedUrl: 'eng/nrDirectorDir2SignedUrl/signed.pdf' } },
    } as StateMap;
    const req: ClientFileRequestDto = { id: 'r1', stepId: 'pre-8', fieldId: 'residentDirectorDir2SignedUrl', label: 'Signed DIR-2', requestedAt: '2026-10-21' };
    const d = declarationsOf(state, [req]);
    const asha = d.signers.find((s) => s.name === 'Asha Rao')!;
    const dir2 = asha.docs.find((x) => x.doc === 'dir-2')!;
    expect(dir2).toMatchObject({ state: 'sign', shared: true, request: req });
    expect(asha.docs.find((x) => x.doc === 'dir-8')!.state).toBe('prep');
    expect(d.signers.find((s) => s.name === 'Tom Lee')!.docs.find((x) => x.doc === 'dir-2')!.state).toBe('signed');
    expect(d).toMatchObject({ generated: 3, shared: 2, signed: 1, toSign: 1 });
    expect(signBadge('done', d, [])).toBe(1);
  });

  it('drops the parent letters for an independent company', () => {
    const d = declarationsOf({ 'pre-15': pre15 } as StateMap, [], { ownershipType: 'independent' });
    const co = d.signers.find((s) => s.key === 'company')!;
    expect(co.docs.map((x) => x.doc)).not.toContain('authorisation-letter');
  });
});

describe('board resolution, stages and status', () => {
  it('board state follows pre-2 / pre-3', () => {
    const fresh = buildIncorporationModel({ 'pre-1': done() } as never, null, TODAY);
    expect(boardStateOf(fresh, null)).toBe('prep');
    expect(boardStepId(fresh)).toBe('pre-2');
    const released = buildIncorporationModel({ 'pre-1': done(), 'pre-2': done() } as never, null, TODAY);
    expect(boardStateOf(released, null)).toBe('sign');
    expect(boardStepId(released)).toBe('pre-3');
    expect(boardStateOf(released, { status: 'finalized', hasDocx: true, signedUploadedAt: '2026-10-02' })).toBe('sent');
    const all = buildIncorporationModel(partBOpen() as never, null, TODAY);
    expect(boardStateOf(all, null)).toBe('done');
  });

  it('six stages; the current one is "now"', () => {
    const model = buildIncorporationModel(partBOpen() as never, null, TODAY);
    const st = newcStages(model);
    expect(st).toHaveLength(6);
    expect(st.slice(0, 3).every((s) => s.state === 'done')).toBe(true);
    expect(st[3]).toMatchObject({ key: 'b', state: 'now', who: 'YOU', go: 'nmd' });
    expect(st[5]!.state).toBe('up');
  });

  it('status: master data first, then signing, then with SBC', () => {
    const state = partBOpen();
    const model = buildIncorporationModel(state as never, null, TODAY);
    const intake = intakeSteps(model, state);
    const decl = declarationsOf(state, []);
    const s = newcStatus({ model, intake, totals: intakeTotals(intake), board: 'done', decl, signNeeds: 0 });
    expect(s).toMatchObject({ pill: 'due', label: 'Your turn · master data', cta: { go: 'nmd' } });

    const fresh = buildIncorporationModel({ 'pre-1': done(), 'pre-2': done() } as never, null, TODAY);
    const i2 = intakeSteps(fresh, {});
    const s2 = newcStatus({ model: fresh, intake: i2, totals: intakeTotals(i2), board: 'sign', decl: declarationsOf({}, []), signNeeds: 0 });
    expect(s2).toMatchObject({ pill: 'due', label: 'Your turn · sign', cta: { go: 'nsign' } });
  });
});

/* One client portal for every client (owner, 2026-10-29): the same three sections must read right after incorporation too. */
describe('SPICe+ stage (one portal for every client)', () => {
  const spiceIds = (): string[] =>
    buildIncorporationModel({} as never, null, TODAY)
      .phases.filter((p) => p.no === 1 || p.no === 2)
      .flatMap((p) => p.steps.map((s) => s.id));

  it('pre while not incorporated, incorporated once the CIN is recorded', () => {
    const model = buildIncorporationModel(partBOpen() as never, null, TODAY);
    expect(spiceStageOf(model, false)).toBe('pre');
    expect(spiceStageOf(model, true)).toBe('incorporated');
  });

  it('skipped when every SPICe+ step is not applicable (a project that started after incorporation)', () => {
    const na = Object.fromEntries(spiceIds().map((id) => [id, { status: 'not-applicable', responses: {} }])) as StateMap;
    const model = buildIncorporationModel(na as never, null, TODAY);
    expect(spiceStageOf(model, true)).toBe('skipped');
    expect(spiceStageOf(model, false)).toBe('skipped');
  });

  it('after incorporation only an explicit request for a signed paper asks the client to sign', () => {
    const state = partBOpen();
    const model = buildIncorporationModel(state as never, null, TODAY);
    const intake = intakeSteps(model, state);
    const totals = intakeTotals(intake);
    const decl = { ...declarationsOf(state, []), toSign: 3 };
    // stale drafts / board state must not ask an incorporated company to sign
    expect(newcStatus({ model, intake, totals, board: 'sign', decl, signNeeds: 0, stage: 'incorporated' })).toMatchObject({ pill: 'ok', label: 'Incorporated' });
    expect(signBadge('sign', decl, [], 'incorporated')).toBe(0);
    // an explicit request still does
    const need = { id: 'n1', title: 'Signed MBP-1', kind: 'sign', createdAt: '2026-10-20' } as const;
    expect(newcStatus({ model, intake, totals, board: 'done', decl, signNeeds: 1, stage: 'incorporated' })).toMatchObject({ pill: 'due', label: 'Your turn · sign' });
    expect(signBadge('done', decl, [need], 'incorporated')).toBe(1);
    // before incorporation the drafts and the board still count
    expect(signBadge('sign', decl, [need], 'pre')).toBe(3 + 1 + 1);
  });
});
