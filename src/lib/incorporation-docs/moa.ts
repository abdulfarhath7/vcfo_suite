import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  PRE1_DEFAULT_AUTHORISED_SHARE_CAPITAL,
  PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE,
  PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL,
} from '@/lib/checklist-pre1-validation';
import { formatIndianFigures, formatInrCapitalClause } from '@/lib/board-resolution';
import { registeredOfficeCompleteAddress } from '@/lib/registered-office-responses';
import { pickString, resolveProposedCompanyName } from '@/lib/incorporation-docs/shared';
import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';

/** Best-effort Indian state from a registered-office address string. */
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
  const paid = rupeeDigits(
    pre1.paidUpShareCapital ?? '',
    PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL,
  );
  const nominal = rupeeDigits(
    pre1.nominalValuePerEquityShare ?? '',
    PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE,
  );
  if (nominal <= 0 || paid <= 0) return '';
  return formatIndianFigures(String(Math.floor(paid / nominal)));
}

function formatNominalValuePerShareFigures(raw: string): string {
  const figures = formatIndianFigures(raw);
  return figures === '—' ? '' : figures;
}

/** Share-capital merge values for MOA Clause V from Pre-1 Share Capital Details. */
export function buildMoaClause5Fields(pre1: ChecklistItemResponses): Pick<
  MoaMergeFields,
  | 'AUTHORISED_SHARE_CAPITAL'
  | 'PAID_UP_SHARE_CAPITAL'
  | 'NOMINAL_VALUE_PER_EQUITY_SHARE'
  | 'PAID_UP_EQUITY_SHARES'
  | 'MOA_CLAUSE_5'
> {
  const authCapRaw = pickString(pre1.authorisedShareCapital, PRE1_DEFAULT_AUTHORISED_SHARE_CAPITAL);
  const paidCapRaw = pickString(pre1.paidUpShareCapital, PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL);
  const nominalRaw = pickString(
    pre1.nominalValuePerEquityShare,
    PRE1_DEFAULT_NOMINAL_VALUE_PER_EQUITY_SHARE,
  );

  const authorised = formatInrCapitalClause(authCapRaw);
  const paidUp = formatInrCapitalClause(paidCapRaw);
  const nominalFigures = formatNominalValuePerShareFigures(nominalRaw);
  const shareCount = paidUpEquityShareCountFromPre1(pre1);
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

export function buildMoaMergeFields(input: MoaMergeInput): MoaMergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, pre8 = {}, overrides = {} } = input;

  const registeredAddress = registeredOfficeCompleteAddress(pre6, pre8);
  const fields: MoaMergeFields = {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    MOA_REGISTERED_OFFICE_STATE: pickString(
      registeredOfficeStateFromAddress(registeredAddress),
      '[State of registered office]',
    ),
    MOA_CLAUSE_2: pickString(
      registeredAddress,
      '[Complete address of proposed registered office]',
    ),
    ...buildMoaClause5Fields(pre1),
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
