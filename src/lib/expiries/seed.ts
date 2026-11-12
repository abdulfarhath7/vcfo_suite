import { coerceStatusCode, getRegistrationPhases } from '@/data/checklist';
import { isChecklistStepSequentiallyComplete } from '@/lib/checklist/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { directorEntriesFromDirectors, displayName, readProposedDirectors } from '@/lib/incorporation/proposed-directors';
import { isoOfText, type RegistrationFactsMap } from '@/lib/registrations/registration-facts';
import { dir3KycDueOnForDin, leiNextExpiry, subjectSlug, type ExpiryKind, type ExpirySource, type SubjectKind } from './model';

/**
 * EXPIRY SEED — the expiry items one engagement's own records imply, for the daily backfill.
 * Pure: the repository hands in the engagement's checklist state, its registration facts
 * (`buildRegistrationFacts`) and its current directors (`company_directors`).
 *
 *  - DSC: every proposed director (`pre-15`, or the legacy Part A slots) who answered "has a
 *    valid DSC" with a DSC expiry date, and every DSC the firm made on KYC Review & DSC (`pre-7`,
 *    the expiry typed beside each director's DSC proof). Keyed by the director's name; a DSC made
 *    on `pre-7` replaces the one the director said they had.
 *  - DSC of the authorised signatory a portal registers (PF `reg-1`, ICEGATE `reg-16`): the holder
 *    and expiry typed on that step, keyed by the holder's name like a director's DSC.
 *  - Name approval: the MCA name approval expiry on `pre-5`, only until SPICe+ Part B (`pre-10`)
 *    is filed or the company is incorporated. The calendar shows it; it raises no renewal alert.
 *  - DIR-3 KYC: only once the company is incorporated (a company has no director KYC due dates
 *    before its COI). Every DIN holder among the proposed directors and the current company
 *    directors, deduplicated by DIN, due by `dir3KycDueOnForDin`. A DIN allotted at
 *    incorporation (the director answered "no DIN" on Proposed directors, so SPICe+ allotted it)
 *    counts as allotted on the incorporation date, so it is first due on 30 September of the
 *    next financial year. The app stores no other allotment date, so a director who already had
 *    a DIN keeps the yearly 30 September. Keyed by the DIN. The seed only inserts these
 *    (`sync: false`): the next year's date comes from marking the item renewed, so a missed
 *    30 September stays red instead of quietly moving on. The one exception is `raiseOnly`.
 *  - Registrations: every registration step whose facts carry an expiry (the step's answer, or
 *    the issue date and renewal period typed on the credentials workbook). LEI with only a
 *    registration date renews yearly from it (`leiNextExpiry`). A Trademark Renewal date
 *    (`reg-17`) replaces the Trademark Registration one (`reg-12`). Keyed by the step id, and kept
 *    in step with the facts (`sync: true`).
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
  /**
   * With `sync: false`: an untouched seeded item (never renewed or edited) with an earlier date
   * moves to this one. Set on a DIR-3 KYC whose first due date comes from the DIN's allotment,
   * so an item seeded before that rule existed is corrected, and never moved earlier.
   */
  raiseOnly?: boolean;
}

export interface SeedInput {
  companyName: string;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  registrationFacts: RegistrationFactsMap;
  directors: Array<{ name: string; din: string | null; ceasedOn: string | null }>;
  today: string;
  /**
   * `isIncorporated` for the engagement; a name approval no longer matters once it is, and
   * DIR-3 KYC items exist only once it is.
   */
  incorporated?: boolean;
  /** The engagement's incorporation date, the allotment date of DINs allotted through SPICe+. */
  incorporationDate?: string | null;
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
  return FEEDING_STEPS.has(stepId) || stepId.startsWith('reg-');
}

/** Directors and DSCs (pre-1, pre-7, pre-15), the name approval and the steps that end it. */
const FEEDING_STEPS: ReadonlySet<string> = new Set(['pre-1', 'pre-5', 'pre-7', 'pre-10', 'pre-12', 'pre-15']);

/** Steps that register the authorised signatory's DSC on a portal. */
const SIGNATORY_DSC_STEPS = ['reg-1', 'reg-16'] as const;

/** The name approval source key; the repository removes the item once the seed stops sending it. */
export const NAME_APPROVAL_SOURCE_KEY = 'name:pre-5';

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** DIR-3 KYC rows of an incorporated engagement; see the module comment. */
function dir3KycRows(input: SeedInput, directors: ReturnType<typeof readProposedDirectors>): SeedRow[] {
  const incorporatedOn = isoOfText(input.incorporationDate);
  // Proposed directors who had no DIN got one through SPICe+, on the incorporation date.
  const allottedAtIncorporation = new Set(
    directors.filter((d) => (d.values.hasDin ?? '').trim() === 'no').map((d) => nameKey(displayName(d.values))).filter(Boolean),
  );
  const allottedOn = (name: string) => (incorporatedOn && allottedAtIncorporation.has(nameKey(name)) ? incorporatedOn : null);

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
  const rows: SeedRow[] = [];
  for (const [din, name] of dinHolders) {
    const allotted = allottedOn(name);
    rows.push({
      subjectKind: 'person',
      subjectName: name,
      kind: 'dir3_kyc',
      referenceLabel: `DIN ${din}`,
      expiresOn: dir3KycDueOnForDin(input.today, allotted),
      source: 'checklist',
      sourceKey: `dir3:${din}`,
      sync: false,
      ...(allotted ? { raiseOnly: true } : {}),
    });
  }
  return rows;
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
  for (const stepId of SIGNATORY_DSC_STEPS) {
    const r = input.state[stepId]?.responses ?? {};
    const expires = isoOfText(r.signatoryDscExpiryDate);
    if (expires) addDsc(r.signatoryDscHolderName?.trim() || 'Authorised signatory', null, expires);
  }
  rows.push(...dsc.values());

  const nameExpiry = isoOfText(input.state['pre-5']?.responses?.nameApprovalExpiryDate);
  const partB = input.state['pre-10'];
  const partBFiled = Boolean(partB && isChecklistStepSequentiallyComplete(coerceStatusCode(partB.status), partB, 'pre-10'));
  if (nameExpiry && !input.incorporated && !partBFiled) {
    const approved = input.state['pre-5']?.responses?.approvedCompanyName?.trim();
    rows.push({
      subjectKind: 'company',
      subjectName: input.companyName,
      kind: 'name_approval',
      referenceLabel: approved ? `File SPICe+ Part B for ${approved} before this date` : 'File SPICe+ Part B before this date',
      expiresOn: nameExpiry,
      source: 'checklist',
      sourceKey: NAME_APPROVAL_SOURCE_KEY,
      sync: true,
    });
  }

  if (input.incorporated) rows.push(...dir3KycRows(input, directors));

  for (const [stepId, facts] of Object.entries(input.registrationFacts)) {
    if (stepId === 'reg-12' && input.registrationFacts['reg-17']?.expiresOn) continue;
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
