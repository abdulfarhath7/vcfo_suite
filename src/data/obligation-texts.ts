/**
 * OBLIGATION TEXTS — the "About", "Why it applies" and "If filed late" lines on the
 * obligation records (G-04), keyed by `compliance_obligations.id`.
 *
 * One entry per row the register seeds (`src/lib/compliance/obligations-seed.ts`); the
 * test beside this file fails when a seeded obligation has no text. The texts describe the
 * law in plain sentences: what the filing is, who must file it, and what the law charges
 * when it is late. Where a figure depends on facts the register does not hold (turnover,
 * the amount involved, the officer in default), the text describes the consequence
 * without a number. Section numbers are left out on purpose, because the Income-tax Act,
 * 2025 renumbered the 1961 Act from 1 April 2026 while the rates stayed the same.
 *
 * Pure data: no imports from the database or the UI.
 */

export interface ObligationText {
  /** What the filing or payment is. */
  about: string;
  /** Who must file it, and when the duty starts. */
  whyItApplies: string;
  /** The late fee, interest or penalty the law sets. */
  ifLate: string;
}

const ADVANCE_TAX: Omit<ObligationText, 'about'> = {
  whyItApplies:
    'Every company, LLP, firm and person whose tax for the year, after TDS, is estimated at Rs 10,000 or more pays advance tax. A resident individual who has no business income and is 60 or older does not have to pay it.',
  ifLate:
    'Interest of 1% a month is charged on each instalment that falls short, and a further 1% a month runs from 1 April on the tax still unpaid if less than 90% of the year’s tax was paid by 31 March.',
};

const TDS_RETURN: Omit<ObligationText, 'about'> = {
  whyItApplies:
    'Every business with a TAN that deducted tax at source in the quarter files the quarterly statement: Form 24Q for salaries, 26Q for other payments to residents and 27Q for payments to non-residents.',
  ifLate:
    'A late fee of Rs 200 a day runs until the statement is filed, capped at the tax deducted. A penalty of Rs 10,000 to Rs 1,00,000 can also be levied when the statement is more than a year late or wrong.',
};

const DIRECTOR_KYC: Pick<ObligationText, 'ifLate'> = {
  ifLate:
    'The MCA marks the DIN as deactivated, and the person cannot sign or file as a director or partner until the KYC is filed with a fee of Rs 5,000.',
};

const MSME_1: Omit<ObligationText, 'about'> = {
  whyItApplies:
    'Every company that owes money to a micro or small enterprise for more than 45 days from acceptance of the goods or services files this return, with the amount due and the reason for the delay.',
  ifLate:
    'The MCA charges an additional fee for each day of delay, and the company and its officers in default can be fined under the Companies Act.',
};

export const OBLIGATION_TEXTS: Record<string, ObligationText> = {
  'it-advance-tax-q1': {
    about: 'The first instalment of advance tax for the financial year: at least 15% of the tax the business expects to owe for the year.',
    ...ADVANCE_TAX,
  },
  'it-advance-tax-q2': {
    about: 'The second instalment of advance tax: by this date at least 45% of the year’s estimated tax should have been paid.',
    ...ADVANCE_TAX,
  },
  'it-advance-tax-q3': {
    about: 'The third instalment of advance tax: by this date at least 75% of the year’s estimated tax should have been paid.',
    ...ADVANCE_TAX,
  },
  'it-advance-tax-q4': {
    about: 'The last instalment of advance tax: by this date the whole of the year’s estimated tax should have been paid.',
    ...ADVANCE_TAX,
  },
  'it-tds-payment': {
    about:
      'The tax deducted at source in a month (on salaries, rent, professional fees, contractor payments and similar) is paid to the government with a challan. Tax deducted in March may be paid until 30 April.',
    whyItApplies:
      'Every business with a TAN that deducts tax at source on a payment must pay that tax over each month.',
    ifLate:
      'Interest of 1.5% a month, or part of a month, runs from the date of deduction to the date of payment. When the tax is still unpaid on the due date of the income tax return, part or all of the expense it was deducted from is disallowed.',
  },
  'it-tds-return-q1': {
    about: 'The TDS statement for April to June: the details of every deduction made in the quarter and the challans that paid it.',
    ...TDS_RETURN,
  },
  'it-tds-return-q2': {
    about: 'The TDS statement for July to September: the details of every deduction made in the quarter and the challans that paid it.',
    ...TDS_RETURN,
  },
  'it-tds-return-q3': {
    about: 'The TDS statement for October to December: the details of every deduction made in the quarter and the challans that paid it.',
    ...TDS_RETURN,
  },
  'it-tds-return-q4': {
    about: 'The TDS statement for January to March: the details of every deduction made in the quarter and the challans that paid it.',
    ...TDS_RETURN,
  },
  'it-itr': {
    about:
      'The income tax return for the financial year: the income, the deductions and the tax paid. Companies file ITR-6; LLPs and firms file ITR-5.',
    whyItApplies:
      'Every company and LLP must file a return each year, even with a loss or no income. A firm or a person files when the income is above the exemption limit. The date is 31 July when no tax audit is needed and 31 October when the accounts are audited.',
    ifLate:
      'A late fee of up to Rs 5,000 is charged (Rs 1,000 when the total income is up to Rs 5 lakh), interest of 1% a month runs on any tax unpaid, and business losses of the year cannot be carried forward.',
  },
  'it-form-16': {
    about: 'The TDS certificate for salaries that the employer gives each employee for the financial year, generated from the TRACES portal.',
    whyItApplies: 'Every employer that deducted tax from salaries during the year issues Form 16 to each of those employees.',
    ifLate: 'A penalty of Rs 100 a day can be levied for as long as the certificate is not issued, up to the tax deducted.',
  },
  'gst-gstr-1': {
    about:
      'The monthly statement of outward supplies: every sale invoice, credit note and export of the month. A business on the quarterly (QRMP) scheme files it by the 13th after the quarter.',
    whyItApplies: 'Every business registered under GST as a regular taxpayer files GSTR-1 for each period, even when there were no sales.',
    ifLate:
      'A late fee of Rs 50 a day (Rs 20 a day for a nil return) is charged, capped by the business’s turnover. Buyers cannot take input tax credit on the invoices until the return is filed.',
  },
  'gst-gstr-3b': {
    about:
      'The monthly summary return that pays the GST due for the month after setting off input tax credit. A business on the quarterly (QRMP) scheme files it by the 22nd or 24th after the quarter.',
    whyItApplies: 'Every business registered under GST as a regular taxpayer files GSTR-3B for each period, even when no tax is due.',
    ifLate:
      'A late fee of Rs 50 a day (Rs 20 a day for a nil return) is charged, capped by turnover, and interest of 18% a year runs on the tax paid late in cash. GSTR-1 for the next period is blocked until it is filed.',
  },
  'gst-gstr-9': {
    about: 'The annual GST return: the year’s sales, purchases, tax paid and credit taken, reconciled with the monthly returns.',
    whyItApplies:
      'Every regular GST taxpayer whose turnover for the year is above Rs 2 crore files it; below that it is optional. A business above Rs 5 crore also files the reconciliation statement GSTR-9C.',
    ifLate:
      'A late fee is charged for each day of delay: Rs 50 a day up to Rs 5 crore of turnover, Rs 100 a day up to Rs 20 crore and Rs 200 a day above that, capped at a small share of the turnover in the state.',
  },
  'mca-dir3-kyc': {
    about: 'The KYC of each director with the MCA: the director’s PAN, address, mobile number and email, confirmed with an OTP.',
    ...DIRECTOR_KYC,
    whyItApplies:
      'Every person who holds a DIN on 31 March files the KYC by 30 September. A director whose details have not changed can confirm them through the web form.',
  },
  'mca-dpt-3': {
    about:
      'The return of deposits: the money the company received as deposits, and the loans and advances it received that are not deposits, outstanding on 31 March.',
    whyItApplies:
      'Every company other than a government company files it each year, including a private company whose only receipts are loans from its directors or shareholders.',
    ifLate:
      'The MCA charges an additional fee for each day of delay, and the company and its officers in default can be fined under the Companies Act.',
  },
  'mca-msme-1-apr': {
    about: 'The half-yearly return of dues to micro and small enterprises for April to September.',
    ...MSME_1,
  },
  'mca-msme-1-oct': {
    about: 'The half-yearly return of dues to micro and small enterprises for October to March.',
    ...MSME_1,
  },
  'mca-aoc-4': {
    about: 'The company’s audited financial statements for the year, with the board’s report and the auditor’s report, filed with the Registrar of Companies.',
    whyItApplies: 'Every company files its financial statements within 30 days of the annual general meeting that adopted them.',
    ifLate:
      'An additional fee of Rs 100 a day is charged until the form is filed, and the company and its officers in default can be fined under the Companies Act.',
  },
  'mca-mgt-7': {
    about:
      'The annual return: the company’s shareholders, directors, meetings and share capital as on the close of the year. Small companies and one-person companies file the shorter MGT-7A.',
    whyItApplies: 'Every company files its annual return within 60 days of the annual general meeting.',
    ifLate:
      'An additional fee of Rs 100 a day is charged until the form is filed, and the company and its officers in default can be fined under the Companies Act.',
  },
  'llp-form-11': {
    about: 'The LLP’s annual return: its partners, their contributions and any changes during the year. The law sets 30 May as the last date.',
    whyItApplies: 'Every LLP files Form 11 within 60 days of the end of the financial year, whatever its turnover.',
    ifLate: 'An additional fee of Rs 100 a day is charged until the form is filed.',
  },
  'llp-form-8': {
    about: 'The LLP’s statement of account and solvency: its accounts for the year and the designated partners’ declaration that it can pay its debts.',
    whyItApplies: 'Every LLP files Form 8 by 30 October after each financial year.',
    ifLate: 'An additional fee of Rs 100 a day is charged until the form is filed.',
  },
  'llp-partner-kyc': {
    about: 'The KYC of each designated partner with the MCA: the partner’s PAN, address, mobile number and email, confirmed with an OTP.',
    ...DIRECTOR_KYC,
    whyItApplies: 'Every designated partner who holds a DIN or DPIN on 31 March files the KYC by 30 September.',
  },
  'labour-pf-payment': {
    about:
      'The monthly electronic challan cum return (ECR) to the EPFO: the wages and the provident fund contributions of each employee for the month, paid in one go.',
    whyItApplies:
      'Every establishment registered with the EPFO, which is compulsory once it has 20 or more employees, files and pays by the 15th of the following month.',
    ifLate:
      'Interest of 12% a year runs on the contributions paid late, and the EPFO can levy damages that grow with the delay. The employer cannot claim the employees’ share as an expense when it is paid after the due date.',
  },
  'labour-esi-return': {
    about:
      'The return of ESI contributions for the contribution period (April to September, or October to March). The contributions themselves are paid each month by the 15th.',
    whyItApplies:
      'Every establishment registered with the ESIC, which is compulsory once it has 10 or more employees in most states, with employees earning up to Rs 21,000 a month.',
    ifLate:
      'Interest of 12% a year runs on contributions paid late, and the ESIC can levy damages that grow with the delay. The employer cannot claim the employees’ share as an expense when it is paid after the due date.',
  },
  'fema-fla': {
    about: 'The annual return on foreign liabilities and assets to the Reserve Bank of India, filed on the RBI’s FLAIR portal from the audited accounts, or the unaudited ones when the audit is not done.',
    whyItApplies:
      'Every Indian company or LLP that received foreign direct investment or made an overseas investment in the previous year or earlier, and still holds it, files the return by 15 July.',
    ifLate:
      'A late return is a contravention of FEMA. The RBI can levy a penalty under FEMA, or the company can settle it by compounding the contravention.',
  },
};

export function obligationText(obligationId: string): ObligationText | null {
  return OBLIGATION_TEXTS[obligationId] ?? null;
}
