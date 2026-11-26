import { describe, expect, it } from 'vitest';
import {
  ackNumberOf,
  cashBalanceOf,
  cashShortOf,
  gstinCheckOf,
  gstr1Summary,
  gstr3bLiability,
  gstr3bSaveFromAutoLiab,
  gstr3bSummary,
  gstr9FilePayload,
  gstr9Summary,
  gstr9cSaved,
  gstr9cSummary,
  invoiceCountOf,
  isoFromPortalDate,
  itcIn2b,
  noticeFromDetail,
  noticesFromList,
  num,
  offsetPlan,
  plainPortalMessage,
  retStatusOf,
  sessionExpiryOf,
  sessionStatusOf,
  unwrapEnvelope,
  gstinMissingInAccount,
  TRANS_FORWARD,
  TRANS_REVERSE,
} from './mappers';
import { ZERO_HEADS } from './types';

const now = new Date('2026-11-26T10:00:00Z');

describe('envelope and basics', () => {
  it('unwraps the GSTZen envelope and turns status 0 into a plain error', () => {
    expect(unwrapEnvelope({ status: 1, api_call: 'X', message: { a: 1 } })).toEqual({ ok: true, message: { a: 1 } });
    expect(unwrapEnvelope({ status: 0, message: 'Session to GSTN is not established' })).toEqual({ ok: false, error: 'Session to GSTN is not established' });
    expect(unwrapEnvelope({ notices: [] })).toEqual({ ok: true, message: { notices: [] } });
    expect(unwrapEnvelope('x').ok).toBe(false);
    expect(unwrapEnvelope({ detail: 'No active account found with the given credentials' })).toEqual({ ok: false, error: 'No active account found with the given credentials' });
  });

  it('reads numbers from numbers and numeric strings', () => {
    expect(num('9415.68')).toBe(9415.68);
    expect(num('1,20,000')).toBe(120000);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
  });

  it('keeps a portal message to one short sentence', () => {
    expect(plainPortalMessage('  a\n b ')).toBe('a b');
    expect(plainPortalMessage({ message: 'x' })).toBe('x');
    expect(plainPortalMessage('y'.repeat(400))).toHaveLength(300);
    expect(plainPortalMessage(null)).toBe('The GST portal refused the request.');
  });

  it('reads portal dates', () => {
    expect(isoFromPortalDate('24/01/2024')).toBe('2024-01-24');
    expect(isoFromPortalDate('12-02-2024')).toBe('2024-02-12');
    expect(isoFromPortalDate('NA')).toBeNull();
  });
});

describe('GSTN session', () => {
  it('takes expiry_time, else now + expiry seconds', () => {
    expect(sessionExpiryOf({ status_cd: '1', expiry: 43200, expiry_time: 1709287449 }, now)?.toISOString()).toBe(new Date(1709287449000).toISOString());
    expect(sessionExpiryOf({ expiry: 3600 }, now)?.toISOString()).toBe('2026-11-26T11:00:00.000Z');
    expect(sessionExpiryOf({}, now)).toBeNull();
  });
  it('reads the check-session sentence', () => {
    expect(sessionStatusOf('Your GSTN portal session is active')).toBe('active');
    expect(sessionStatusOf('Your GSTN portal session is inactive')).toBe('inactive');
  });
  it('spots the GSTIN that is not in the GSTZen account', () => {
    expect(gstinMissingInAccount('The GSTIN was not found in your account.')).toBe(true);
    expect(gstinMissingInAccount('Invalid OTP')).toBe(false);
  });
});

describe('return status and ARN', () => {
  it('maps RETSTATUS codes', () => {
    expect(retStatusOf({ status_cd: 'P' })).toEqual({ state: 'done' });
    expect(retStatusOf({ status_cd: 'IP' })).toEqual({ state: 'pending' });
    expect(retStatusOf({ status_cd: 'ER', error_report: { error_msg: 'Invalid section' } })).toEqual({ state: 'error', error: 'Invalid section' });
    expect(retStatusOf({ status_cd: 'PE' }).state).toBe('error');
  });
  it('reads ack_num', () => {
    expect(ackNumberOf({ ack_num: 'AA290121015683J' })).toBe('AA290121015683J');
    expect(ackNumberOf({})).toBeNull();
  });
});

/** A trimmed GSTR-3B AUTOLIAB answer in the docs' shape. */
const AUTOLIAB = {
  r3bautopop: {
    liabitc: {
      elgitc: {
        itc4a1: { subtotal: { iamt: 0, csamt: 0 } },
        itc4a3: { subtotal: { iamt: '100', camt: 0, samt: 0, csamt: 0 } },
        itc4a5: { subtotal: { camt: '9415.68', iamt: '15637.52', samt: '9415.68', csamt: 0 } },
        itc4b2: { subtotal: { camt: 15.68, iamt: 37.52, samt: 15.68, csamt: 0 } },
      },
      inter_sup: {
        osup_unreg_3_2: { subtotal: [{ pos: '37', iamt: '691.38', txval: 3841 }, { pos: '', iamt: 0, txval: 0 }] },
        osup_comp_3_2: { subtotal: [] },
        osup_uin_3_2: { subtotal: [{ pos: '', iamt: 0, txval: 0 }] },
      },
      sup_details: {
        osup_3_1a: { subtotal: { camt: '19353.57', iamt: '122671.39', samt: '19353.57', csamt: 0, txval: '896547.12' } },
        osup_3_1b: { subtotal: { iamt: 10, csamt: 0, txval: 100 } },
        osup_3_1c: { subtotal: { txval: 50 } },
        isup_3_1d: { subtotal: { iamt: 18, camt: 0, samt: 0, csamt: 0, txval: 100 } },
        osup_3_1e: { subtotal: { txval: 0 } },
      },
    },
  },
};

describe('GSTR-3B save payload', () => {
  it('maps the auto-calculated tables into the RETSAVE schema', () => {
    const p = JSON.parse(JSON.stringify(gstr3bSaveFromAutoLiab(AUTOLIAB)));
    expect(p.sup_details.osup_det).toEqual({ txval: 896547.12, iamt: 122671.39, camt: 19353.57, samt: 19353.57, csamt: 0 });
    expect(p.sup_details.osup_zero).toEqual({ txval: 100, iamt: 10, csamt: 0 });
    expect(p.sup_details.osup_nil_exmp).toEqual({ txval: 50 });
    expect(p.sup_details.isup_rev.iamt).toBe(18);
    expect(p.inter_sup.unreg_details).toEqual([{ pos: '37', txval: 3841, iamt: 691.38 }]);
    expect(p.inter_sup.uin_details).toEqual([]);
    const oth = p.itc_elg.itc_avl.find((x: { ty: string }) => x.ty === 'OTH');
    expect(oth).toEqual({ ty: 'OTH', iamt: 15637.52, camt: 9415.68, samt: 9415.68, csamt: 0 });
    expect(p.itc_elg.itc_avl.find((x: { ty: string }) => x.ty === 'ISRC').iamt).toBe(100);
    // Net = available less reversed.
    expect(p.itc_elg.itc_net).toEqual({ iamt: 15700, camt: 9400, samt: 9400, csamt: 0 });
    expect(p).not.toHaveProperty('gstin');
  });
});

describe('GSTR-3B offset', () => {
  const lines = (fwd: Partial<typeof ZERO_HEADS>, rcm: Partial<typeof ZERO_HEADS> = {}) => [
    { transTyp: TRANS_FORWARD, liabLdgId: 11, tax: { ...ZERO_HEADS, ...fwd }, interest: ZERO_HEADS, fee: ZERO_HEADS },
    { transTyp: TRANS_REVERSE, liabLdgId: 12, tax: { ...ZERO_HEADS, ...rcm }, interest: ZERO_HEADS, fee: ZERO_HEADS },
  ];

  it('uses IGST credit first (IGST, then CGST, then SGST), then CGST and SGST credit', () => {
    const plan = offsetPlan(lines({ igst: 100, cgst: 50, sgst: 50 }), { igst: 130, cgst: 40, sgst: 10, cess: 0 });
    expect(plan.pditc.i_pdi).toBe(100);
    expect(plan.pditc.i_pdc).toBe(30);
    expect(plan.pditc.i_pds).toBe(0);
    expect(plan.pditc.c_pdc).toBe(20);
    expect(plan.pditc.s_pds).toBe(10);
    expect(plan.cashByHead).toEqual({ igst: 0, cgst: 0, sgst: 40, cess: 0 });
    expect(plan.cashTotal).toBe(40);
  });

  it('never sets CGST credit against SGST, or SGST credit against CGST', () => {
    const plan = offsetPlan(lines({ cgst: 0, sgst: 100 }), { igst: 0, cgst: 500, sgst: 0, cess: 0 });
    expect(plan.itcUsed.cgst).toBe(0);
    expect(plan.cashByHead.sgst).toBe(100);
  });

  it('pays reverse charge, interest and late fee in cash', () => {
    const l = lines({ igst: 10 }, { igst: 18 });
    l[0].interest = { ...ZERO_HEADS, cgst: 5 };
    l[0].fee = { ...ZERO_HEADS, cgst: 25, sgst: 25 };
    const plan = offsetPlan(l, { igst: 1000, cgst: 1000, sgst: 1000, cess: 0 });
    expect(plan.pditc.i_pdi).toBe(10);
    expect(plan.cashByHead).toEqual({ igst: 18, cgst: 30, sgst: 25, cess: 0 });
    expect(plan.pdcash.find((c) => c.trans_typ === TRANS_REVERSE)?.ipd).toBe(18);
  });

  it('counts the cash still to pay per head (cash cannot move between heads)', () => {
    expect(cashShortOf({ igst: 100, cgst: 0, sgst: 50, cess: 0 }, { igst: 500, cgst: 0, sgst: 20, cess: 0 })).toBe(30);
    expect(cashShortOf({ ...ZERO_HEADS }, { ...ZERO_HEADS })).toBe(0);
  });

  it('reads the cash balance per head', () => {
    const b = cashBalanceOf({ cash_bal: { igst_tot_bal: 500, cgst_tot_bal: 10, sgst: { tx: 5, intr: 1 }, cess_tot_bal: 0 } });
    expect(b).toEqual({ igst: 500, cgst: 10, sgst: 6, cess: 0 });
  });
});

const RETSUM = {
  data: {
    sup_details: { osup_det: { txval: 2392514.93, iamt: 305546.93, camt: 62552.88, samt: 62552.88, csamt: 0 }, isup_rev: { iamt: 302.4 } },
    itc_elg: { itc_net: { iamt: 45646.5, camt: 30622.95, samt: 30622.95, csamt: 0 } },
    intr_ltfee: { intr_details: { iamt: 0 }, ltfee_details: { camt: 0 } },
    tx_pmt: {
      tx_py: [
        { trans_typ: 30002, liab_ldg_id: 692525124, igst: { tx: 0 }, cgst: { tx: 0 }, sgst: { tx: 0 }, cess: { tx: 0 } },
        { trans_typ: 30003, liab_ldg_id: 692525127, igst: { tx: 0 } },
      ],
    },
  },
  data_json_string: '{"gstin":"x"}',
};

describe('GSTR-3B summary', () => {
  it('reads liability from table 3.1 when tx_py carries no tax', () => {
    const { lines, itc } = gstr3bLiability(RETSUM);
    expect(lines[0].tax.igst).toBe(305546.93);
    expect(lines[0].liabLdgId).toBe(692525124);
    expect(lines[1].tax.igst).toBe(302.4);
    expect(itc.igst).toBe(45646.5);
  });

  it('builds the card table, cash short and the 2B line', () => {
    const twoB = { data: { itcsumm: { itcavl: { nonrevsup: { igst: 40000, cgst: 30000, sgst: 30000, cess: 0 }, revsup: { igst: 302.4 } } } } };
    const { summary } = gstr3bSummary({ retsum: RETSUM, cashBalance: { cash_bal: { igst_tot_bal: 100000, cgst_tot_bal: 0, sgst_tot_bal: 0, cess_tot_bal: 0 } }, twoB, now });
    expect(summary.table.columns).toEqual(['IGST', 'CGST', 'SGST', 'Cess']);
    expect(summary.table.rows.map((r) => r.label)).toEqual(['Tax due', 'ITC available', 'ITC used', 'Cash to pay']);
    const cash = summary.table.rows[3].values;
    expect(cash[0]).toBeCloseTo(305546.93 + 302.4 - 45646.5, 2);
    expect(summary.cashShort).toBeGreaterThan(0);
    expect(summary.twoB).toEqual({ itcIn2b: 100302.4, itcClaimed: 106892.4, difference: 6590 });
    expect(JSON.stringify(summary)).not.toContain('gstin');
  });

  it('sums 2B ITC across groups', () => {
    expect(itcIn2b({ data: { itcsumm: { itcavl: { a: { igst: 1, cgst: 2 }, b: { sgst: 3 } } } } })).toBe(6);
  });
});

describe('GSTR-1, GSTR-9 and GSTR-9C summaries', () => {
  it('lists sections with records and a total', () => {
    const s = gstr1Summary({
      retsum: { data: { sec_sum: [{ sec_nm: 'B2B', ttl_rec: 4, ttl_val: 1000, ttl_igst: 180 }, { sec_nm: 'CDNUR', ttl_rec: 0, ttl_val: 0 }, { sec_nm: 'B2CS', ttl_rec: 2, ttl_val: 500, ttl_cgst: 45, ttl_sgst: 45 }] } },
      einvoices: 3,
      now,
    });
    expect(s.table.rows.map((r) => r.label)).toEqual(['B2B invoices', 'B2C small', 'Total']);
    expect(s.table.rows[2].values).toEqual([6, 1500, 180, 45, 45, 0]);
    expect(s.lines).toEqual([{ label: 'E-invoices on the portal', value: 3 }]);
  });

  it('counts e-invoices in a download section', () => {
    expect(invoiceCountOf({ b2b: [{ inv: [{}, {}] }, { inv: [{}] }] }, 'b2b')).toBe(3);
  });

  it('reads GSTR-9 tables 4 and 6A and adds the filing block', () => {
    const data = { gstin: 'g', fp: '032025', table4: { b2c: { txval: 516998.24, camt: 46529.84, samt: 46529.84 }, b2b: { txval: 10, iamt: 1 } }, table6: { itc_3b: { iamt: 91338, camt: 1, samt: 1 } } };
    const s = gstr9Summary({ data, now });
    expect(s.table.rows[0].values).toEqual([517008.24, 1, 46529.84, 46529.84, 0]);
    expect(s.table.rows[1].values[1]).toBe(91338);
    const file = JSON.parse(JSON.stringify(gstr9FilePayload({ data })));
    expect(file.isnil).toBe('N');
    expect(file.offset[0].tran_cd).toBe(30002);
  });

  it('flags a GSTR-9C that is not saved on the portal', () => {
    expect(gstr9cSaved({ data: {} })).toBe(false);
    const s = gstr9cSummary({ records: { gstr9_to_gstr9c: { table9: { tot_amt_paid: { iamt: 5 } } } }, retsum: { data: { gstr9cdata: { audited_data: { table5: { turnovr: 2928097.9 } } } } }, now });
    expect(s.note).toBeNull();
    expect(s.lines[0].value).toBe(2928097.9);
  });
});

describe('notices', () => {
  it('lists notices and marks the ones without a reply as open', () => {
    const list = noticesFromList({
      notices: [
        { arn: 'AD1', refId: 'ZA1', moduleCd: 'ASMT', alertCd: 'ASMT10', dateOfIssue: '24/01/2024', dateOfRespond: 'NA' },
        { arn: 'AD2', refId: 'ZA2', moduleCd: 'DRC', alertCd: 'DRC01', dateOfIssue: '12/02/2024', dateOfRespond: '28/02/2024' },
        { arn: 'x' },
      ],
    });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ refId: 'ZA1', issuedOn: '2024-01-24', respondedOn: null });
    expect(list[1].respondedOn).toBe('2024-02-28');
  });

  it('keeps the detail without document bodies', () => {
    const item = noticesFromList({ notices: [{ refId: 'ZA1', arn: 'AD1', alertCd: 'ASMT10', dateOfIssue: '24/01/2024' }] })[0];
    const d = noticeFromDetail(
      {
        noticeType: 'Notice for intimating discrepancies',
        dateOfIssue: '24/01/2024',
        dueDateOfReply: '23/02/2024',
        taxPeriod: { fromMonth: '04', fromYear: '2022', toMonth: '03', toYear: '2023' },
        maindocs: [{ dcupdtls: { id: 'DOC1', docName: 'ASMT-10.pdf', data: 'JVBERi0xLjQK' } }],
        data: 'JVBERi0xLjQK',
      },
      item,
    );
    expect(d).toMatchObject({ noticeType: 'Notice for intimating discrepancies', dueOn: '2024-02-23', period: '04/2022 to 03/2023' });
    expect(JSON.stringify(d.detail)).not.toContain('JVBERi0');
    expect(d.detail.maindocs).toEqual([{ id: 'DOC1', docName: 'ASMT-10.pdf' }]);
  });
});

describe('GSTIN validator', () => {
  it('maps legal name, status and jurisdiction', () => {
    const r = gstinCheckOf(
      { status: 1, gstin: '29AAFQQ9980MZQR', valid: true, company_details: { legal_name: 'GSTZEN PRIVATE LIMITED', trade_name: 'GSTZEN PRIVATE LIMITED', company_status: 'Active', registration_date: '2017-07-01', gst_type: 'Regular', stj: 'LGSTO 206- Mysuru', ctj: 'KUVEMPUNAGARA RANGE', state_info: { name: 'Karnataka' }, pradr: { addr: '4TH FLOOR' } } },
      '29AAFQQ9980MZQR',
    );
    expect(r).toMatchObject({ valid: true, legalName: 'GSTZEN PRIVATE LIMITED', status: 'Active', registeredOn: '2017-07-01', state: 'Karnataka', jurisdiction: 'State: LGSTO 206- Mysuru · Centre: KUVEMPUNAGARA RANGE' });
    expect(gstinCheckOf({ status: 1, valid: false }, 'X').valid).toBe(false);
  });
});
