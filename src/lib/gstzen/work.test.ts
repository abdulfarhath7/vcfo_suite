// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * The return work (save, offset) and the EVC filing with the repositories and the GSTZen client
 * replaced: a GSTR-3B save goes auto-liability → save → status → summary; a lapsed session sends the
 * run back to consent; an offset waits while the cash ledger is short; the EVC files once and writes
 * the ARN onto the run and the compliance filing.
 */

const RUN = '44444444-4444-4444-8444-444444444404';
const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern', internId: 'i-1' };
let run: Record<string, unknown>;

const updates: Array<Record<string, unknown>> = [];
vi.mock('@/db/repositories/gst-returns', async (orig) => {
  const real = await orig<typeof import('@/db/repositories/gst-returns')>();
  return {
    splitSummary: real.splitSummary,
    systemGetRun: async () => run,
    systemRunContext: async () => lead,
    systemUpdateRun: async (_id: string, patch: Record<string, unknown>) => {
      updates.push(patch);
      if (patch.status) run = { ...run, status: patch.status };
      if (patch.flow) {
        const s = real.splitSummary(run.summary);
        run = { ...run, summary: real.joinSummary((patch.summary as never) ?? s.summary, { ...s.flow, ...(patch.flow as object) }) };
      }
      return run;
    },
    systemFilingInstanceId: async () => 'inst-1',
  };
});
const markInactive = vi.fn(async () => undefined);
vi.mock('@/db/repositories/gstn-sessions', () => ({ systemMarkSessionInactive: (...a: unknown[]) => markInactive(...(a as [])) }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn(async () => undefined) }));
vi.mock('@/lib/gstzen/gate', () => ({ gstzenGate: async () => ({ open: true }) }));
const markFiled = vi.fn(async () => ({ id: 'inst-1', status: 'filed', filedOn: '2026-11-26' }));
vi.mock('@/db/repositories/filing-status', () => ({ markFilingFiled: (...a: unknown[]) => markFiled(...(a as [])), FilingStatusError: class extends Error {} }));
const details = vi.fn(async () => undefined);
vi.mock('@/db/repositories/client-compliances', () => ({ upsertFilingDetails: (...a: unknown[]) => details(...(a as [])) }));
vi.mock('@/db/repositories/agent-otp', () => ({}));
vi.mock('@/db/repositories/gst-profile', () => ({}));

const RETSUM = {
  data: {
    sup_details: { osup_det: { iamt: 1000 } },
    itc_elg: { itc_net: { iamt: 400 } },
    tx_pmt: { tx_py: [{ trans_typ: 30002, liab_ldg_id: 9, igst: { tx: 0 } }] },
  },
};
const api = {
  gstr3bAutoLiability: vi.fn(async () => ({ r3bautopop: { liabitc: {} } })),
  gstr3bSave: vi.fn(async () => ({ reference_id: 'ref-1' })),
  returnStatus: vi.fn(async () => ({ status_cd: 'P' })),
  gstr3bSummary: vi.fn(async () => RETSUM),
  gstr3bCashItcBalance: vi.fn(async () => ({ cash_bal: { igst_tot_bal: 1000 } })),
  gstr2b: vi.fn(async () => ({ data: { itcsumm: { itcavl: { nonrevsup: { igst: 400 } } } } })),
  gstr3bOffset: vi.fn(async () => ({ message: 'Payment of tax successfully done' })),
  fileWithEvc: vi.fn(async () => ({ ack_num: 'AA291126000001X' })),
};
vi.mock('@/lib/gstzen/client', async (orig) => ({ ...(await orig<typeof import('./client')>()), gstzen: () => api }));

const work = await import('./work');
const returns = await import('./returns');
const { GstzenError } = await import('./client');

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
  run = { id: RUN, engagementId: 'eng-1', gstin: '29AAFCC9980M1ZR', form: 'gstr3b', period: '102026', status: 'saving', summary: { flow: { working: 'save' } }, checks: {}, createdBy: 'lead-1' };
});

describe('GSTR-3B save', () => {
  it('saves the auto-calculated figures, waits for the portal, then reads the summary', async () => {
    const begun = await work.beginWork(RUN, 'save');
    expect(begun).toEqual({ next: 'poll', referenceId: 'ref-1' });
    expect(api.gstr3bSave).toHaveBeenCalledWith('29AAFCC9980M1ZR', '102026', expect.objectContaining({ sup_details: expect.any(Object), itc_elg: expect.any(Object) }));
    expect(await work.pollWork(RUN, 'save', 'ref-1')).toBe('done');
    expect(await work.finishWork(RUN, 'save')).toBe('done');
    const last = updates.at(-1)!;
    expect(last.status).toBe('saved');
    expect(last.checks).toEqual({});
    expect((last.summary as { cashNeeded: number }).cashNeeded).toBe(600);
    expect((last.summary as { twoB: unknown }).twoB).toEqual({ itcIn2b: 400, itcClaimed: 400, difference: 0 });
  });

  it('sends the run back to consent when the GSTN session has lapsed', async () => {
    api.gstr3bAutoLiability.mockRejectedValueOnce(new GstzenError('portal', 'Session to GSTN is not established'));
    expect(await work.beginWork(RUN, 'save')).toEqual({ next: 'stop', reason: 'failed' });
    expect(markInactive).toHaveBeenCalledWith('29AAFCC9980M1ZR');
    expect(run.status).toBe('consent_needed');
  });

  it('marks other portal errors failed with the plain message', async () => {
    api.returnStatus.mockResolvedValueOnce({ status_cd: 'ER', error_report: { error_msg: 'Invalid section data' } } as never);
    await work.beginWork(RUN, 'save');
    expect(await work.pollWork(RUN, 'save', 'ref-1')).toBe('stop');
    expect(run.status).toBe('failed');
    expect(updates.at(-1)).toMatchObject({ error: 'Invalid section data', flow: { failedAt: 'save' } });
  });

  it('does nothing when the run is no longer saving', async () => {
    run.status = 'cancelled';
    expect(await work.beginWork(RUN, 'save')).toEqual({ next: 'stop', reason: 'status_cancelled' });
    expect(api.gstr3bAutoLiability).not.toHaveBeenCalled();
  });
});

describe('GSTR-3B offset', () => {
  it('waits for the person to pay when the ledger is short', async () => {
    run.status = 'filing';
    api.gstr3bCashItcBalance.mockResolvedValueOnce({ cash_bal: { igst_tot_bal: 100 } });
    expect(await work.beginWork(RUN, 'offset')).toEqual({ next: 'stop', reason: 'cash_short' });
    expect(api.gstr3bOffset).not.toHaveBeenCalled();
    expect(run.status).toBe('checked');
  });

  it('sets off with ITC first, then cash', async () => {
    run.status = 'filing';
    expect(await work.beginWork(RUN, 'offset')).toEqual({ next: 'finish' });
    const payload = (api.gstr3bOffset.mock.calls[0] as unknown[])[2] as { pditc: { i_pdi: number; liab_ldg_id: number }; pdcash: Array<{ ipd: number }> };
    expect(payload.pditc).toMatchObject({ i_pdi: 400, liab_ldg_id: 9 });
    expect(payload.pdcash[0].ipd).toBe(600);
    await work.finishWork(RUN, 'offset');
    expect(updates.at(-1)).toMatchObject({ flow: { offsetDone: true, working: null } });
  });
});

describe('EVC filing', () => {
  it('files once and writes the ARN onto the run and the compliance filing', async () => {
    run = { ...run, status: 'filing', summary: { flow: { offsetDone: true, signatoryPan: 'ABCDE1234F' } } };
    const out = await returns.fileReturnWithEvc(lead, RUN, '765432');
    expect(out).toEqual({ arn: 'AA291126000001X' });
    expect(api.fileWithEvc).toHaveBeenCalledWith('gstr3b', '29AAFCC9980M1ZR', '102026', expect.objectContaining({ otp: '765432', signatoryPan: 'ABCDE1234F' }));
    expect(updates.at(-1)).toMatchObject({ status: 'filed', arn: 'AA291126000001X' });
    expect(markFiled).toHaveBeenCalledWith(lead, 'inst-1', expect.objectContaining({ note: expect.stringContaining('AA291126000001X') }));
    expect(details).toHaveBeenCalledWith(lead, 'inst-1', { acknowledgementNo: 'AA291126000001X', filedBy: 'lead-1' });
    expect(JSON.stringify(updates)).not.toContain('765432');
  });

  it('refuses a run that is not waiting for its EVC', async () => {
    run = { ...run, status: 'saved' };
    await expect(returns.fileReturnWithEvc(lead, RUN, '765432')).rejects.toMatchObject({ status: 409 });
    expect(api.fileWithEvc).not.toHaveBeenCalled();
  });
});
