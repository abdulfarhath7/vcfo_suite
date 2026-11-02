import { NOC_TEMPLATES } from '@/lib/noc/templates';
import { NOC_VARIANTS, resolveNocVariant, type NocVariant } from '@/lib/noc/variant';
import {
  NOC_STEP_LABEL,
  allChecksTicked,
  isForeignVariant,
  nocReceiveChecks,
  nocTrackKeys,
  type NocAnswers,
  type NocStepKey,
} from '@/lib/noc/receive';
import { diffNocFields, type NocFieldChange } from '@/lib/noc/fields';

/**
 * The board resolution (NOC) state the page reads (`GET .../board-resolution/noc`). The shape is
 * the contract in `docs/ui-port/BR-NOC-API.md`. Pure: the repository passes the stored row, the
 * project answers and display names; nothing is invented when a value is missing.
 */

export interface NocStamp {
  at: string;
  byName?: string;
}

export interface NocTrackStep {
  key: NocStepKey;
  label: string;
  done: boolean;
  at?: string;
  byName?: string;
}

export interface NocCheckState {
  key: string;
  label: string;
  ticked: boolean;
  at?: string;
  byName?: string;
}

export interface NocStaffState {
  templateFileName: string;
  override: { variant: NocVariant; reason: string; at: string; byName?: string } | null;
  checks: NocCheckState[];
  outOfDate: { changes: NocFieldChange[] } | null;
  vaultDocumentId: string | null;
  canChangeTemplate: boolean;
  canReceive: boolean;
}

export interface NocState {
  variant: NocVariant;
  variantLabel: string;
  resolvedVariant: NocVariant | null;
  answers: { ownershipType: string | null; companyType: string | null; parentIndianRelationship: string | null };
  parentName: string | null;
  foreignParent: boolean;
  notaryStepsOff: boolean;
  track: NocTrackStep[];
  accepted: boolean;
  sentBack: { at: string; byName?: string; reason: string } | null;
  version: number | null;
  staff?: NocStaffState;
}

/** The stored row as the builder needs it (dates as ISO strings, people as profile ids). */
export interface NocRowInput {
  status?: string | null;
  storagePath?: string | null;
  draftedAt?: string | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  signedStoragePath?: string | null;
  signedUploadedAt?: string | null;
  signedUploadedBy?: string | null;
  notarisedAt?: string | null;
  notarisedBy?: string | null;
  apostilledAt?: string | null;
  apostilledBy?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  sentBackAt?: string | null;
  sentBackBy?: string | null;
  sentBackReason?: string | null;
  receiveChecks?: unknown;
  notaryStepsOff?: boolean | null;
  templateVariant?: string | null;
  templateChangedAt?: string | null;
  templateChangedBy?: string | null;
  templateChangeReason?: string | null;
  vaultDocumentId?: string | null;
}

export interface NocBuildInput {
  row: NocRowInput | null;
  answers: NocAnswers & { parentEntityName?: string | null };
  names: ReadonlyMap<string, string>;
  /** Latest recorded version, if any. */
  latestVersion?: { version: number; fields: Record<string, string> } | null;
  /** The snapshot the answers give today (only computed for staff). */
  currentFields?: Record<string, string> | null;
  viewer: { staff: boolean; canChangeTemplate: boolean };
}

export function parseNocVariant(v: unknown): NocVariant | null {
  return typeof v === 'string' && (NOC_VARIANTS as readonly string[]).includes(v) ? (v as NocVariant) : null;
}

/** `{ [key]: { by, at } }` from the jsonb column; anything else reads as no ticks. */
export function parseReceiveChecks(raw: unknown): Record<string, { by?: string; at?: string }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, { by?: string; at?: string }> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    out[k] = { by: typeof r.by === 'string' ? r.by : undefined, at: typeof r.at === 'string' ? r.at : undefined };
  }
  return out;
}

export function effectiveNocVariant(row: Pick<NocRowInput, 'templateVariant'> | null, answers: NocAnswers): NocVariant {
  return parseNocVariant(row?.templateVariant) ?? resolveNocVariant(answers) ?? 'foreign-parent';
}

function stamp(at: string | null | undefined, by: string | null | undefined, names: ReadonlyMap<string, string>): NocStamp | null {
  if (!at) return null;
  const byName = by ? names.get(by) : undefined;
  return byName ? { at, byName } : { at };
}

export function buildNocState(input: NocBuildInput): NocState {
  const { row, answers, names, viewer } = input;
  const variant = effectiveNocVariant(row, answers);
  const foreign = isForeignVariant(variant);
  const notaryStepsOff = Boolean(row?.notaryStepsOff);
  const finalized = row?.status === 'finalized';
  const generated = Boolean(row && (row.storagePath?.trim() || row.draftedAt));
  const signed = Boolean(row?.signedStoragePath?.trim());

  const stamps: Record<NocStepKey, NocStamp | null> = {
    drafted: stamp(row?.draftedAt, null, names),
    released: finalized ? stamp(row?.finalizedAt, row?.finalizedBy, names) : null,
    signed: signed ? stamp(row?.signedUploadedAt, row?.signedUploadedBy, names) : null,
    notarised: signed ? stamp(row?.notarisedAt, row?.notarisedBy, names) : null,
    apostilled: signed ? stamp(row?.apostilledAt, row?.apostilledBy, names) : null,
    accepted: stamp(row?.acceptedAt, row?.acceptedBy, names),
  };
  const doneOf: Record<NocStepKey, boolean> = {
    drafted: generated || finalized,
    released: finalized,
    signed,
    notarised: Boolean(stamps.notarised),
    apostilled: Boolean(stamps.apostilled),
    accepted: Boolean(stamps.accepted),
  };
  const track: NocTrackStep[] = nocTrackKeys(foreign, notaryStepsOff).map((key) => {
    const s = stamps[key];
    return { key, label: NOC_STEP_LABEL[key], done: doneOf[key], ...(s && doneOf[key] ? s : {}) };
  });

  const sentBack =
    row?.sentBackAt && row.sentBackReason?.trim() && !row.acceptedAt
      ? { ...(stamp(row.sentBackAt, row.sentBackBy, names) as NocStamp), reason: row.sentBackReason.trim() }
      : null;

  const state: NocState = {
    variant,
    variantLabel: NOC_TEMPLATES[variant].label,
    resolvedVariant: resolveNocVariant(answers),
    answers: {
      ownershipType: answers.ownershipType ?? null,
      companyType: answers.companyType ?? null,
      parentIndianRelationship: answers.parentIndianRelationship ?? null,
    },
    parentName: answers.parentEntityName?.trim() || null,
    foreignParent: foreign,
    notaryStepsOff,
    track,
    accepted: doneOf.accepted,
    sentBack,
    version: input.latestVersion?.version ?? null,
  };

  if (!viewer.staff) return state;

  const ticks = parseReceiveChecks(row?.receiveChecks);
  const checks: NocCheckState[] = nocReceiveChecks(foreign, notaryStepsOff).map((c) => {
    const t = ticks[c.key];
    const byName = t?.by ? names.get(t.by) : undefined;
    return { key: c.key, label: c.label, ticked: Boolean(t), ...(t?.at ? { at: t.at } : {}), ...(byName ? { byName } : {}) };
  });
  const overrideVariant = parseNocVariant(row?.templateVariant);
  const changes =
    finalized && input.latestVersion && input.currentFields
      ? diffNocFields(input.latestVersion.fields, input.currentFields)
      : [];
  state.staff = {
    templateFileName: NOC_TEMPLATES[variant].downloadFilename,
    override:
      overrideVariant && row?.templateChangedAt
        ? {
            variant: overrideVariant,
            reason: row.templateChangeReason?.trim() ?? '',
            at: row.templateChangedAt,
            ...(row.templateChangedBy && names.get(row.templateChangedBy) ? { byName: names.get(row.templateChangedBy) } : {}),
          }
        : null,
    checks,
    outOfDate: changes.length ? { changes } : null,
    vaultDocumentId: row?.vaultDocumentId ?? null,
    canChangeTemplate: viewer.canChangeTemplate,
    canReceive: true,
  };
  return state;
}

/** Accept is allowed: a signed copy, not accepted yet, and every applicable check ticked. */
export function nocMayAccept(row: NocRowInput | null, answers: NocAnswers): boolean {
  if (!row?.signedStoragePath?.trim() || row.acceptedAt) return false;
  const foreign = isForeignVariant(effectiveNocVariant(row, answers));
  return allChecksTicked(nocReceiveChecks(foreign, Boolean(row.notaryStepsOff)), parseReceiveChecks(row.receiveChecks));
}
