import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  PRE1_DEFAULT_AUTHORISED_SHARE_CAPITAL,
  PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE,
  PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL,
} from '@/lib/checklist-pre1-validation';
import { formatIndianFigures, formatInrCapitalClause } from '@/lib/board-resolution';
import {
  REGISTERED_OFFICE_STATE_FIELD_ID,
  registeredOfficeCompleteAddress,
  resolveRegisteredOfficeResponses,
} from '@/lib/registered-office-responses';
import { pickString, resolveProposedCompanyName } from '@/lib/incorporation-docs/shared';
import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';

/** Legacy fallback only: a guess at the state from a registered-office address string. */
function registeredOfficeStateFromAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(',').flatMap((p) => {
    const part = p.trim();
    return part ? [part] : [];
  });
  if (parts.length >= 2) {
    const beforeCountry = parts[parts.length - 1]?.match(/india/i)
      ? parts[parts.length - 2]
      : parts[parts.length - 1];
    if (beforeCountry && !/^\d{5,6}$/.test(beforeCountry)) return beforeCountry;
  }
  return trimmed;
}

export interface MoaMergeFields {
  PROPOSED_COMPANY_NAME: string;
  /** State for Memorandum Clause II (Situation of Registered Office). */
  MOA_REGISTERED_OFFICE_STATE: string;
  /** Full registered office address (legacy / optional templates). */
  MOA_CLAUSE_2: string;
  /** Clause V (share capital) — authorised amount with figures and words. */
  AUTHORISED_SHARE_CAPITAL: string;
  /** Clause V — initial paid-up capital with figures and words. */
  PAID_UP_SHARE_CAPITAL: string;
  /** Clause V — face value per equity share (figures, e.g. 10). */
  NOMINAL_VALUE_PER_EQUITY_SHARE: string;
  /** Clause V — number of equity shares at subscription (paid-up ÷ nominal). */
  PAID_UP_EQUITY_SHARES: string;
  /** Full Clause V paragraph for templates with a single merge region on the last page. */
  MOA_CLAUSE_5: string;
}

export const MOA_MERGE_FIELD_KEYS = [
  'PROPOSED_COMPANY_NAME',
  'MOA_REGISTERED_OFFICE_STATE',
  'MOA_CLAUSE_2',
  'AUTHORISED_SHARE_CAPITAL',
  'PAID_UP_SHARE_CAPITAL',
  'NOMINAL_VALUE_PER_EQUITY_SHARE',
  'PAID_UP_EQUITY_SHARES',
  'MOA_CLAUSE_5',
] as const satisfies readonly (keyof MoaMergeFields)[];

export type MoaMergeInput = IncorpMergeInput & {
  /** Legacy Pre-8 responses when registered office fields were stored on execution step. */
  pre8?: ChecklistItemResponses;
  overrides?: Partial<MoaMergeFields>;
};

function rupeeDigits(raw: string, fallback: string): number {
  const digits = pickString(raw, fallback).replace(/\D/g, '');
  const n = Number.parseInt(digits, 10);
  const fallbackDigits = fallback.replace(/\D/g, '');
  const fallbackN = Number.parseInt(fallbackDigits, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return Number.isFinite(fallbackN) && fallbackN > 0 ? fallbackN : 0;
}

/** Equity shares subscribed at incorporation (paid-up capital ÷ nominal value per share). */
export function paidUpEquityShareCountFromPre1(pre1: ChecklistItemResponses): string {
  const count = paidUpEquityShareNumberFromPre1(pre1);
  return count > 0 ? formatIndianFigures(String(count)) : '';
}

function paidUpEquityShareNumberFromPre1(pre1: ChecklistItemResponses): number {
  const paid = rupeeDigits(
    pre1.paidUpShareCapital ?? '',
    PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL,
  );
  const nominal = rupeeDigits(
    pre1.nominalValuePerEquityShare ?? '',
    PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE,
  );
  if (nominal <= 0 || paid <= 0) return 0;
  return Math.floor(paid / nominal);
}

const WHOLE_NUMBER_RE = /^\d+$/;
const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

function positiveWhole(raw: string | undefined): number {
  const v = (raw ?? '').replace(/,/g, '').trim();
  if (!WHOLE_NUMBER_RE.test(v)) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Equity shares issued at incorporation and their nominal value: the
 * `pre-13` capital structure when it lists equity shares, else Part A's
 * paid-up capital ÷ nominal value (the only source before `pre-13`).
 */
export function equityShareStructure(
  pre1: ChecklistItemResponses,
  pre13: ChecklistItemResponses = {},
): { count: number; nominal: string; source: 'pre-13' | 'pre-1' } {
  const pre1Nominal = pickString(pre1.nominalValuePerEquityShare, PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE);
  if ((pre13.equityShares ?? '').trim() === 'yes') {
    const count = positiveWhole(pre13.equityQuantity);
    if (count > 0) {
      const nominal = (pre13.equityNominalValue ?? '').replace(/,/g, '').trim();
      return { count, nominal: DECIMAL_RE.test(nominal) && Number(nominal) > 0 ? nominal : pre1Nominal, source: 'pre-13' };
    }
  }
  return { count: paidUpEquityShareNumberFromPre1(pre1), nominal: pre1Nominal, source: 'pre-1' };
}

/** Formatted equity share count for Clause V and the subscription sheets. */
export function paidUpEquityShareCount(
  pre1: ChecklistItemResponses,
  pre13: ChecklistItemResponses = {},
): string {
  const { count } = equityShareStructure(pre1, pre13);
  return count > 0 ? formatIndianFigures(String(count)) : '';
}

function formatNominalValuePerShareFigures(raw: string): string {
  const figures = formatIndianFigures(raw);
  return figures === '—' ? '' : figures;
}

/** Share-capital merge values for MOA Clause V: amounts from Part A, shares from `pre-13` when answered. */
export function buildMoaClause5Fields(
  pre1: ChecklistItemResponses,
  pre13: ChecklistItemResponses = {},
): Pick<
  MoaMergeFields,
  | 'AUTHORISED_SHARE_CAPITAL'
  | 'PAID_UP_SHARE_CAPITAL'
  | 'NOMINAL_VALUE_PER_EQUITY_SHARE'
  | 'PAID_UP_EQUITY_SHARES'
  | 'MOA_CLAUSE_5'
> {
  const authCapRaw = pickString(pre1.authorisedShareCapital, PRE1_DEFAULT_AUTHORISED_SHARE_CAPITAL);
  const paidCapRaw = pickString(pre1.paidUpShareCapital, PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL);
  const { nominal: nominalRaw } = equityShareStructure(pre1, pre13);

  const authorised = formatInrCapitalClause(authCapRaw);
  const paidUp = formatInrCapitalClause(paidCapRaw);
  const nominalFigures = formatNominalValuePerShareFigures(nominalRaw);
  const shareCount = paidUpEquityShareCount(pre1, pre13);
  const nominalLabel = nominalFigures ? `INR ${nominalFigures}` : '[Nominal value per share]';

  const MOA_CLAUSE_5 = [
    `The share capital of the company is ${authorised}`,
    `divided into ${shareCount || '[Number of shares]'} equity shares of ${nominalLabel} each`,
    `with an initial paid-up share capital of ${paidUp}.`,
  ].join(' ');

  return {
    AUTHORISED_SHARE_CAPITAL: authorised,
    PAID_UP_SHARE_CAPITAL: paidUp,
    NOMINAL_VALUE_PER_EQUITY_SHARE: nominalFigures,
    PAID_UP_EQUITY_SHARES: shareCount,
    MOA_CLAUSE_5,
  };
}

/** Clause II state: the `pre-14` answer; the address guess stays only for older engagements. */
export function registeredOfficeState(
  pre6: ChecklistItemResponses,
  pre8: ChecklistItemResponses = {},
): string {
  return (resolveRegisteredOfficeResponses(pre6, pre8)[REGISTERED_OFFICE_STATE_FIELD_ID] ?? '').trim();
}

export function buildMoaMergeFields(input: MoaMergeInput): MoaMergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, pre8 = {}, pre13 = {}, overrides = {} } = input;

  const registeredAddress = registeredOfficeCompleteAddress(pre6, pre8);
  const fields: MoaMergeFields = {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    MOA_REGISTERED_OFFICE_STATE: pickString(
      registeredOfficeState(pre6, pre8),
      registeredOfficeStateFromAddress(registeredAddress),
      '[State of registered office]',
    ),
    MOA_CLAUSE_2: pickString(
      registeredAddress,
      '[Complete address of proposed registered office]',
    ),
    ...buildMoaClause5Fields(pre1, pre13),
  };

  return { ...fields, ...overrides };
}

export function collectMoaMissingFields(input: MoaMergeInput): string[] {
  const missing: string[] = [];
  const pre1 = input.pre1 ?? {};

  const companyName = resolveProposedCompanyName(input.pre5 ?? {}, pre1, input.engagement);
  if (!companyName || companyName.startsWith('[')) {
    missing.push('Approved company name (Pre-5) or proposed name (Pre-1)');
  }

  const address = registeredOfficeCompleteAddress(input.pre6 ?? {}, input.pre8 ?? {});
  if (!address) {
    missing.push('Complete address of proposed registered office (Pre-6)');
  }
  if (!registeredOfficeState(input.pre6 ?? {}, input.pre8 ?? {})) {
    missing.push('State / union territory of the registered office (Pre-14)');
  }

  if (!pre1.authorisedShareCapital?.trim()) {
    missing.push('Authorized Share Capital (Pre-1)');
  }
  if (!pre1.paidUpShareCapital?.trim()) {
    missing.push('Initial Paid-up Share Capital (Pre-1)');
  }
  if (!pre1.nominalValuePerEquityShare?.trim()) {
    missing.push('Nominal Value of Each Equity Share (Pre-1)');
  }

  return missing;
}
