import { getRegistrationPhases } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { directorEntriesFromDirectors, displayName, readProposedDirectors } from '@/lib/incorporation/proposed-directors';
import { isoOfText, type RegistrationFactsMap } from '@/lib/registrations/registration-facts';
import { dir3KycDueOn, leiNextExpiry, subjectSlug, type ExpiryKind, type ExpirySource, type SubjectKind } from './model';

/**
 * EXPIRY SEED — the expiry items one engagement's own records imply, for the daily backfill.
 * Pure: the repository hands in the engagement's checklist state, its registration facts
 * (`buildRegistrationFacts`) and its current directors (`company_directors`).
 *
 *  - DSC: every proposed director (`pre-15`, or the legacy Part A slots) who answered "has a
 *    valid DSC" with a DSC expiry date, and every DSC the firm made on KYC Review & DSC (`pre-7`,
 *    the expiry typed beside each director's DSC proof). Keyed by the director's name; a DSC made
 *    on `pre-7` replaces the one the director said they had.
 *  - DIR-3 KYC: every DIN holder among the proposed directors and the current company
 *    directors, deduplicated by DIN, due by `dir3KycDueOn`. Keyed by the DIN. The seed only
 *    inserts these (`sync: false`): the next year's date comes from marking the item renewed, so
 *    a missed 30 September stays red instead of quietly moving on.
 *  - Registrations: every registration step whose facts carry an expiry (the step's answer, or
 *    the issue date and renewal period typed on the credentials workbook). LEI with only a
 *    registration date renews yearly from it (`leiNextExpiry`). Keyed by the step id, and kept in
 *    step with the facts (`sync: true`).
 */

export interface SeedRow {
  subjectKind: SubjectKind;
  subjectName: string;
  kind: ExpiryKind;
  referenceLabel: string | null;
  expiresOn: string;
  source: Extract<ExpirySource, 'checklist' | 'registration'>;
  sourceKey: string;
  /** True: a changed date in the source updates the item. False: insert once, never update. */
  sync: boolean;
}

export interface SeedInput {
  companyName: string;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  registrationFacts: RegistrationFactsMap;
  directors: Array<{ name: string; din: string | null; ceasedOn: string | null }>;
  today: string;
}

/** Registration steps and the expiry kind each one tracks; the rest are "other". */
export const REGISTRATION_STEP_KIND: Record<string, ExpiryKind> = {
  'reg-1': 'pf',
  'reg-3': 'esi',
  'reg-4': 'gst',
  'reg-6': 'lei',
  'reg-7': 'pt',
  'reg-8': 'iec',
  'reg-9': 'shops',
  'reg-10': 'trade_licence',
  'reg-15': 'msme',
};

/** `nrDirectorDscExpiryDate`, `residentDirector2DscExpiryDate` …: the field after the director's prefix. */
const PRE7_DSC_EXPIRY_SUFFIX = 'DscExpiryDate';

const DIN = /^\d{8}$/;

function cleanDin(value: string | null | undefined): string | null {
  const v = (value ?? '').replace(/\s+/g, '');
  return DIN.test(v) ? v : null;
}

function stepTitle(stepId: string): string {
  return getRegistrationPhases().flatMap((p) => p.items).find((i) => i.id === stepId)?.title ?? stepId;
}

/**
 * Steps whose answers feed the seed: the proposed directors (Part A `pre-1`, `pre-15`), the DSCs
 * made on `pre-7`, and every registration step. A save of any other step leaves expiries alone.
 */
export function stepFeedsExpiries(stepId: string): boolean {
  return stepId === 'pre-1' || stepId === 'pre-7' || stepId === 'pre-15' || stepId.startsWith('reg-');
}

export function seedRowsFor(input: SeedInput): SeedRow[] {
  const rows: SeedRow[] = [];
  const directors = readProposedDirectors(input.state);

  const dsc = new Map<string, SeedRow>();
  const addDsc = (name: string, din: string | null, expires: string | null) => {
    if (!name || !expires) return;
    const sourceKey = `dsc:${subjectSlug(name)}`;
    dsc.set(sourceKey, {
      subjectKind: 'person',
      subjectName: name,
      kind: 'dsc',
      referenceLabel: din ? `DIN ${din}` : null,
      expiresOn: expires,
      source: 'checklist',
      sourceKey,
      sync: true,
    });
  };
  for (const d of directors) {
    addDsc(displayName(d.values), cleanDin(d.values.din), d.values.hasDsc === 'yes' ? isoOfText(d.values.dscExpiryDate) : null);
  }
  const pre7 = input.state['pre-7']?.responses ?? {};
  for (const entry of directorEntriesFromDirectors(directors)) {
    addDsc(displayName(entry.director.values), cleanDin(entry.director.values.din), isoOfText(pre7[`${entry.fieldPrefix}${PRE7_DSC_EXPIRY_SUFFIX}`]));
  }
  rows.push(...dsc.values());

  const dinHolders = new Map<string, string>();
  for (const d of input.directors) {
    const din = cleanDin(d.din);
    if (din && !d.ceasedOn && d.name.trim()) dinHolders.set(din, d.name.trim());
  }
  for (const d of directors) {
    const din = cleanDin(d.values.din);
    const name = displayName(d.values);
    if (din && name && !dinHolders.has(din)) dinHolders.set(din, name);
  }
  const kycDue = dir3KycDueOn(input.today);
  for (const [din, name] of dinHolders) {
    rows.push({
      subjectKind: 'person',
      subjectName: name,
      kind: 'dir3_kyc',
      referenceLabel: `DIN ${din}`,
      expiresOn: kycDue,
      source: 'checklist',
      sourceKey: `dir3:${din}`,
      sync: false,
    });
  }

  for (const [stepId, facts] of Object.entries(input.registrationFacts)) {
    const kind = REGISTRATION_STEP_KIND[stepId] ?? 'other';
    let expiresOn = facts.expiresOn;
    if (!expiresOn && kind === 'lei') {
      const issued = facts.issuedOn ?? isoOfText(facts.registeredOn);
      if (issued) expiresOn = leiNextExpiry(issued, input.today);
    }
    if (!expiresOn) continue;
    const title = stepTitle(stepId);
    rows.push({
      subjectKind: 'company',
      subjectName: input.companyName,
      kind,
      referenceLabel: facts.number ? `${title} ${facts.number}` : title,
      expiresOn,
      source: 'registration',
      sourceKey: `reg:${stepId}`,
      sync: true,
    });
  }
  return rows;
}
