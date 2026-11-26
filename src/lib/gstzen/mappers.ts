import {
  ZERO_HEADS,
  type GstForm,
  type GstReturnSummary,
  type GstinCheckResult,
  type SummaryTable,
  type TaxHeads,
} from './types';

/**
 * GSTZEN RESPONSE MAPPERS — pure functions from the GSP's responses (the GST portal's own JSON,
 * passed through by GSTZen inside `message`) to what Suite keeps and shows. Shapes follow the
 * GSTZen API docs read on 26 Nov 2026 (https://my.gstzen.in/docs/api/). Every reader is defensive:
 * the portal sends numbers as numbers or strings, and a missing block reads as zero.
 *
 * Nothing here keeps an invoice, a party name, a token or an OTP: the summaries are numbers and
 * labels only.
 */

type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

/** A number from a number or a numeric string; anything else is 0. Rounded to paise. */
export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/,/g, '')) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Tax heads from either spelling the portal uses (`iamt`… or `igst`…). */
export function headsOf(v: unknown): TaxHeads {
  const o = obj(v);
  return {
    igst: num(o.iamt ?? o.igst),
    cgst: num(o.camt ?? o.cgst),
    sgst: num(o.samt ?? o.sgst),
    cess: num(o.csamt ?? o.cess),
  };
}

export function addHeads(a: TaxHeads, b: TaxHeads): TaxHeads {
  return { igst: r2(a.igst + b.igst), cgst: r2(a.cgst + b.cgst), sgst: r2(a.sgst + b.sgst), cess: r2(a.cess + b.cess) };
}

export function subHeads(a: TaxHeads, b: TaxHeads): TaxHeads {
  return { igst: r2(a.igst - b.igst), cgst: r2(a.cgst - b.cgst), sgst: r2(a.sgst - b.sgst), cess: r2(a.cess - b.cess) };
}

export const totalOf = (h: TaxHeads) => r2(h.igst + h.cgst + h.sgst + h.cess);
const headValues = (h: TaxHeads) => [h.igst, h.cgst, h.sgst, h.cess];
const HEAD_COLUMNS = ['IGST', 'CGST', 'SGST', 'Cess'];

/** `24/01/2024`, `24-01-2024` or `2024-01-24` to an ISO date; null otherwise. */
export function isoFromPortalDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/* ------------------------------------------------------------------ */
/* envelope and errors                                                 */
/* ------------------------------------------------------------------ */

export type Envelope = { ok: true; message: unknown } | { ok: false; error: string };

/**
 * GSTZen wraps the portal's answer as `{ status, api_call, message }`; `status: 0` is a refusal with
 * a plain message. A few endpoints (the notice list, the GSTR-9 family) answer without `status`;
 * then the whole body (or its `message`) is the answer.
 */
export function unwrapEnvelope(body: unknown): Envelope {
  if (!isObj(body)) return { ok: false, error: 'GSTZen sent an answer Suite could not read.' };
  if (body.status === 0 || body.status === '0') return { ok: false, error: plainPortalMessage(body.message) };
  if (typeof body.detail === 'string' && !('message' in body)) return { ok: false, error: plainPortalMessage(body.detail) };
  return { ok: true, message: 'message' in body ? body.message : body };
}

/** A portal message as one plain sentence, at most 300 characters. Objects keep their message text. */
export function plainPortalMessage(v: unknown): string {
  let s = '';
  if (typeof v === 'string') s = v;
  else if (isObj(v)) s = str(v.message) ?? str(v.error_msg) ?? str(v.error) ?? str(obj(v.error).message) ?? '';
  else if (Array.isArray(v)) s = v.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean).join(' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return 'The GST portal refused the request.';
  return s.length > 300 ? `${s.slice(0, 297)}...` : s;
}

/* ------------------------------------------------------------------ */
/* GSTN session                                                        */
/* ------------------------------------------------------------------ */

/**
 * Establish and refresh answer `{ status_cd, expiry (seconds), expiry_time (unix seconds) }`. The
 * session stays active until `expiry_time`; without it, `now + expiry`.
 */
export function sessionExpiryOf(message: unknown, now: Date): Date | null {
  const m = obj(message);
  const at = num(m.expiry_time);
  if (at > 0) return new Date(at * 1000);
  const secs = num(m.expiry);
  return secs > 0 ? new Date(now.getTime() + secs * 1000) : null;
}

/** "Your GSTN portal session is active" → active; anything else → inactive. */
export function sessionStatusOf(message: unknown): 'active' | 'inactive' {
  const s = (typeof message === 'string' ? message : str(obj(message).message) ?? '').toLowerCase();
  return /\bactive\b/.test(s) && !/\binactive\b/.test(s) ? 'active' : 'inactive';
}

/** The generate-OTP refusal that means the GSTIN is not yet in the firm's GSTZen account. */
export function gstinMissingInAccount(error: string): boolean {
  return /not (been )?found in your account|not found in your gstzen account|gstin (is )?not (registered|added)/i.test(error);
}

/* ------------------------------------------------------------------ */
/* return status and acknowledgement                                   */
/* ------------------------------------------------------------------ */

export type RetStatus = { state: 'done' } | { state: 'pending' } | { state: 'error'; error: string };

/** RETSTATUS `status_cd`: P processed, IP / REC in progress, PE processed with errors, ER error. */
export function retStatusOf(message: unknown): RetStatus {
  const m = obj(message);
  const cd = (str(m.status_cd) ?? '').toUpperCase();
  if (cd === 'P' || cd === '1') return { state: 'done' };
  if (cd === 'IP' || cd === 'REC' || cd === '') return { state: 'pending' };
  const report = obj(m.error_report);
  const detail = str(report.error_msg) ?? str(report.error_cd) ?? (isObj(m.error) ? str(m.error.message) : str(m.error));
  return { state: 'error', error: detail ? plainPortalMessage(detail) : cd === 'PE' ? 'The portal processed the return with errors.' : 'The portal could not process the return.' };
}

/** `reference_id` from a save, reset or proceed answer. */
export function referenceIdOf(message: unknown): string | null {
  const m = obj(message);
  return str(m.reference_id) ?? str(m.ref_id);
}

/** The ARN from a RETFILE answer (`ack_num`). */
export function ackNumberOf(message: unknown): string | null {
  const m = obj(message);
  return str(m.ack_num) ?? str(m.arn);
}

/* ------------------------------------------------------------------ */
/* GSTR-3B                                                             */
/* ------------------------------------------------------------------ */

const sub = (v: unknown) => obj(obj(v).subtotal);
const posRows = (v: unknown) =>
  arr(obj(v).subtotal)
    .map((r) => obj(r))
    .filter((r) => (str(r.pos) ?? '') !== '' && (num(r.txval) !== 0 || num(r.iamt) !== 0))
    .map((r) => ({ pos: str(r.pos) as string, txval: num(r.txval), iamt: num(r.iamt) }));

const amt = (h: TaxHeads) => ({ iamt: h.igst, camt: h.cgst, samt: h.sgst, csamt: h.cess });

/**
 * The GSTR-3B save payload (`sup_details`, `inter_sup`, `itc_elg`, `inward_sup`, `intr_ltfee`) from
 * the portal's auto-calculated liability (`r3bautopop.liabitc`). The tables map as the portal
 * labels them: 3.1(a) to (e), 3.2 by place of supply, and 4A(1) to (5) less 4B.
 */
export function gstr3bSaveFromAutoLiab(message: unknown): Obj {
  const liab = obj(obj(obj(message).r3bautopop).liabitc);
  const sup = obj(liab.sup_details);
  const inter = obj(liab.inter_sup);
  const elg = obj(liab.elgitc);
  const s31 = (k: string) => {
    const o = sub(sup[k]);
    return { txval: num(o.txval), ...amt(headsOf(o)) };
  };
  const itc = (k: string) => headsOf(sub(elg[k]));
  const avl = [
    { ty: 'IMPG', h: itc('itc4a1') },
    { ty: 'IMPS', h: itc('itc4a2') },
    { ty: 'ISRC', h: itc('itc4a3') },
    { ty: 'ISD', h: itc('itc4a4') },
    { ty: 'OTH', h: itc('itc4a5') },
  ];
  const rev = [
    { ty: 'RUL', h: itc('itc4b1') },
    { ty: 'OTH', h: itc('itc4b2') },
  ];
  const avlTotal = avl.reduce((a, x) => addHeads(a, x.h), ZERO_HEADS);
  const revTotal = rev.reduce((a, x) => addHeads(a, x.h), ZERO_HEADS);
  const zero = amt(ZERO_HEADS);
  return {
    sup_details: {
      osup_det: s31('osup_3_1a'),
      osup_zero: { txval: s31('osup_3_1b').txval, iamt: s31('osup_3_1b').iamt, csamt: s31('osup_3_1b').csamt },
      osup_nil_exmp: { txval: s31('osup_3_1c').txval },
      isup_rev: s31('isup_3_1d'),
      osup_nongst: { txval: s31('osup_3_1e').txval },
    },
    inter_sup: {
      unreg_details: posRows(inter.osup_unreg_3_2),
      comp_details: posRows(inter.osup_comp_3_2),
      uin_details: posRows(inter.osup_uin_3_2),
    },
    itc_elg: {
      itc_avl: avl.map((x) => ({ ty: x.ty, ...amt(x.h) })),
      itc_rev: rev.map((x) => ({ ty: x.ty, ...amt(x.h) })),
      itc_net: amt(subHeads(avlTotal, revTotal)),
      itc_inelg: [
        { ty: 'RUL', ...zero },
        { ty: 'OTH', ...zero },
      ],
    },
    inward_sup: { isup_details: [{ ty: 'GST', inter: 0, intra: 0 }, { ty: 'NONGST', inter: 0, intra: 0 }] },
    intr_ltfee: { intr_details: zero },
  };
}

/** One liability ledger line of a saved GSTR-3B (`tx_pmt.tx_py`): 30002 other than reverse charge, 30003 reverse charge. */
export interface LiabilityLine {
  transTyp: number;
  liabLdgId: number | null;
  tax: TaxHeads;
  interest: TaxHeads;
  fee: TaxHeads;
}

export const TRANS_FORWARD = 30002;
export const TRANS_REVERSE = 30003;

/** The saved return's data block: `message.data` (RETSUM) or the message itself. */
export function retsumData(message: unknown): Obj {
  const m = obj(message);
  return isObj(m.data) ? m.data : m;
}

/**
 * The liability per ledger line and the eligible ITC of a saved GSTR-3B. When `tx_py` carries no
 * tax (the portal leaves it at zero until it computes), the liability is read from table 3.1:
 * (a) and (b) are forward charge, (d) is reverse charge. Interest and late fee are paid in cash with
 * the forward-charge line.
 */
export function gstr3bLiability(message: unknown): { lines: LiabilityLine[]; itc: TaxHeads } {
  const d = retsumData(message);
  const pmt = obj(d.tx_pmt);
  const sup = obj(d.sup_details);
  const elg = obj(d.itc_elg);
  const intr = headsOf(obj(d.intr_ltfee).intr_details);
  const fee = headsOf(obj(d.intr_ltfee).ltfee_details);
  const fromTxPy = arr(pmt.tx_py).map((r) => {
    const o = obj(r);
    const part = (k: 'tx' | 'intr' | 'fee'): TaxHeads => ({
      igst: num(obj(o.igst)[k]),
      cgst: num(obj(o.cgst)[k]),
      sgst: num(obj(o.sgst)[k]),
      cess: num(obj(o.cess)[k]),
    });
    return { transTyp: num(o.trans_typ), liabLdgId: o.liab_ldg_id == null ? null : num(o.liab_ldg_id), tax: part('tx'), interest: part('intr'), fee: part('fee') };
  });
  const forwardTax = addHeads(headsOf(sup.osup_det), headsOf(sup.osup_zero));
  const reverseTax = headsOf(sup.isup_rev);
  const line = (transTyp: number): LiabilityLine => fromTxPy.find((l) => l.transTyp === transTyp) ?? { transTyp, liabLdgId: null, tax: ZERO_HEADS, interest: ZERO_HEADS, fee: ZERO_HEADS };
  const fwd = line(TRANS_FORWARD);
  const rcm = line(TRANS_REVERSE);
  const txPyHasTax = fromTxPy.some((l) => totalOf(l.tax) > 0);
  const lines: LiabilityLine[] = [
    { ...fwd, tax: txPyHasTax ? fwd.tax : forwardTax, interest: totalOf(fwd.interest) > 0 ? fwd.interest : intr, fee: totalOf(fwd.fee) > 0 ? fwd.fee : fee },
    { ...rcm, tax: txPyHasTax ? rcm.tax : reverseTax },
  ];
  return { lines, itc: headsOf(elg.itc_net) };
}

export interface OffsetPlan {
  /** ITC used, by source head → liability head (the portal's `pditc` keys). */
  pditc: { i_pdi: number; i_pdc: number; i_pds: number; c_pdi: number; c_pdc: number; s_pdi: number; s_pds: number; cs_pdcs: number };
  /** Cash per ledger line (the portal's `pdcash` keys). */
  pdcash: Array<{ trans_typ: number; liab_ldg_id: number | null; ipd: number; cpd: number; spd: number; cspd: number; i_intrpd: number; c_intrpd: number; s_intrpd: number; cs_intrpd: number; c_lfeepd: number; s_lfeepd: number }>;
  itcUsed: TaxHeads;
  /** Cash needed per head (tax, interest and fee together). */
  cashByHead: TaxHeads;
  cashTotal: number;
  taxDue: TaxHeads;
}

/**
 * How ITC is set against the forward-charge tax, in the order section 49 and rule 88A require:
 * IGST credit first (IGST, then CGST, then SGST), then CGST credit (CGST, then IGST), then SGST
 * credit (SGST, then IGST); cess credit only against cess. Reverse-charge tax, interest and late
 * fee are always paid in cash. What is left is cash.
 */
export function offsetPlan(lines: LiabilityLine[], itcAvailable: TaxHeads): OffsetPlan {
  const fwd = lines.find((l) => l.transTyp === TRANS_FORWARD) ?? { transTyp: TRANS_FORWARD, liabLdgId: null, tax: ZERO_HEADS, interest: ZERO_HEADS, fee: ZERO_HEADS };
  const others = lines.filter((l) => l !== fwd);
  const left = { ...fwd.tax };
  const credit = { ...itcAvailable };
  const spend = (from: keyof TaxHeads, to: keyof TaxHeads) => {
    const x = r2(Math.max(0, Math.min(credit[from], left[to])));
    credit[from] = r2(credit[from] - x);
    left[to] = r2(left[to] - x);
    return x;
  };
  const i_pdi = spend('igst', 'igst');
  const i_pdc = spend('igst', 'cgst');
  const i_pds = spend('igst', 'sgst');
  const c_pdc = spend('cgst', 'cgst');
  const c_pdi = spend('cgst', 'igst');
  const s_pds = spend('sgst', 'sgst');
  const s_pdi = spend('sgst', 'igst');
  const cs_pdcs = spend('cess', 'cess');
  const itcUsed: TaxHeads = { igst: r2(i_pdi + i_pdc + i_pds), cgst: r2(c_pdc + c_pdi), sgst: r2(s_pds + s_pdi), cess: cs_pdcs };

  const cashLine = (l: LiabilityLine, tax: TaxHeads) => ({
    trans_typ: l.transTyp,
    liab_ldg_id: l.liabLdgId,
    ipd: tax.igst,
    cpd: tax.cgst,
    spd: tax.sgst,
    cspd: tax.cess,
    i_intrpd: l.interest.igst,
    c_intrpd: l.interest.cgst,
    s_intrpd: l.interest.sgst,
    cs_intrpd: l.interest.cess,
    c_lfeepd: l.fee.cgst,
    s_lfeepd: l.fee.sgst,
  });
  const pdcash = [cashLine(fwd, left), ...others.map((l) => cashLine(l, l.tax))];
  const cashByHead = pdcash.reduce<TaxHeads>(
    (a, c) => addHeads(a, { igst: c.ipd + c.i_intrpd, cgst: c.cpd + c.c_intrpd + c.c_lfeepd, sgst: c.spd + c.s_intrpd + c.s_lfeepd, cess: c.cspd + c.cs_intrpd }),
    ZERO_HEADS,
  );
  const taxDue = lines.reduce((a, l) => addHeads(a, l.tax), ZERO_HEADS);
  return { pditc: { i_pdi, i_pdc, i_pds, c_pdi, c_pdc, s_pdi, s_pds, cs_pdcs }, pdcash, itcUsed, cashByHead, cashTotal: totalOf(cashByHead), taxDue };
}

/** The offset request's `json_data` from a plan. */
export function offsetPayload(plan: OffsetPlan, fwdLiabLdgId: number | null): Obj {
  return {
    pdcash: plan.pdcash.filter((c) => c.ipd + c.cpd + c.spd + c.cspd + c.i_intrpd + c.c_intrpd + c.s_intrpd + c.cs_intrpd + c.c_lfeepd + c.s_lfeepd > 0),
    pditc: { liab_ldg_id: fwdLiabLdgId, trans_typ: TRANS_FORWARD, ...plan.pditc },
  };
}

/** Cash ledger balance per head (`cash_bal.<head>_tot_bal`). */
export function cashBalanceOf(message: unknown): TaxHeads {
  const c = obj(obj(message).cash_bal);
  const head = (k: string) => num(c[`${k}_tot_bal`] ?? (() => {
    const h = obj(c[k]);
    return num(h.tx) + num(h.intr) + num(h.pen) + num(h.fee) + num(h.oth);
  })());
  return { igst: head('igst'), cgst: head('cgst'), sgst: head('sgst'), cess: head('cess') };
}

/** Cash still to pay into the ledger: per head, what the plan needs above the balance. Cash cannot move between heads. */
export function cashShortOf(need: TaxHeads, balance: TaxHeads): number {
  return r2((['igst', 'cgst', 'sgst', 'cess'] as const).reduce((a, k) => a + Math.max(0, need[k] - balance[k]), 0));
}

/** ITC available in GSTR-2B, all heads together (`itcsumm.itcavl`: each group's own totals). */
export function itcIn2b(message: unknown): number {
  const avl = obj(obj(retsumData(message).itcsumm).itcavl);
  let total = 0;
  for (const group of Object.values(avl)) total += totalOf(headsOf(group));
  return r2(total);
}

/** The GSTR-3B card figures: tax due, ITC used and cash to pay per head, with interest and late fee. */
export function gstr3bSummary(input: { retsum: unknown; cashBalance?: unknown; twoB?: unknown; now: Date }): { summary: GstReturnSummary; plan: OffsetPlan } {
  const { lines, itc } = gstr3bLiability(input.retsum);
  const plan = offsetPlan(lines, itc);
  const interest = lines.reduce((a, l) => a + totalOf(l.interest), 0);
  const fee = lines.reduce((a, l) => a + totalOf(l.fee), 0);
  const table: SummaryTable = {
    columns: HEAD_COLUMNS,
    rows: [
      { label: 'Tax due', values: headValues(plan.taxDue) },
      { label: 'ITC available', values: headValues(itc) },
      { label: 'ITC used', values: headValues(plan.itcUsed) },
      { label: 'Cash to pay', values: headValues(plan.cashByHead) },
    ],
  };
  const balance = input.cashBalance === undefined ? null : cashBalanceOf(input.cashBalance);
  const twoBTotal = input.twoB === undefined ? null : itcIn2b(input.twoB);
  const claimed = totalOf(itc);
  return {
    plan,
    summary: {
      form: 'gstr3b',
      table,
      lines: [
        { label: 'Interest', value: r2(interest) },
        { label: 'Late fee', value: r2(fee) },
      ],
      cashNeeded: plan.cashTotal,
      cashBalance: balance ? totalOf(balance) : undefined,
      cashShort: balance ? cashShortOf(plan.cashByHead, balance) : undefined,
      twoB: twoBTotal === null ? null : { itcIn2b: twoBTotal, itcClaimed: claimed, difference: r2(claimed - twoBTotal) },
      fetchedAt: input.now.toISOString(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* GSTR-1                                                              */
/* ------------------------------------------------------------------ */

const GSTR1_SECTION_LABEL: Record<string, string> = {
  B2B: 'B2B invoices',
  B2BA: 'B2B amendments',
  B2CL: 'B2C large',
  B2CLA: 'B2C large amendments',
  B2CS: 'B2C small',
  B2CSA: 'B2C small amendments',
  CDNR: 'Credit and debit notes (registered)',
  CDNRA: 'Credit and debit notes (registered) amendments',
  CDNUR: 'Credit and debit notes (unregistered)',
  CDNURA: 'Credit and debit notes (unregistered) amendments',
  EXP: 'Exports',
  EXPA: 'Export amendments',
  AT: 'Advances received',
  ATA: 'Advances received amendments',
  TXPD: 'Advances adjusted',
  TXPDA: 'Advances adjusted amendments',
  NIL: 'Nil rated, exempt and non-GST',
  HSN: 'HSN summary',
  DOC_ISSUE: 'Documents issued',
  ECOM: 'E-commerce supplies',
  SUPECO: 'Supplies through e-commerce operators',
};

/**
 * The GSTR-1 card figures from RETSUM (`data.sec_sum`): one row per section with records, then a
 * total. `einvoices` is the count of e-invoices the portal holds for the period, when read.
 */
export function gstr1Summary(input: { retsum: unknown; einvoices?: number | null; now: Date }): GstReturnSummary {
  const d = retsumData(input.retsum);
  const rows = arr(d.sec_sum)
    .map((r) => obj(r))
    .filter((r) => num(r.ttl_rec) > 0 || num(r.ttl_val) > 0)
    .map((r) => {
      const name = (str(r.sec_nm) ?? '').toUpperCase();
      return {
        label: GSTR1_SECTION_LABEL[name] ?? name,
        values: [num(r.ttl_rec), num(r.ttl_val), num(r.ttl_igst), num(r.ttl_cgst), num(r.ttl_sgst), num(r.ttl_cess)],
      };
    });
  const total = rows.reduce((a, r) => a.map((x, i) => r2(x + (r.values[i] ?? 0))), [0, 0, 0, 0, 0, 0]);
  const lines: GstReturnSummary['lines'] = [];
  if (typeof input.einvoices === 'number') lines.push({ label: 'E-invoices on the portal', value: input.einvoices });
  return {
    form: 'gstr1',
    table: { columns: ['Records', 'Value', ...HEAD_COLUMNS], rows: rows.length ? [...rows, { label: 'Total', values: total }] : [] },
    lines,
    note: rows.length ? null : 'The portal holds no GSTR-1 data for this period yet.',
    fetchedAt: input.now.toISOString(),
  };
}

/** The raw summary string RETFILE needs for GSTR-1 (`data_json_string`, forwarded unchanged). */
export function dataJsonStringOf(message: unknown): string | null {
  return str(obj(message).data_json_string);
}

/** How many invoices a GSTR-1 download section holds (`b2b-einv`: parties, then invoices). */
export function invoiceCountOf(message: unknown, section: string): number {
  return arr(obj(message)[section]).reduce<number>((a, p) => a + arr(obj(p).inv).length, 0);
}

/* ------------------------------------------------------------------ */
/* GSTR-9 and GSTR-9C                                                  */
/* ------------------------------------------------------------------ */

const sumBlock = (v: unknown): TaxHeads & { txval: number } => {
  let acc = { ...ZERO_HEADS, txval: 0 };
  for (const x of Object.values(obj(v))) {
    if (!isObj(x)) continue;
    acc = { ...addHeads(acc, headsOf(x)), txval: r2(acc.txval + num(x.txval)) };
  }
  return acc;
};

/** The GSTR-9 data block, from the auto-calculated (`calcrecords`) or saved (`records`) answer. */
export function gstr9Data(message: unknown): Obj {
  return retsumData(message);
}

/** The GSTR-9 card figures: outward supplies (table 4), ITC availed (table 6A) and tax paid (table 9). */
export function gstr9Summary(input: { data: unknown; now: Date }): GstReturnSummary {
  const d = gstr9Data(input.data);
  const t4 = sumBlock(d.table4);
  const itc = headsOf(obj(d.table6).itc_3b);
  const t9 = obj(d.table9);
  const paid = sumBlock(t9);
  const rows = [
    { label: 'Supplies on which tax is payable (table 4)', values: [t4.txval, t4.igst, t4.cgst, t4.sgst, t4.cess] },
    { label: 'ITC availed in GSTR-3B (table 6A)', values: [0, itc.igst, itc.cgst, itc.sgst, itc.cess] },
  ];
  if (Object.keys(t9).length) rows.push({ label: 'Tax paid (table 9)', values: [0, paid.igst, paid.cgst, paid.sgst, paid.cess] });
  return {
    form: 'gstr9',
    table: { columns: ['Taxable value', ...HEAD_COLUMNS], rows },
    lines: [],
    note: Object.keys(obj(d.table4)).length ? null : 'The portal has not calculated GSTR-9 figures for this year yet.',
    fetchedAt: input.now.toISOString(),
  };
}

/** The GSTR-9 RETFILE `json_data`: the saved data with `isnil` and a zero offset for line 30002, as GSTZen's own filing sends. */
export function gstr9FilePayload(message: unknown): Obj {
  const d = { ...gstr9Data(message) };
  const zero = { intr: 0, tx: 0, fee: 0, tot: 0 };
  return {
    ...d,
    isnil: typeof d.isnil === 'string' ? d.isnil : 'N',
    offset: Array.isArray(d.offset) ? d.offset : [{ tran_cd: TRANS_FORWARD, igst: zero, cgst: zero, sgst: zero, cess: zero }],
  };
}

/** True when the GSTR-9C has been saved on the portal (`gstr9cdata.audited_data`). */
export function gstr9cSaved(retsum: unknown): boolean {
  return isObj(obj(obj(retsumData(retsum)).gstr9cdata).audited_data);
}

/** The GSTR-9C card figures: the GSTR-9 figures it reconciles and the saved turnover. */
export function gstr9cSummary(input: { records: unknown; retsum: unknown; now: Date }): GstReturnSummary {
  const g9 = obj(obj(input.records).gstr9_to_gstr9c);
  const saved = obj(obj(obj(retsumData(input.retsum)).gstr9cdata).audited_data);
  const t5 = obj(saved.table5);
  const t9 = obj(g9.table9);
  const paid = headsOf(t9.tot_amt_paid);
  const itc = headsOf(obj(g9.table12).itc_claimedfrom9);
  const rows = [
    { label: 'Tax paid as in GSTR-9 (table 9)', values: headValues(paid) },
    { label: 'ITC claimed in GSTR-9 (table 12)', values: headValues(itc) },
  ];
  const lines: GstReturnSummary['lines'] = [];
  if ('turnovr' in t5) lines.push({ label: 'Turnover in the audited statements (table 5A)', value: num(t5.turnovr) });
  return {
    form: 'gstr9c',
    table: { columns: HEAD_COLUMNS, rows },
    lines,
    note: gstr9cSaved(input.retsum) ? null : 'The GSTR-9C is not saved on the portal yet. Prepare it with the auditor and save it on the portal, then read the figures again.',
    fetchedAt: input.now.toISOString(),
  };
}

/** The data to sign for GSTR-9C (`json_data`): the saved 9C as RETSUM returns it. */
export function gstr9cFilePayload(retsum: unknown): Obj {
  const d = retsumData(retsum);
  return isObj(d.gstr9cdata) ? { gstr9cdata: d.gstr9cdata } : d;
}

/** Which summary builder a form uses, for callers that only need the form's labels. */
export const SUMMARY_COLUMNS: Record<GstForm, string[]> = {
  gstr1: ['Records', 'Value', ...HEAD_COLUMNS],
  gstr3b: HEAD_COLUMNS,
  gstr9: ['Taxable value', ...HEAD_COLUMNS],
  gstr9c: HEAD_COLUMNS,
};

/* ------------------------------------------------------------------ */
/* notices                                                             */
/* ------------------------------------------------------------------ */

export interface NoticeListItem {
  refId: string;
  arn: string | null;
  moduleCd: string | null;
  alertCd: string | null;
  issuedOn: string | null;
  /** The date the taxpayer replied, or null while the notice is open ("NA"). */
  respondedOn: string | null;
}

/** The notice list (`notices[]`), with or without the GSTZen envelope. */
export function noticesFromList(message: unknown): NoticeListItem[] {
  const m = obj(message);
  return arr(m.notices)
    .map((n) => obj(n))
    .map((n) => ({
      refId: str(n.refId) ?? str(n.ref_id) ?? '',
      arn: str(n.arn),
      moduleCd: str(n.moduleCd),
      alertCd: str(n.alertCd) ?? str(n.caseTypeCd),
      issuedOn: isoFromPortalDate(n.dateOfIssue ?? n.dateOfIssuance),
      respondedOn: isoFromPortalDate(n.dateOfRespond),
    }))
    .filter((n) => n.refId);
}

export interface NoticeDetail {
  noticeType: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  period: string | null;
  /** The detail as kept in `gst_notices.detail`: ids, names, dates and the period only; never a document body. */
  detail: Obj;
}

const docRefs = (v: unknown) =>
  arr(v)
    .map((d) => obj(obj(d).dcupdtls))
    .map((d) => ({ id: str(d.id), docName: str(d.docName) }))
    .filter((d) => d.id || d.docName);

/** One notice's detail without document bodies. */
export function noticeFromDetail(message: unknown, item: NoticeListItem): NoticeDetail {
  const m = obj(message);
  const tp = obj(m.taxPeriod);
  const from = str(tp.fromMonth) && str(tp.fromYear) ? `${str(tp.fromMonth)}/${str(tp.fromYear)}` : null;
  const to = str(tp.toMonth) && str(tp.toYear) ? `${str(tp.toMonth)}/${str(tp.toYear)}` : null;
  const period = from && to ? (from === to ? from : `${from} to ${to}`) : (from ?? to);
  const noticeType = str(m.noticeType) ?? item.alertCd ?? item.moduleCd;
  return {
    noticeType,
    issuedOn: isoFromPortalDate(m.dateOfIssue) ?? item.issuedOn,
    dueOn: isoFromPortalDate(m.dueDateOfReply),
    period,
    detail: {
      refId: item.refId,
      arn: str(m.arn) ?? item.arn,
      moduleCd: item.moduleCd,
      alertCd: item.alertCd,
      noticeType,
      dateOfIssue: isoFromPortalDate(m.dateOfIssue) ?? item.issuedOn,
      dueDateOfReply: isoFromPortalDate(m.dueDateOfReply),
      respondedOn: item.respondedOn,
      taxPeriod: Object.keys(tp).length ? { fromMonth: str(tp.fromMonth), fromYear: str(tp.fromYear), toMonth: str(tp.toMonth), toYear: str(tp.toYear) } : null,
      maindocs: docRefs(m.maindocs),
      suppdocs: docRefs(m.suppdocs),
    },
  };
}

/** Document names a stored notice detail lists. */
export function noticeDocumentNames(detail: unknown): string[] {
  const d = obj(detail);
  return [...arr(d.maindocs), ...arr(d.suppdocs)].map((x) => str(obj(x).docName)).filter((x): x is string => Boolean(x));
}

/* ------------------------------------------------------------------ */
/* GSTIN validator                                                     */
/* ------------------------------------------------------------------ */

/** The validator's answer, as the tracker shows it for confirmation. */
export function gstinCheckOf(body: unknown, gstin: string): GstinCheckResult {
  const b = obj(body);
  const c = obj(b.company_details);
  const pr = obj(c.pradr);
  const stj = str(c.stj);
  const ctj = str(c.ctj);
  return {
    gstin: str(b.gstin) ?? gstin,
    valid: b.valid === true,
    legalName: str(c.legal_name),
    tradeName: str(c.trade_name),
    status: str(c.company_status),
    registeredOn: isoFromPortalDate(c.registration_date),
    taxpayerType: str(c.gst_type),
    constitution: str(c.ctb),
    state: str(obj(c.state_info).name) ?? str(c.state),
    jurisdiction: stj || ctj ? [stj && `State: ${stj}`, ctj && `Centre: ${ctj}`].filter(Boolean).join(' · ') : null,
    principalAddress: str(pr.addr),
  };
}
