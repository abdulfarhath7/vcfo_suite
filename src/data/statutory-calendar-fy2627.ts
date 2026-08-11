import type { Engagement } from '@/data/engagements';
import type { IconChipTone } from '@/components/common/IconChip';

/**
 * SBC master statutory compliance calendar — FY 2026-27 (Apr 2026 – Mar 2027).
 * Source: "A4 Final_SBC_Compliance Calendar 2026-27_Final Draft" PDF.
 *
 * These are fixed all-India deadlines (the reference calendar), distinct from
 * the per-engagement generated filings in src/lib/compliance/. Per-company
 * applicability will be captured at project creation; until then
 * `deadlineAppliesTo()` derives it from the company profile.
 */

export type StatutoryAct =
  | 'GST'
  | 'IT'
  | 'MCA'
  | 'FEMA'
  | 'STPI/SEZ'
  | 'LABOUR'
  | 'RERA'
  | 'TP';

/** MCA scope — company-law forms vs LLP-law forms. */
type McaScope = 'co' | 'llp';

export interface StatutoryDeadline {
  id: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  act: StatutoryAct;
  title: string;
  /** Only meaningful for MCA items. */
  scope?: McaScope;
}

export const ACT_META: Record<
  StatutoryAct,
  { label: string; full: string; tone: IconChipTone }
> = {
  GST:        { label: 'GST',      full: 'Goods & Services Tax',      tone: 'emerald' },
  IT:         { label: 'IT',       full: 'Income Tax',                tone: 'sky' },
  MCA:        { label: 'MCA',      full: 'Ministry of Corporate Affairs', tone: 'violet' },
  FEMA:       { label: 'FEMA',     full: 'Foreign Exchange (RBI)',    tone: 'rose' },
  'STPI/SEZ': { label: 'STPI/SEZ', full: 'STPI & SEZ reporting',      tone: 'orange' },
  LABOUR:     { label: 'Labour',   full: 'PF / ESI / Professional Tax', tone: 'teal' },
  RERA:       { label: 'RERA',     full: 'Real Estate Regulation',    tone: 'pink' },
  TP:         { label: 'TP',       full: 'Transfer Pricing',          tone: 'amber' },
};

export const FY_LABEL = 'FY 2026-27';
export const FY_START = '2026-04-01';
export const FY_END = '2027-03-31';

/** Compact row: [date, act, title, mcaScope?] */
type Row = [string, StatutoryAct, string, McaScope?];

const ROWS: Row[] = [
  // ─── APRIL 2026 ───
  ['2026-04-01', 'MCA', 'Form MBP-1 & Form DIR-8', 'co'],
  ['2026-04-01', 'GST', 'Filing of LUT (before export of services/goods)'],
  ['2026-04-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-04-07', 'FEMA', 'ECB-2 monthly & quarterly return (Jan–Mar ’26)'],
  ['2026-04-07', 'IT', 'TCS challan (Mar ’26)'],
  ['2026-04-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-04-07', 'RERA', 'AP RERA quarterly progress report (Q4 FY 2025-26)'],
  ['2026-04-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-04-10', 'LABOUR', 'PT payment'],
  ['2026-04-10', 'STPI/SEZ', 'STPI-SERF, STPI-QPR, SEZ-SERF'],
  ['2026-04-11', 'GST', 'GSTR-1'],
  ['2026-04-13', 'GST', 'GSTR-1 QRMP; GSTR-6 (ISD); GSTR-5 (NRTP)'],
  ['2026-04-14', 'RERA', 'TG RERA quarterly progress report (Q4 FY 2025-26)'],
  ['2026-04-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-04-18', 'GST', 'CMP-08 (Jan–Mar ’26)'],
  ['2026-04-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-04-22', 'GST', 'GSTR-3B under QRMP for Q4 — Category 1 states'],
  ['2026-04-24', 'GST', 'GSTR-3B under QRMP for Q4 — Category 2 states'],
  ['2026-04-25', 'GST', 'ITC-04 (Oct ’25 – Mar ’26); PMT-06 (QRMP)'],
  ['2026-04-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-04-30', 'GST', 'Opt in/out of QRMP scheme'],
  ['2026-04-30', 'IT', 'TDS challan (Mar ’26); Form 121 (Jan–Mar ’26)'],
  ['2026-04-30', 'LABOUR', 'PT payment — annual (FY 2026-27)'],
  ['2026-04-30', 'MCA', 'Form MSME-1 (Oct ’25 – Mar ’26)', 'co'],

  // ─── MAY 2026 ───
  ['2026-05-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-05-07', 'FEMA', 'ECB-2 monthly return'],
  ['2026-05-07', 'IT', 'TDS/TCS challan'],
  ['2026-05-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-05-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-05-10', 'LABOUR', 'PT payment'],
  ['2026-05-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2026-05-11', 'GST', 'GSTR-1'],
  ['2026-05-13', 'GST', 'QRMP (IFF); GSTR-6 (ISD); GSTR-5 (NRTP)'],
  ['2026-05-15', 'IT', 'TCS return (Jan–Mar ’26)'],
  ['2026-05-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-05-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-05-25', 'GST', 'PMT-06 (QRMP)'],
  ['2026-05-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-05-30', 'IT', 'Form 27D (Jan–Mar ’26); Form 49C (liaison office); Form 141 challan-cum-statement (Apr ’26)'],
  ['2026-05-30', 'MCA', 'LLP Form 11 (FY 2025-26)', 'llp'],
  ['2026-05-31', 'IT', 'TDS returns Q4 FY 2025-26; SFT Form 61A (FY 2025-26)'],

  // ─── JUNE 2026 ───
  ['2026-06-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-06-07', 'FEMA', 'ECB-2 monthly return'],
  ['2026-06-07', 'IT', 'TDS/TCS challan'],
  ['2026-06-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-06-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-06-10', 'LABOUR', 'PT payment'],
  ['2026-06-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2026-06-11', 'GST', 'GSTR-1'],
  ['2026-06-13', 'GST', 'QRMP (IFF); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2026-06-15', 'IT', 'Advance tax Q1; Form 16 (FY 25-26) & Form 16A (Jan–Mar ’26)'],
  ['2026-06-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-06-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-06-25', 'GST', 'PMT-06 (QRMP)'],
  ['2026-06-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-06-30', 'MCA', 'Form DPT-3', 'co'],
  ['2026-06-30', 'GST', 'IEC code renewal; GSTR-4 (annual return, composition)'],
  ['2026-06-30', 'STPI/SEZ', 'STPI – APR (FY 2025-26)'],
  ['2026-06-30', 'IT', 'Form 141 challan-cum-statement (May ’26)'],

  // ─── JULY 2026 ───
  ['2026-07-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-07-07', 'FEMA', 'ECB-2 monthly & quarterly return (Apr–Jun ’26)'],
  ['2026-07-07', 'IT', 'TDS/TCS challan'],
  ['2026-07-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-07-07', 'RERA', 'AP RERA quarterly progress report (Q1 FY 2026-27)'],
  ['2026-07-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-07-10', 'LABOUR', 'PT payment'],
  ['2026-07-10', 'STPI/SEZ', 'STPI-SERF, STPI-QPR, SEZ-SERF'],
  ['2026-07-11', 'GST', 'GSTR-1'],
  ['2026-07-13', 'GST', 'GSTR-1 QRMP (Apr–Jun ’26); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2026-07-14', 'RERA', 'TG RERA quarterly progress report (Q1 FY 2026-27)'],
  ['2026-07-15', 'FEMA', 'Form FLA return (unaudited financials)'],
  ['2026-07-15', 'IT', 'Form 121 (Apr–Jun ’26); TCS return Q1'],
  ['2026-07-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-07-18', 'GST', 'CMP-08 (Apr–Jun ’26)'],
  ['2026-07-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-07-22', 'GST', 'GSTR-3B under QRMP for Q1 — Category 1 states'],
  ['2026-07-24', 'GST', 'GSTR-3B under QRMP for Q1 — Category 2 states'],
  ['2026-07-25', 'GST', 'PMT-06 (QRMP)'],
  ['2026-07-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-07-30', 'IT', 'Form 141 challan-cum-statement (Jun ’26)'],
  ['2026-07-31', 'IT', 'TDS return Q1; ITR-1 & ITR-2 (non-corporate, non-audit)'],
  ['2026-07-31', 'IT', 'Form 27D Q1; Form 67 (non-corporate)'],

  // ─── AUGUST 2026 ───
  ['2026-08-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-08-07', 'FEMA', 'ECB-2 monthly return'],
  ['2026-08-07', 'IT', 'TDS/TCS challan'],
  ['2026-08-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-08-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-08-10', 'LABOUR', 'PT payment'],
  ['2026-08-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2026-08-11', 'GST', 'GSTR-1'],
  ['2026-08-13', 'GST', 'QRMP (IFF); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2026-08-15', 'IT', 'Form 16A — Q1'],
  ['2026-08-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-08-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-08-25', 'GST', 'PMT-06 (QRMP)'],
  ['2026-08-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-08-30', 'IT', 'Form 141 challan-cum-statement (Jul ’26)'],
  ['2026-08-31', 'IT', 'ITR-3 & ITR-4 for FY 2025-26 (non-audit cases)'],

  // ─── SEPTEMBER 2026 ───
  ['2026-09-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-09-07', 'FEMA', 'ECB-2 monthly return'],
  ['2026-09-07', 'IT', 'TDS/TCS challan'],
  ['2026-09-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-09-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-09-10', 'LABOUR', 'PT payment'],
  ['2026-09-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2026-09-11', 'GST', 'GSTR-1'],
  ['2026-09-13', 'GST', 'QRMP (IFF); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2026-09-15', 'IT', 'Advance tax Q2'],
  ['2026-09-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-09-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-09-25', 'GST', 'PMT-06 (QRMP)'],
  ['2026-09-29', 'MCA', 'Form AOC-4 — annual accounts (OPC)', 'co'],
  ['2026-09-30', 'FEMA', 'Annual Activity Certificate; FLA return (audited)'],
  ['2026-09-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-09-30', 'IT', 'Tax audit report (non-TP cases)'],
  ['2026-09-30', 'MCA', 'Form DIR-3 KYC; AGM', 'co'],
  ['2026-09-30', 'STPI/SEZ', 'SEZ – APR (FY 2025-26)'],
  ['2026-09-30', 'IT', 'Form 141 challan-cum-statement (Aug ’26)'],

  // ─── OCTOBER 2026 ───
  ['2026-10-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-10-07', 'FEMA', 'ECB-2 monthly & quarterly return (Jul–Sep ’26)'],
  ['2026-10-07', 'IT', 'TDS/TCS challan'],
  ['2026-10-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-10-07', 'RERA', 'AP RERA quarterly progress report (Q2 FY 2026-27)'],
  ['2026-10-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-10-10', 'LABOUR', 'PT payment'],
  ['2026-10-10', 'STPI/SEZ', 'STPI-SERF, STPI-QPR, SEZ-SERF'],
  ['2026-10-11', 'GST', 'GSTR-1'],
  ['2026-10-13', 'GST', 'GSTR-1 QRMP (Jul–Sep ’26); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2026-10-14', 'RERA', 'TG RERA quarterly progress report (Q2 FY 2026-27)'],
  ['2026-10-15', 'IT', 'TCS return Q2; Form 121 Q2'],
  ['2026-10-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-10-18', 'GST', 'CMP-08 (Jul–Sep ’26)'],
  ['2026-10-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-10-22', 'GST', 'GSTR-3B under QRMP for Q2 — Category 1 states'],
  ['2026-10-24', 'GST', 'GSTR-3B under QRMP for Q2 — Category 2 states'],
  ['2026-10-25', 'GST', 'ITC-04 (Apr–Sep ’26); PMT-06 (QRMP)'],
  ['2026-10-29', 'MCA', 'Form AOC-4', 'co'],
  ['2026-10-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-10-30', 'IT', 'Form 27D Q2; Form 141 challan-cum-statement (Sep ’26)'],
  ['2026-10-30', 'MCA', 'Form 8-LLP', 'llp'],
  ['2026-10-30', 'MCA', 'MSME-1 (Apr–Sep ’26)', 'co'],
  ['2026-10-31', 'IT', 'TDS return Q2; ITR (non-TP cases); tax audit (TP cases)'],
  ['2026-10-31', 'IT', 'Form 29B (non-TP); Form 56F; 10CCB/10DA; Form 67'],
  ['2026-10-31', 'TP', 'TP study report; Form 3CEB, 3CEAB, 3CEAC'],
  ['2026-10-31', 'GST', 'Last date to claim ITC for FY 2025-26'],

  // ─── NOVEMBER 2026 ───
  ['2026-11-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-11-07', 'FEMA', 'ECB-2 monthly return'],
  ['2026-11-07', 'IT', 'TDS/TCS challan'],
  ['2026-11-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-11-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-11-10', 'LABOUR', 'PT payment'],
  ['2026-11-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2026-11-11', 'GST', 'GSTR-1'],
  ['2026-11-13', 'GST', 'QRMP (IFF); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2026-11-15', 'IT', 'Form 16A — Q2'],
  ['2026-11-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-11-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-11-25', 'GST', 'PMT-06 (QRMP)'],
  ['2026-11-29', 'MCA', 'Form MGT-7 — annual return', 'co'],
  ['2026-11-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-11-30', 'IT', 'ITR (TP cases); Form 10-ID / 10-IC'],
  ['2026-11-30', 'IT', 'Form 3CEAA, 3CEFA; Form 67 (TP cases)'],
  ['2026-11-30', 'LABOUR', 'Renewal of labour registration'],
  ['2026-11-30', 'IT', 'Form 141 challan-cum-statement (Oct ’26)'],

  // ─── DECEMBER 2026 ───
  ['2026-12-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2026-12-07', 'FEMA', 'ECB-2 monthly return'],
  ['2026-12-07', 'IT', 'TDS/TCS challan'],
  ['2026-12-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2026-12-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2026-12-10', 'LABOUR', 'PT payment'],
  ['2026-12-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2026-12-11', 'GST', 'GSTR-1'],
  ['2026-12-13', 'GST', 'QRMP (IFF); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2026-12-15', 'IT', 'Advance tax Q3'],
  ['2026-12-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2026-12-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2026-12-25', 'GST', 'PMT-06 (QRMP)'],
  ['2026-12-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2026-12-30', 'IT', 'Form 141 challan-cum-statement (Nov ’26)'],
  ['2026-12-31', 'FEMA', 'Annual Performance Report (Form APR)'],
  ['2026-12-31', 'GST', 'GSTR-9 & GSTR-9C (FY 2025-26)'],
  ['2026-12-31', 'IT', 'Revised / belated ITR for AY 2026-27'],
  ['2026-12-31', 'MCA', 'AGM for newly incorporated companies', 'co'],
  ['2026-12-31', 'IT', 'Form 3CEAD — CbC report'],

  // ─── JANUARY 2027 ───
  ['2027-01-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2027-01-07', 'FEMA', 'ECB-2 monthly & quarterly return (Oct–Dec ’26)'],
  ['2027-01-07', 'IT', 'TDS/TCS challan'],
  ['2027-01-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2027-01-07', 'RERA', 'AP RERA quarterly progress report (Q3 FY 2026-27)'],
  ['2027-01-10', 'GST', 'GSTR-7 & GSTR-8'],
  ['2027-01-10', 'LABOUR', 'PT payment'],
  ['2027-01-10', 'STPI/SEZ', 'STPI-SERF, STPI-QPR, SEZ-SERF'],
  ['2027-01-11', 'GST', 'GSTR-1'],
  ['2027-01-13', 'GST', 'GSTR-1 QRMP (Oct–Dec ’26); GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2027-01-14', 'RERA', 'TG RERA quarterly progress report (Q3 FY 2026-27)'],
  ['2027-01-15', 'IT', 'TCS return Q3; Form 121 Q3'],
  ['2027-01-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2027-01-18', 'GST', 'CMP-08 (Oct–Dec ’26)'],
  ['2027-01-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2027-01-22', 'GST', 'GSTR-3B under QRMP for Q3 — Category 1 states'],
  ['2027-01-24', 'GST', 'GSTR-3B under QRMP for Q3 — Category 2 states'],
  ['2027-01-25', 'GST', 'PMT-06 (QRMP)'],
  ['2027-01-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2027-01-30', 'IT', 'Form 27D Q3; Form 141 challan-cum-statement (Dec ’26)'],
  ['2027-01-31', 'IT', 'TDS return Q3'],
  ['2027-01-31', 'TP', 'Form 3CEAC'],

  // ─── FEBRUARY 2027 ───
  ['2027-02-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2027-02-07', 'FEMA', 'ECB-2 monthly return'],
  ['2027-02-07', 'IT', 'TDS/TCS challan'],
  ['2027-02-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2027-02-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2027-02-10', 'LABOUR', 'PT payment'],
  ['2027-02-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2027-02-11', 'GST', 'GSTR-1'],
  ['2027-02-13', 'GST', 'GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2027-02-15', 'IT', 'Form 121 — Q3'],
  ['2027-02-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2027-02-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2027-02-25', 'GST', 'PMT-06 (QRMP)'],
  ['2027-02-28', 'FEMA', 'STPI/SEZ — Softex filing'],

  // ─── MARCH 2027 ───
  ['2027-03-02', 'IT', 'Form 141 challan-cum-statement (Jan ’27)'],
  ['2027-03-05', 'STPI/SEZ', 'SEZ – MPR'],
  ['2027-03-07', 'FEMA', 'ECB-2 monthly return'],
  ['2027-03-07', 'IT', 'TDS/TCS challan'],
  ['2027-03-07', 'STPI/SEZ', 'STPI – MPR'],
  ['2027-03-10', 'GST', 'GSTR-7 & GSTR-8; Form A & B (EOU); MOOWR return'],
  ['2027-03-10', 'LABOUR', 'PT payment'],
  ['2027-03-10', 'STPI/SEZ', 'STPI-SERF, SEZ-SERF'],
  ['2027-03-11', 'GST', 'GSTR-1'],
  ['2027-03-13', 'GST', 'GSTR-5 (NRTP); GSTR-6 (ISD)'],
  ['2027-03-15', 'IT', 'Advance tax Q4'],
  ['2027-03-15', 'LABOUR', 'Payment of PF and ESI'],
  ['2027-03-16', 'GST', 'CMP-08 composition (Jan–Mar ’27)'],
  ['2027-03-20', 'GST', 'GSTR-3B; GSTR-5A (OIDAR)'],
  ['2027-03-25', 'GST', 'PMT-06 (QRMP)'],
  ['2027-03-30', 'IT', 'Form 141 challan-cum-statement (Feb ’27)'],
  ['2027-03-30', 'FEMA', 'STPI/SEZ — Softex filing'],
  ['2027-03-31', 'IT', 'Updated ITR u/s 139(8A) for AY 2024-25'],
  ['2027-03-31', 'MCA', 'LLP Form 11 (annual return)', 'llp'],
  ['2027-03-31', 'GST', 'GSTR-9 & GSTR-9C (if pending)'],
  ['2027-03-31', 'IT', 'Transfer pricing documentation; updated return (ITR-U)'],
];

export const STATUTORY_DEADLINES: StatutoryDeadline[] = ROWS.map(
  ([date, act, title, scope], i) => ({
    id: `sd-${date}-${i}`,
    date,
    act,
    title,
    scope,
  }),
);

/**
 * Interim applicability, derived from the company profile. Project creation
 * will eventually capture explicit applicability per company; until then:
 * - MCA company-law forms need a Company; LLP forms need an LLP.
 * - FEMA / Transfer Pricing / STPI-SEZ apply to foreign-parent (GCC) entities.
 * - RERA only applies to real-estate businesses — none in a GCC portfolio.
 */
export function deadlineAppliesTo(
  item: StatutoryDeadline,
  engagement: Engagement,
): boolean {
  const legalForm = engagement.entityLegalForm ?? 'company';
  const isForeign =
    engagement.companyType === 'foreign' || Boolean(engagement.parentEntityName);

  if (item.act === 'MCA') {
    if (item.scope === 'llp') return legalForm === 'llp';
    return legalForm === 'company';
  }
  if (item.act === 'FEMA' || item.act === 'TP' || item.act === 'STPI/SEZ') {
    return isForeign;
  }
  if (item.act === 'RERA') return false;
  return true;
}
