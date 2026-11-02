/**
 * REGISTRATION RULES — why a registration applies and what it starts (C-500, S-813, S-814).
 *
 * Each registration step id has:
 *  - `why`: the plain reason the registration applies ("The company supplies goods or services
 *    above the GST threshold, or sells across states.");
 *  - `rule`: the law behind it, one short line;
 *  - `questions`: the compliance questionnaire questions (`src/data/compliance-questionnaire.ts`)
 *    whose stored answers say whether it applies for this client (any Yes applies);
 *  - `notNeeded`: the reason shown when the registration is marked not needed;
 *  - `trigger`: the `engagement_compliance_triggers` date the registration sets, when the
 *    compliance calendar starts filings from it;
 *  - `starts`: the obligation ids (`src/lib/compliance/obligations-seed.ts`) it starts.
 * The stored answer and the stored trigger date are read per engagement by
 * `src/db/repositories/registration-applicability.ts`; this file holds only the rules.
 *
 * Pure data: no imports from the database or the UI.
 */

export type RegistrationTrigger =
  | 'gstRegistrationDate'
  | 'pfRegistrationDate'
  | 'esiRegistrationDate'
  | 'ptRegistrationDate'
  | 'tanRegistrationDate';

export interface RegistrationRule {
  why: string;
  rule: string;
  questions?: string[];
  notNeeded: string;
  trigger?: RegistrationTrigger;
  starts: string[];
}

const RULES: Record<string, RegistrationRule> = {
  'reg-1': {
    why: 'The company employs 20 or more people, or registers by choice to give employees provident fund cover.',
    rule: 'Employees’ Provident Funds and Miscellaneous Provisions Act, 1952, section 1(3).',
    questions: ['EMP-03'],
    notNeeded: 'Fewer than 20 employees, and the company has not chosen to register.',
    trigger: 'pfRegistrationDate',
    starts: ['labour-pf-payment'],
  },
  'reg-2': {
    why: 'Every company needs a PAN to file tax returns and a TAN to deduct tax at source.',
    rule: 'Income-tax Act, 1961, sections 139A and 203A.',
    notNeeded: 'PAN and TAN came with the incorporation certificate.',
    trigger: 'tanRegistrationDate',
    starts: ['it-tds-payment', 'it-tds-return-q1', 'it-tds-return-q2', 'it-tds-return-q3', 'it-tds-return-q4', 'it-form-16'],
  },
  'reg-3': {
    why: 'The company employs 10 or more people, some of them on wages under the ESI ceiling.',
    rule: 'Employees’ State Insurance Act, 1948, section 2(12).',
    questions: ['EMP-04'],
    notNeeded: 'Fewer than 10 employees, or no employee under the ESI wage ceiling.',
    trigger: 'esiRegistrationDate',
    starts: ['labour-esi-return'],
  },
  'reg-4': {
    why: 'The company supplies goods or services above the GST threshold, sells across states, or exports.',
    rule: 'CGST Act, 2017, sections 22 and 24.',
    questions: ['GST-01'],
    notNeeded: 'Turnover stays under the threshold and no supply needs GST registration.',
    trigger: 'gstRegistrationDate',
    starts: ['gst-gstr-1', 'gst-gstr-3b', 'gst-gstr-9'],
  },
  'reg-5': {
    why: 'The company exports goods or services without paying IGST, which needs a Letter of Undertaking each year.',
    rule: 'CGST Rules, 2017, rule 96A.',
    questions: ['GST-05'],
    notNeeded: 'No exports or SEZ supplies under GST.',
    starts: [],
  },
  'reg-6': {
    why: 'Banks ask for an LEI before large payments, borrowings or foreign exchange deals.',
    rule: 'RBI directions on the Legal Entity Identifier.',
    notNeeded: 'No bank or foreign exchange deal needs an LEI yet.',
    starts: [],
  },
  'reg-7': {
    why: 'The company pays salaries in a state that levies professional tax.',
    rule: 'The state’s Professional Tax Act.',
    questions: ['EMP-05'],
    notNeeded: 'The state does not levy professional tax, or no salaries are paid there.',
    trigger: 'ptRegistrationDate',
    starts: [],
  },
  'reg-8': {
    why: 'The company imports or exports goods or services.',
    rule: 'Foreign Trade (Development and Regulation) Act, 1992, section 7.',
    questions: ['FT-01', 'FT-02', 'FT-03'],
    notNeeded: 'No imports or exports.',
    starts: [],
  },
  'reg-9': {
    why: 'The company runs an office or shop in a state that registers establishments.',
    rule: 'The state’s Shops and Establishments Act.',
    questions: ['EMP-07'],
    notNeeded: 'No office or shop in a state that requires it.',
    starts: [],
  },
  'reg-10': {
    why: 'The company trades from premises inside a municipal area that licenses trades.',
    rule: 'The municipal corporation’s trade licence rules.',
    notNeeded: 'No trade carried on from licensed premises.',
    starts: [],
  },
  'reg-11': {
    why: 'The company exports software services and reports them outside STPI.',
    rule: 'Foreign Exchange Management (Export of Goods and Services) Regulations, 2015.',
    questions: ['FT-03'],
    notNeeded: 'No software services exported.',
    starts: [],
  },
  'reg-12': {
    why: 'The company wants to protect its name or logo as a trademark.',
    rule: 'Trade Marks Act, 1999, section 18.',
    notNeeded: 'No mark to register.',
    starts: [],
  },
  'reg-13': {
    why: 'The company engages 20 or more contract workers.',
    rule: 'Contract Labour (Regulation and Abolition) Act, 1970, section 7.',
    notNeeded: 'Fewer than 20 contract workers.',
    starts: [],
  },
  'reg-14': {
    why: 'The company has 10 or more employees and must form an internal committee.',
    rule: 'Sexual Harassment of Women at Workplace Act, 2013, section 4.',
    notNeeded: 'Fewer than 10 employees.',
    starts: [],
  },
  'reg-15': {
    why: 'The company qualifies as a micro, small or medium enterprise and wants Udyam benefits.',
    rule: 'MSMED Act, 2006, section 8.',
    questions: ['MSME-01'],
    notNeeded: 'The company does not qualify or does not want Udyam registration.',
    starts: ['mca-msme-1-apr', 'mca-msme-1-oct'],
  },
  'reg-16': {
    why: 'The company clears goods through customs and files shipping bills or bills of entry.',
    rule: 'Customs Act, 1962, and the ICEGATE registration rules.',
    questions: ['FT-01', 'FT-02'],
    notNeeded: 'No goods cleared through customs.',
    starts: [],
  },
  'reg-17': {
    why: 'A registered trademark lapses after ten years unless renewed.',
    rule: 'Trade Marks Act, 1999, section 25.',
    notNeeded: 'No registered mark is due for renewal.',
    starts: [],
  },
  'reg-18': {
    why: 'The company wants to protect an invention.',
    rule: 'Patents Act, 1970, section 7.',
    notNeeded: 'No invention to file.',
    starts: [],
  },
  'reg-19': {
    why: 'The company needs the registration its industry regulator asks for.',
    rule: 'The regulator’s registration rules.',
    notNeeded: 'No regulator asks for it.',
    starts: [],
  },
  'reg-20': {
    why: 'The company issued shares to a person resident outside India.',
    rule: 'FEMA (Non-debt Instruments) Rules, 2019, and the RBI reporting directions.',
    questions: ['FI-02'],
    notNeeded: 'No shares issued to a foreign investor.',
    starts: [],
  },
  'reg-21': {
    why: 'The company received foreign direct investment.',
    rule: 'FEMA (Mode of Payment and Reporting of Non-Debt Instruments) Regulations, 2019.',
    questions: ['FI-01'],
    notNeeded: 'No foreign direct investment.',
    starts: ['fema-fla'],
  },
  'reg-22': {
    why: 'The company invested in an entity outside India.',
    rule: 'FEMA (Overseas Investment) Rules, 2022.',
    questions: ['FI-05'],
    notNeeded: 'No overseas investment.',
    starts: [],
  },
  'reg-23': {
    why: 'The company holds foreign assets or liabilities at 31 March.',
    rule: 'FEMA, the RBI master direction on reporting, Annual Return on Foreign Liabilities and Assets.',
    questions: ['FI-04'],
    notNeeded: 'No foreign assets or liabilities.',
    starts: ['fema-fla'],
  },
  'reg-24': {
    why: 'Shares moved between a resident and a person resident outside India.',
    rule: 'FEMA (Non-debt Instruments) Rules, 2019, rule 9.',
    questions: ['FI-03'],
    notNeeded: 'No share transfers between residents and non-residents.',
    starts: [],
  },
};

/** The rule of a registration step, or null for a step without one. */
export function registrationRule(stepId: string): RegistrationRule | null {
  return RULES[stepId] ?? null;
}

/** Every step id that has a rule. */
export const RULED_REGISTRATIONS = Object.keys(RULES);
