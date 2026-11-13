/**
 * LATE-FEE RULES — the statutory late fees that grow with the days a filing is late (A1.5,
 * phase 1 of the penalty calculator).
 *
 * Each rule names the obligations it covers, the way the fee is worked out, the law behind it
 * and the date the rule was last checked. The calculator in `src/lib/compliance/late-fees.ts`
 * reads these rules; it never invents an amount. A reviewer can correct a figure here without
 * touching the calculator.
 *
 * Only fees that depend on the due date and the filed date are covered. Interest on tax, TDS
 * or PF dues needs the amount of the dues and is left for phase 2. Every figure is an estimate
 * for SBC staff to check before it is quoted to a client.
 *
 * Kinds:
 *  - `per-day`: `perDay` rupees for each day late, stopped at `cap` when there is one;
 *  - `fixed`: `amount` rupees once the due date has passed;
 *  - `maximum`: the most an authority may impose (`base` plus `perDay` while it continues,
 *    up to `cap`); the actual penalty is decided in adjudication.
 *
 * Pure data: no imports from the database or the UI.
 */

export type LateFeeKind = 'per-day' | 'fixed' | 'maximum';

export interface LateFeeRule {
  id: string;
  /** `compliance_obligations.id` values the rule covers. */
  obligationIds: string[];
  /** Lower-case fragments of `compliance_obligations.particular`, for rows that carry no obligation id. */
  particulars: string[];
  kind: LateFeeKind;
  perDay?: number;
  amount?: number;
  base?: number;
  cap?: number;
  /** Short plain statement of the fee, shown beside the amount. */
  basis: string;
  /** A caveat the amount cannot capture (a lower cap, a per-director fee, a cap from the dues). */
  note?: string;
  /** The law behind the fee, one short line. */
  citation: string;
  /** The date the rule was last checked, yyyy-mm-dd. */
  asOf: string;
}

const CHECKED = '2026-11-13';

export const LATE_FEE_RULES: readonly LateFeeRule[] = [
  {
    id: 'gst-gstr-1',
    obligationIds: ['gst-gstr-1'],
    particulars: ['gstr-1'],
    kind: 'per-day',
    perDay: 50,
    cap: 10_000,
    basis: '₹50 a day (₹25 CGST + ₹25 SGST)',
    note: 'Nil return ₹20 a day. Cap ₹10,000 above ₹5 crore turnover, ₹5,000 up to ₹5 crore, ₹2,000 up to ₹1.5 crore.',
    citation: 'CGST Act, 2017, section 47, with Notification 20/2021-Central Tax.',
    asOf: CHECKED,
  },
  {
    id: 'gst-gstr-3b',
    obligationIds: ['gst-gstr-3b'],
    particulars: ['gstr-3b'],
    kind: 'per-day',
    perDay: 50,
    cap: 10_000,
    basis: '₹50 a day (₹25 CGST + ₹25 SGST)',
    note: 'Nil return ₹20 a day. Cap ₹10,000 above ₹5 crore turnover, ₹5,000 up to ₹5 crore, ₹2,000 up to ₹1.5 crore. Interest at 18% on unpaid tax is separate.',
    citation: 'CGST Act, 2017, section 47, with Notification 19/2021-Central Tax.',
    asOf: CHECKED,
  },
  {
    id: 'it-tds-return',
    obligationIds: ['it-tds-return-q1', 'it-tds-return-q2', 'it-tds-return-q3', 'it-tds-return-q4'],
    particulars: ['tds return'],
    kind: 'per-day',
    perDay: 200,
    basis: '₹200 a day until the return is filed',
    note: 'The fee cannot exceed the TDS for the quarter, which is not recorded here.',
    citation: 'Income-tax Act, 1961, section 234E; the Income-tax Act, 2025 carries the same fee for periods from 1 April 2026.',
    asOf: CHECKED,
  },
  {
    id: 'it-itr',
    obligationIds: ['it-itr'],
    particulars: ['income tax return'],
    kind: 'fixed',
    amount: 5_000,
    basis: '₹5,000 once the due date has passed',
    note: 'Interest on any unpaid tax is separate.',
    citation: 'Income-tax Act, 1961, section 234F.',
    asOf: CHECKED,
  },
  {
    id: 'mca-annual-forms',
    obligationIds: ['mca-aoc-4', 'mca-mgt-7'],
    particulars: ['aoc-4', 'mgt-7'],
    kind: 'per-day',
    perDay: 100,
    basis: '₹100 a day additional fee, with no upper limit',
    note: 'The normal filing fee is payable as well.',
    citation: 'Companies (Registration Offices and Fees) Rules, 2014, as amended.',
    asOf: CHECKED,
  },
  {
    id: 'llp-annual-forms',
    obligationIds: ['llp-form-11', 'llp-form-8'],
    particulars: ['form 11', 'form 8'],
    kind: 'per-day',
    perDay: 100,
    basis: '₹100 a day additional fee',
    note: 'The normal filing fee is payable as well.',
    citation: 'Limited Liability Partnership Rules, 2009, as amended in 2022.',
    asOf: CHECKED,
  },
  {
    id: 'mca-dir3-kyc',
    obligationIds: ['mca-dir3-kyc'],
    particulars: ['dir-3 kyc'],
    kind: 'fixed',
    amount: 5_000,
    basis: '₹5,000 to reactivate the DIN',
    note: 'Payable for each director who missed the KYC.',
    citation: 'Companies (Appointment and Qualification of Directors) Rules, 2014, rule 12A.',
    asOf: CHECKED,
  },
  {
    id: 'mca-msme-1',
    obligationIds: ['mca-msme-1-apr', 'mca-msme-1-oct'],
    particulars: ['msme-1'],
    kind: 'maximum',
    base: 20_000,
    perDay: 1_000,
    cap: 300_000,
    basis: 'Up to ₹20,000, plus ₹1,000 a day while it continues',
    note: 'A maximum, decided in adjudication. It applies to the company and to each officer in default.',
    citation: 'Companies Act, 2013, section 405(4).',
    asOf: CHECKED,
  },
];
