import { getItem } from '@/data/checklist';
import { formatShareCountClause } from '@/lib/board-resolution';
import { parsePre1BoardResolutionDate } from '@/lib/checklist-pre1-validation';
import { getClientResponseFields, type ChecklistItemResponses } from '@/lib/checklist-responses';
import { isRepeatField, repeatEntries, type RepeatEntry } from '@/lib/checklist-repeat';
import {
  directorAudienceKind,
  directorAudiencesFromPre6,
  type IncorpDirectorAudience,
} from '@/lib/incorporation-docs/audiences';
import {
  directorField,
  directorNationalityLabel,
  directorNationalityOrAddressCountry,
  directorOccupationLabel,
  pickString,
  relationOf,
  signingDate,
} from '@/lib/incorporation-docs/shared';
import { equityShareStructure } from '@/lib/incorporation-docs/moa';
import {
  resolveParentEntityAddress,
  resolveParentEntityName,
} from '@/lib/incorporation-docs/parent-entity';
import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';

/**
 * INC-33 / INC-34 SUBSCRIPTION SHEETS.
 *
 * Two layouts, chosen from who subscribes (`pre-16` Subscriber details):
 *
 * - `foreign` — the body-corporate layout: a company (the parent, or a
 *   body corporate / LLP listed on `pre-16`) subscribing through an
 *   authorised representative whose personal details follow.
 * - `resident` — the individual layout: one row per individual subscriber,
 *   each a proposed director whose `pre-15` KYC fills the row.
 *
 * With no `pre-16` subscribers a subsidiary keeps the historical foreign
 * sheet (the parent takes the shares); an independent company has no parent,
 * so it must list its subscribers first.
 */
export type SubscriptionSheetVariant = 'foreign' | 'resident';

export const SUBSCRIBER_DETAILS_STEP_ID = 'pre-16';
const SUBSCRIBERS_GROUP_ID = 'subscribers';

/** Pre-7 ids for the witness who signs "Signed before me" on both sheets. */
export const SUBSCRIPTION_WITNESS_FIELDS = {
  name: 'subscriptionWitnessName',
  address: 'subscriptionWitnessAddress',
  occupation: 'subscriptionWitnessOccupation',
  membershipNumber: 'subscriptionWitnessMembershipNumber',
} as const;

export const SUBSCRIPTION_SHEET_TEMPLATES: Record<SubscriptionSheetVariant, string> = {
  foreign: 'public/templates/moa-aoa-subscription-sheet-foreign.docx',
  resident: 'public/templates/moa-aoa-subscription-sheet-resident.docx',
};

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
  /** Page 1 "TOTAL NO. OF SHARES TAKEN" — every share on this sheet. */
  TOTAL_SHARES_TAKEN: string;
  WITNESS_NAME: string;
  WITNESS_ADDRESS: string;
  WITNESS_OCCUPATION: string;
  /** "Membership No. 123456", or blank when none was given. */
  WITNESS_MEMBERSHIP: string;
  /** Name and address on one line (kept for callers of the old computed field). */
  WITNESS_NAME_AND_ADDRESS: string;
  /** Resident layout: one table row per individual subscriber. */
  SUBSCRIBERS: SubscriptionSheetSubscriberRow[];
}

export interface SubscriptionSheetSubscriberRow {
  SL_NO: string;
  SUBSCRIBER_FULL_NAME: string;
  /** Parent name when this individual is the INC-35 nominee; blank otherwise. */
  NOMINEE_OF: string;
  /** "S/o" or "D/o". */
  SUBSCRIBER_RELATION: string;
  SUBSCRIBER_FATHER_NAME: string;
  SUBSCRIBER_ADDRESS: string;
  SUBSCRIBER_DOB: string;
  SUBSCRIBER_OCCUPATION: string;
  SUBSCRIBER_NATIONALITY: string;
  EQUITY_SHARES_SUBSCRIBED: string;
}

const WITNESS_KEYS = ['WITNESS_NAME', 'WITNESS_ADDRESS', 'WITNESS_OCCUPATION', 'WITNESS_MEMBERSHIP'] as const;

/** Tags in `moa-aoa-subscription-sheet-foreign.docx`. */
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
  'TOTAL_SHARES_TAKEN',
  ...WITNESS_KEYS,
] as const satisfies readonly (keyof SubscriptionSheetMergeFields)[];

/** Scalar tags in `moa-aoa-subscription-sheet-resident.docx` (rows come from `SUBSCRIBERS`). */
export const RESIDENT_SUBSCRIPTION_SHEET_MERGE_FIELD_KEYS = [
  'TOTAL_SHARES_TAKEN',
  ...WITNESS_KEYS,
] as const satisfies readonly (keyof SubscriptionSheetMergeFields)[];

export const RESIDENT_SUBSCRIPTION_SHEET_LOOP_KEYS = ['SUBSCRIBERS'] as const satisfies readonly (keyof SubscriptionSheetMergeFields)[];

/** Row tags inside the `SUBSCRIBERS` loop. */
export const SUBSCRIPTION_SHEET_ROW_KEYS = [
  'SL_NO',
  'SUBSCRIBER_FULL_NAME',
  'NOMINEE_OF',
  'SUBSCRIBER_RELATION',
  'SUBSCRIBER_FATHER_NAME',
  'SUBSCRIBER_ADDRESS',
  'SUBSCRIBER_DOB',
  'SUBSCRIBER_OCCUPATION',
  'SUBSCRIBER_NATIONALITY',
  'EQUITY_SHARES_SUBSCRIBED',
] as const satisfies readonly (keyof SubscriptionSheetSubscriberRow)[];

// ---------------------------------------------------------------------------
// Who subscribes
// ---------------------------------------------------------------------------

export interface PlannedIndividual {
  /** 1-based position on `pre-16`. */
  entryIndex: number;
  name: string;
  /** The proposed director this subscriber is, matched by name; null when none. */
  audience: IncorpDirectorAudience | null;
  shares: number;
}

export interface SubscriptionPlan {
  variant: SubscriptionSheetVariant;
  /** Foreign layout: the subscribing company. */
  corporate: {
    name: string;
    address: string;
    shares: number;
    /** 1-based `pre-16` position; null when it is the Part A parent. */
    entryIndex: number | null;
  } | null;
  /** Foreign layout: the director whose details fill the representative block. */
  representative: IncorpDirectorAudience;
  /** Resident layout rows, in `pre-16` order. */
  individuals: PlannedIndividual[];
  /** Shares printed as the sheet's total. */
  totalShares: number;
}

function subscriberEntries(pre16: ChecklistItemResponses | undefined): RepeatEntry[] {
  if (!pre16) return [];
  const item = getItem(SUBSCRIBER_DETAILS_STEP_ID);
  const group = item ? getClientResponseFields(item).find((f) => f.id === SUBSCRIBERS_GROUP_ID) : undefined;
  return group && isRepeatField(group) ? repeatEntries(pre16, group) : [];
}

function wholeShares(raw: string | undefined): number {
  const v = (raw ?? '').replace(/,/g, '').trim();
  if (!/^\d+$/.test(v)) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The director audience whose name matches `name` (full name, or first + last). */
function directorByName(pre6: ChecklistItemResponses, name: string): IncorpDirectorAudience | null {
  const key = nameKey(name);
  if (!key) return null;
  for (const audience of directorAudiencesFromPre6(pre6)) {
    const full = directorField(pre6, audience, 'FullName');
    const short = [directorField(pre6, audience, 'FirstName'), directorField(pre6, audience, 'LastName')]
      .filter(Boolean)
      .join(' ');
    if ((full && nameKey(full) === key) || (short && nameKey(short) === key)) return audience;
  }
  return null;
}

export function planSubscription(input: IncorpMergeInput): SubscriptionPlan {
  const { pre1 = {}, pre6 = {}, pre13 = {}, pre16, engagement } = input;
  const entries = subscriberEntries(pre16);
  const { count: equityShares } = equityShareStructure(pre1, pre13);
  const independent = engagement?.ownershipType === 'independent';

  const corporateEntry = entries.find((e) => (e.values.type ?? '').trim() === 'non-individual');
  if (corporateEntry || (entries.length === 0 && !independent)) {
    const v = corporateEntry?.values ?? {};
    const byName = v.authorisedPerson?.trim() ? directorByName(pre6, v.authorisedPerson) : null;
    return {
      variant: 'foreign',
      corporate: {
        name: pickString(v.name, resolveParentEntityName(pre1, engagement)),
        address: pickString(v.address, resolveParentEntityAddress(pre1, engagement)),
        shares: corporateEntry ? wholeShares(v.shares) : equityShares,
        entryIndex: corporateEntry?.index ?? null,
      },
      representative: byName ?? 'non-resident',
      individuals: [],
      totalShares: corporateEntry ? wholeShares(v.shares) : equityShares,
    };
  }

  const individuals: PlannedIndividual[] = entries
    .filter((e) => (e.values.type ?? '').trim() === 'individual')
    .map((e) => ({
      entryIndex: e.index,
      name: (e.values.name ?? '').trim(),
      audience: directorByName(pre6, e.values.name ?? ''),
      shares: wholeShares(e.values.shares),
    }));
  return {
    variant: 'resident',
    corporate: null,
    representative: 'non-resident',
    individuals,
    totalShares: individuals.reduce((sum, i) => sum + i.shares, 0),
  };
}

/** Which template a sheet renders with; without engagement data, the historical foreign sheet. */
export function subscriptionSheetVariantForDoc(
  doc: 'moa-subscription-sheet' | 'aoa-subscription-sheet',
  input?: IncorpMergeInput,
): SubscriptionSheetVariant {
  void doc;
  return input ? planSubscription(input).variant : 'foreign';
}

// ---------------------------------------------------------------------------
// Merge fields
// ---------------------------------------------------------------------------

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

function sharesLabel(count: number): string {
  return formatShareCountClause(count) || '[Number of shares subscribed]';
}

/** "C/o {father}, {address}" as on the firm's samples. */
function careOfAddress(pre6: ChecklistItemResponses, audience: IncorpDirectorAudience): string {
  const address = pickString(directorField(pre6, audience, 'UtilityBillAddress'), '[Subscriber address]');
  const father = directorField(pre6, audience, 'FatherName');
  return father ? `C/o ${father}, ${address}` : address;
}

function nationalityFor(pre6: ChecklistItemResponses, audience: IncorpDirectorAudience): string {
  return directorAudienceKind(audience) === 'resident'
    ? directorNationalityLabel(pre6, audience)
    : directorNationalityOrAddressCountry(pre6, audience);
}

function witnessFields(pre7: ChecklistItemResponses = {}) {
  const name = (pre7[SUBSCRIPTION_WITNESS_FIELDS.name] ?? '').trim();
  const address = (pre7[SUBSCRIPTION_WITNESS_FIELDS.address] ?? '').trim();
  const membership = (pre7[SUBSCRIPTION_WITNESS_FIELDS.membershipNumber] ?? '').trim();
  return {
    WITNESS_NAME: name,
    WITNESS_ADDRESS: address,
    WITNESS_OCCUPATION: (pre7[SUBSCRIPTION_WITNESS_FIELDS.occupation] ?? '').trim(),
    WITNESS_MEMBERSHIP: membership ? `Membership No. ${membership}` : '',
    WITNESS_NAME_AND_ADDRESS: name && address ? `${name} Address: ${address}` : name || address,
  };
}

function subscriberRow(
  input: IncorpMergeInput,
  individual: PlannedIndividual,
  position: number,
): SubscriptionSheetSubscriberRow {
  const { pre1 = {}, pre6 = {}, pre16 = {}, engagement } = input;
  const a = individual.audience;
  const nominee = (pre16.shareholderNominee ?? '').trim();
  const isNominee =
    engagement?.ownershipType !== 'independent' && nominee !== '' && nameKey(nominee) === nameKey(individual.name);
  return {
    SL_NO: String(position),
    SUBSCRIBER_FULL_NAME: pickString(a ? directorField(pre6, a, 'FullName') : '', individual.name, '[Subscriber name]'),
    NOMINEE_OF: isNominee ? resolveParentEntityName(pre1, engagement) : '',
    SUBSCRIBER_RELATION: a && relationOf(pre6, a) === 'daughter of' ? 'D/o' : 'S/o',
    SUBSCRIBER_FATHER_NAME: pickString(a ? directorField(pre6, a, 'FatherName') : '', "[Father's name]"),
    SUBSCRIBER_ADDRESS: a ? careOfAddress(pre6, a) : '[Subscriber address]',
    SUBSCRIBER_DOB: formatSubscriberDob(a ? directorField(pre6, a, 'Dob') : ''),
    SUBSCRIBER_OCCUPATION: a ? directorOccupationLabel(pre6, a) : '[Occupation]',
    SUBSCRIBER_NATIONALITY: a ? nationalityFor(pre6, a) : '[Nationality]',
    EQUITY_SHARES_SUBSCRIBED: sharesLabel(individual.shares),
  };
}

export function buildSubscriptionSheetMergeFields(
  input: IncorpMergeInput & {
    /** Ignored: the layout follows `planSubscription`. Kept for older callers. */
    variant?: SubscriptionSheetVariant;
    overrides?: Partial<SubscriptionSheetMergeFields>;
  },
): SubscriptionSheetMergeFields {
  const { pre1 = {}, pre6 = {}, overrides = {} } = input;
  const plan = planSubscription(input);
  const witness = witnessFields(input.pre7);

  if (plan.variant === 'resident') {
    const rows = plan.individuals.map((individual, i) => subscriberRow(input, individual, i + 1));
    const first = rows[0];
    return {
      PARENT_ENTITY_NAME: '',
      PARENT_ENTITY_ADDRESS: '',
      SUBSCRIPTION_DATE: formatSubscriptionDate(signingDate(input)),
      SUBSCRIBER_FULL_NAME: first?.SUBSCRIBER_FULL_NAME ?? '[Subscriber name]',
      SUBSCRIBER_FATHER_NAME: first?.SUBSCRIBER_FATHER_NAME ?? "[Father's name]",
      SUBSCRIBER_ADDRESS: first?.SUBSCRIBER_ADDRESS ?? '[Subscriber address]',
      SUBSCRIBER_DOB: first?.SUBSCRIBER_DOB ?? '—',
      SUBSCRIBER_OCCUPATION: first?.SUBSCRIBER_OCCUPATION ?? '[Occupation]',
      SUBSCRIBER_NATIONALITY: first?.SUBSCRIBER_NATIONALITY ?? '[Nationality]',
      EQUITY_SHARES_SUBSCRIBED: first?.EQUITY_SHARES_SUBSCRIBED ?? sharesLabel(0),
      TOTAL_SHARES_TAKEN: sharesLabel(plan.totalShares),
      ...witness,
      SUBSCRIBERS: rows,
      ...overrides,
    };
  }

  const rep = plan.representative;
  const corporate = plan.corporate!;
  // "Represented … vide resolution dated": the parent's board resolution when
  // the parent subscribes; the signing date otherwise (no other resolution is asked).
  const resolutionDate =
    (corporate.entryIndex === null ? parsePre1BoardResolutionDate(pre1.boardResolutionDate) : null) ??
    signingDate(input);

  const fields: SubscriptionSheetMergeFields = {
    PARENT_ENTITY_NAME: corporate.name,
    PARENT_ENTITY_ADDRESS: corporate.address,
    SUBSCRIPTION_DATE: formatSubscriptionDate(resolutionDate),
    SUBSCRIBER_FULL_NAME: pickString(directorField(pre6, rep, 'FullName'), '[Subscriber name]'),
    SUBSCRIBER_FATHER_NAME: pickString(directorField(pre6, rep, 'FatherName'), "[Father's name]"),
    SUBSCRIBER_ADDRESS: careOfAddress(pre6, rep),
    SUBSCRIBER_DOB: formatSubscriberDob(directorField(pre6, rep, 'Dob')),
    SUBSCRIBER_OCCUPATION: directorOccupationLabel(pre6, rep),
    SUBSCRIBER_NATIONALITY: nationalityFor(pre6, rep),
    EQUITY_SHARES_SUBSCRIBED: sharesLabel(corporate.shares),
    TOTAL_SHARES_TAKEN: sharesLabel(plan.totalShares),
    ...witness,
    SUBSCRIBERS: [],
  };

  return { ...fields, ...overrides };
}

// ---------------------------------------------------------------------------
// Missing inputs
// ---------------------------------------------------------------------------

export function collectSubscriptionSheetMissingFields(
  input: IncorpMergeInput,
  options: { directorsFromPre15?: boolean } = {},
): string[] {
  const missing: string[] = [];
  const pre1 = input.pre1 ?? {};
  const pre6 = input.pre6 ?? {};
  const pre7 = input.pre7 ?? {};
  const plan = planSubscription(input);

  if (!(pre7[SUBSCRIPTION_WITNESS_FIELDS.name] ?? '').trim()) {
    missing.push('Witness to the subscribers — name (Pre-7)');
  }
  if (!(pre7[SUBSCRIPTION_WITNESS_FIELDS.address] ?? '').trim()) {
    missing.push('Witness to the subscribers — address (Pre-7)');
  }
  if (!(pre7[SUBSCRIPTION_WITNESS_FIELDS.occupation] ?? '').trim()) {
    missing.push('Witness to the subscribers — occupation (Pre-7)');
  }

  const requireDirector = (audience: IncorpDirectorAudience, label: string) => {
    if (!directorField(pre6, audience, 'FullName')) missing.push(`${label} — full name (Pre-6)`);
    if (!directorField(pre6, audience, 'FatherName')) missing.push(`${label} — father's name (Pre-6)`);
    if (!directorField(pre6, audience, 'UtilityBillAddress')) {
      missing.push(`${label} — utility bill address (Pre-6)`);
    }
    if (!directorField(pre6, audience, 'Dob')) missing.push(`${label} — date of birth (Pre-6)`);
    if (
      options.directorsFromPre15 &&
      directorAudienceKind(audience) === 'non-resident' &&
      !directorField(pre6, audience, 'Nationality')
    ) {
      missing.push(`${label} — nationality (Pre-15)`);
    }
  };

  if (plan.variant === 'foreign') {
    const corporate = plan.corporate!;
    if (!corporate.name.trim() || corporate.name.startsWith('[')) missing.push('Parent entity name (Pre-1)');
    if (!corporate.address.trim() || corporate.address.startsWith('[')) {
      missing.push(
        corporate.entryIndex === null
          ? 'Parent entity address (Pre-1)'
          : `Subscriber ${corporate.entryIndex} — registered address (Pre-16)`,
      );
    }
    if (corporate.entryIndex !== null && corporate.shares <= 0) {
      missing.push(`Subscriber ${corporate.entryIndex} — number of shares (Pre-16)`);
    }
    requireDirector(
      plan.representative,
      plan.representative === 'non-resident' ? 'Non-resident director' : 'Authorised representative',
    );
    if (corporate.entryIndex === null && !pre1.paidUpShareCapital?.trim()) {
      missing.push('Initial Paid-up Share Capital (Pre-1)');
    }
    return missing;
  }

  if (plan.individuals.length === 0) {
    missing.push('Subscribers to the memorandum and the shares each takes (Pre-16)');
    return missing;
  }
  for (const individual of plan.individuals) {
    const label = `Subscriber ${individual.entryIndex}${individual.name ? ` (${individual.name})` : ''}`;
    if (!individual.audience) {
      missing.push(`${label} — must be a proposed director so their KYC can fill the sheet (Pre-16)`);
    } else {
      requireDirector(individual.audience, label);
    }
    if (individual.shares <= 0) missing.push(`${label} — number of shares (Pre-16)`);
  }
  return missing;
}
