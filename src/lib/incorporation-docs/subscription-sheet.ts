import { formatInrCapitalClause } from '@/lib/board-resolution';
import { PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL } from '@/lib/checklist-pre1-validation';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  directorField,
  directorOccupationLabel,
  formatDob,
  nationalityFromAddress,
  pickString,
} from '@/lib/incorporation-docs/shared';
import {
  paidUpEquityShareCountFromPre1,
} from '@/lib/incorporation-docs/moa';
import {
  resolveParentEntityAddress,
  resolveParentEntityName,
} from '@/lib/incorporation-docs/parent-entity';
import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import { resolvePre6DirectorDisplayName } from '@/lib/person-name';

export type SubscriptionSheetVariant = 'foreign' | 'resident';

export interface SubscriptionSheetMergeFields {
  PARENT_ENTITY_NAME: string;
  PARENT_ENTITY_ADDRESS: string;
  SUBSCRIPTION_DATE: string;
  SUBSCRIBER_FULL_NAME: string;
  SUBSCRIBER_FATHER_NAME: string;
  SUBSCRIBER_ADDRESS: string;
  SUBSCRIBER_DOB: string;
  SUBSCRIBER_OCCUPATION: string;
  SUBSCRIBER_NATIONALITY: string;
  EQUITY_SHARES_SUBSCRIBED: string;
  WITNESS_NAME_AND_ADDRESS: string;
}

export const SUBSCRIPTION_SHEET_MERGE_FIELD_KEYS = [
  'PARENT_ENTITY_NAME',
  'PARENT_ENTITY_ADDRESS',
  'SUBSCRIPTION_DATE',
  'SUBSCRIBER_FULL_NAME',
  'SUBSCRIBER_FATHER_NAME',
  'SUBSCRIBER_ADDRESS',
  'SUBSCRIBER_DOB',
  'SUBSCRIBER_OCCUPATION',
  'SUBSCRIBER_NATIONALITY',
  'EQUITY_SHARES_SUBSCRIBED',
] as const satisfies readonly (keyof SubscriptionSheetMergeFields)[];

function formatSubscriptionDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function formatSubscriberDob(iso: string | undefined): string {
  const trimmed = (iso ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed || '—';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function equitySharesSubscribedLabel(pre1: ChecklistItemResponses): string {
  const count = paidUpEquityShareCountFromPre1(pre1);
  if (!count) return '[Number of shares subscribed]';
  const paid = pickString(pre1.paidUpShareCapital, PRE1_DEFAULT_PAID_UP_SHARE_CAPITAL);
  const clause = formatInrCapitalClause(paid);
  const words = clause.includes('(') ? clause.slice(clause.indexOf('(')).trim() : '';
  return words ? `${count} ${words}` : count;
}

export function subscriptionSheetVariantForDoc(
  doc: 'moa-subscription-sheet' | 'aoa-subscription-sheet',
): SubscriptionSheetVariant {
  void doc;
  return 'foreign';
}

export function buildSubscriptionSheetMergeFields(
  input: IncorpMergeInput & {
    variant?: SubscriptionSheetVariant;
    overrides?: Partial<SubscriptionSheetMergeFields>;
  },
): SubscriptionSheetMergeFields {
  const { engagement, pre1 = {}, pre6 = {}, variant = 'foreign', overrides = {} } = input;
  const now = new Date();
  const subscriberDirector = variant === 'resident' ? 'resident' : 'non-resident';

  const subscriberName = pickString(
    resolvePre6DirectorDisplayName(pre6, subscriberDirector),
    '[Subscriber name]',
  );
  const subscriberAddress = pickString(
    directorField(pre6, subscriberDirector, 'UtilityBillAddress'),
    '[Subscriber address]',
  );

  const witnessName =
    variant === 'resident'
      ? pickString(resolvePre6DirectorDisplayName(pre6, 'non-resident'), '')
      : '';
  const witnessAddress =
    variant === 'resident'
      ? pickString(directorField(pre6, 'non-resident', 'UtilityBillAddress'), '')
      : '';

  const fields: SubscriptionSheetMergeFields = {
    PARENT_ENTITY_NAME: resolveParentEntityName(pre1, engagement),
    PARENT_ENTITY_ADDRESS: resolveParentEntityAddress(pre1, engagement),
    SUBSCRIPTION_DATE: formatSubscriptionDate(now),
    SUBSCRIBER_FULL_NAME: subscriberName,
    SUBSCRIBER_FATHER_NAME: pickString(
      directorField(pre6, subscriberDirector, 'FatherName'),
      "[Father's name]",
    ),
    SUBSCRIBER_ADDRESS:
      variant === 'foreign' && directorField(pre6, 'non-resident', 'FatherName')
        ? `C/o ${directorField(pre6, 'non-resident', 'FatherName')}, ${subscriberAddress}`
        : subscriberAddress,
    SUBSCRIBER_DOB: formatSubscriberDob(directorField(pre6, subscriberDirector, 'Dob')),
    SUBSCRIBER_OCCUPATION: directorOccupationLabel(pre6, subscriberDirector),
    SUBSCRIBER_NATIONALITY:
      variant === 'resident'
        ? 'India'
        : nationalityFromAddress(subscriberAddress),
    EQUITY_SHARES_SUBSCRIBED: equitySharesSubscribedLabel(pre1),
    WITNESS_NAME_AND_ADDRESS:
      witnessName && witnessAddress
        ? `${witnessName} Address: ${witnessAddress}`
        : witnessName || witnessAddress || '',
  };

  return { ...fields, ...overrides };
}

export function collectSubscriptionSheetMissingFields(
  input: IncorpMergeInput,
  variant: SubscriptionSheetVariant = 'foreign',
): string[] {
  const missing: string[] = [];
  const pre1 = input.pre1 ?? {};
  const pre6 = input.pre6 ?? {};
  const director = variant === 'resident' ? 'resident' : 'non-resident';
  const label = variant === 'resident' ? 'Resident director' : 'Non-resident director';

  if (!resolveParentEntityName(pre1, input.engagement).trim() || resolveParentEntityName(pre1, input.engagement).startsWith('[')) {
    missing.push('Parent entity name (Pre-1)');
  }
  if (!resolveParentEntityAddress(pre1, input.engagement).trim() || resolveParentEntityAddress(pre1, input.engagement).startsWith('[')) {
    missing.push('Parent entity address (Pre-1)');
  }
  if (!directorField(pre6, director, 'FullName')) {
    missing.push(`${label} — full name (Pre-6)`);
  }
  if (!directorField(pre6, director, 'FatherName')) {
    missing.push(`${label} — father's name (Pre-6)`);
  }
  if (!directorField(pre6, director, 'UtilityBillAddress')) {
    missing.push(`${label} — utility bill address (Pre-6)`);
  }
  if (!directorField(pre6, director, 'Dob')) {
    missing.push(`${label} — date of birth (Pre-6)`);
  }
  if (!pre1.paidUpShareCapital?.trim()) {
    missing.push('Initial Paid-up Share Capital (Pre-1)');
  }

  return missing;
}
