import { describe, expect, it } from 'vitest';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import type { CredentialsPayload } from '@/lib/client-portal/credentials';
import { buildRegistrations, regDueWithin, regStatus, regWaiting, startsFilings } from './model';

const TODAY = '2026-10-14';

function credentials(rows: Array<{ key: string; number?: string; date?: string }>, gstin?: string): CredentialsPayload {
  return {
    ids: gstin ? [{ key: 'gstin', name: 'GSTIN', auth: 'gst', value: gstin, masked: null, secret: false }] : [],
    sheets: {
      reg: {
        id: 'reg',
        cols: [],
        rows: rows.map((r) => ({
          key: r.key,
          cells: { number: { v: r.number ?? null }, date: { v: r.date ?? null } },
        })),
      },
    },
  } as unknown as CredentialsPayload;
}

describe('regStatus', () => {
  it('uses the six words', () => {
    expect(regStatus({ kind: 'done', late: true })).toBe('Done');
    expect(regStatus({ kind: 'with', late: true })).toBe('Overdue');
    expect(regStatus({ kind: 'you', late: false })).toBe('Waiting');
    expect(regStatus({ kind: 'prog', late: false })).toBe('In progress');
    expect(regStatus({ kind: 'with', late: false })).toBe('In progress');
    expect(regStatus({ kind: 'next', late: false })).toBe('Not started');
    expect(regStatus({ kind: 'up', late: false })).toBe('Not started');
  });
});

describe('buildRegistrations', () => {
  const model = buildIncorporationModel({}, null, TODAY);

  it('lists the registration-phase steps of the checklist, in order', () => {
    const items = buildRegistrations(model);
    const phase = model.phases.find((p) => p.no === 4)!;
    expect(items.map((r) => r.stepId)).toEqual(phase.steps.map((s) => s.id));
    expect(items[0]!.n).toBe(1);
    expect(items.every((r) => r.id === r.step.item.slug)).toBe(true);
  });

  it('takes stored numbers from the credentials Registrations sheet and never invents one', () => {
    const items = buildRegistrations(model, credentials([{ key: 'pf', number: 'TNMAS1234567000', date: '02 Oct 2026' }]));
    const pf = items.find((r) => r.stepId === 'reg-1')!;
    expect(pf.regKey).toBe('pf');
    expect(pf.number).toBe('TNMAS1234567000');
    expect(pf.registeredOn).toBe('02 Oct 2026');
    const esi = items.find((r) => r.stepId === 'reg-3')!;
    expect(esi.number).toBeNull();
    const odi = items.find((r) => r.name === 'ODI Reporting');
    if (odi) expect(odi.regKey).toBeNull();
  });

  it('falls back to the GSTIN tile for GST Registration', () => {
    const items = buildRegistrations(model, credentials([], '29AAKCN1234M1Z5'));
    expect(items.find((r) => r.stepId === 'reg-4')!.number).toBe('29AAKCN1234M1Z5');
  });

  it('marks steps the checklist calls not applicable', () => {
    const m = buildIncorporationModel({ 'reg-12': { status: 'not-applicable' } as never }, null, TODAY);
    const tm = buildRegistrations(m).find((r) => r.stepId === 'reg-12')!;
    expect(tm.notNeeded).toBe(true);
    expect(tm.status).toBe('Done');
  });
});

describe('rail lists', () => {
  it('keeps open registrations due within the window and the client moves', () => {
    const model = buildIncorporationModel({}, null, TODAY);
    const items = buildRegistrations(model).map((r, i) =>
      i === 0 ? { ...r, due: '2026-10-20' } : i === 1 ? { ...r, due: '2026-12-01' } : i === 2 ? { ...r, step: { ...r.step, kind: 'you' as const } } : r,
    );
    expect(regDueWithin(items, TODAY).map((r) => r.n)).toEqual([1]);
    expect(regWaiting(items).map((r) => r.n)).toEqual([3]);
  });

  it('maps a registration to the filings it starts', () => {
    expect(startsFilings('reg-4')).toEqual({ area: 'GST' });
    expect(startsFilings('reg-3')?.name?.test('ESI Return')).toBe(true);
    expect(startsFilings('reg-12')).toBeNull();
  });
});
