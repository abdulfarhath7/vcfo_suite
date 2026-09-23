import type { ChecklistItemResponses } from '@/lib/checklist-responses';

/**
 * DIRECTOR AUDIENCES — who a director-level incorporation draft is written for.
 *
 * An audience key encodes the director's residency and their slot within it:
 * `non-resident`, `resident` (slot 1, the legacy keys) and `non-resident-2`,
 * `resident-3` … for later directors. The key maps one-to-one onto the Director
 * KYC field prefix (`nrDirector`, `residentDirector2` …) that both the legacy
 * `pre-6` step and the synthesised `pre-6` map from `pre-15` already use, so
 * every stored row key, response key and S3 path keeps resolving.
 *
 * Nothing outside this file may build a prefix or a key by hand.
 */
export type IncorpDirectorKind = 'non-resident' | 'resident';

export type IncorpDirectorAudience = IncorpDirectorKind | `${IncorpDirectorKind}-${number}`;

/** Director-specific or company-level incorporation draft audience. */
export type IncorpDocAudience = IncorpDirectorAudience | 'company';

/** The two audiences every engagement had before per-director generation. */
export const LEGACY_DIRECTOR_AUDIENCES: readonly IncorpDirectorKind[] = ['non-resident', 'resident'];

/**
 * Per-kind slot ceiling. The pre-7 / pre-8 field lists are a static superset
 * (like pre-6's four KYC slots), so the ceiling bounds how many we declare.
 */
export const MAX_DIRECTOR_SLOTS_PER_KIND = 6;

const KIND_PREFIX: Record<IncorpDirectorKind, string> = {
  'non-resident': 'nrDirector',
  resident: 'residentDirector',
};

const KIND_LABEL: Record<IncorpDirectorKind, string> = {
  'non-resident': 'Non-resident Director',
  resident: 'Resident Director',
};

const AUDIENCE_PATTERN = /^(non-resident|resident)(?:-([2-9]|[1-9]\d+))?$/;

export function directorAudienceKey(kind: IncorpDirectorKind, slot: number): IncorpDirectorAudience {
  return slot <= 1 ? kind : `${kind}-${slot}`;
}

export function parseDirectorAudience(
  value: string,
): { kind: IncorpDirectorKind; slot: number } | null {
  const match = AUDIENCE_PATTERN.exec(value);
  if (!match) return null;
  const slot = match[2] ? Number(match[2]) : 1;
  if (slot > MAX_DIRECTOR_SLOTS_PER_KIND) return null;
  return { kind: match[1] as IncorpDirectorKind, slot };
}

export function isDirectorAudience(value: string): value is IncorpDirectorAudience {
  return parseDirectorAudience(value) !== null;
}

export function isIncorpDocAudience(value: string): value is IncorpDocAudience {
  return value === 'company' || isDirectorAudience(value);
}

export function directorAudienceKind(audience: IncorpDirectorAudience): IncorpDirectorKind {
  return parseDirectorAudience(audience)?.kind ?? 'resident';
}

export function directorAudienceSlot(audience: IncorpDirectorAudience): number {
  return parseDirectorAudience(audience)?.slot ?? 1;
}

/** `nrDirector`, `residentDirector2` … — slot 1 keeps the legacy prefix. */
export function directorFieldPrefix(audience: IncorpDirectorAudience): string {
  const parsed = parseDirectorAudience(audience);
  if (!parsed) return KIND_PREFIX.resident;
  const base = KIND_PREFIX[parsed.kind];
  return parsed.slot <= 1 ? base : `${base}${parsed.slot}`;
}

/** "Resident Director", "Resident Director 2" … */
export function directorAudienceLabel(audience: IncorpDirectorAudience): string {
  const parsed = parseDirectorAudience(audience);
  if (!parsed) return KIND_LABEL.resident;
  const base = KIND_LABEL[parsed.kind];
  return parsed.slot <= 1 ? base : `${base} ${parsed.slot}`;
}

/** Slot-1 audiences are the only ones that existed before per-director generation. */
export function isLegacyDirectorAudience(audience: IncorpDocAudience): boolean {
  return audience === 'company' || (LEGACY_DIRECTOR_AUDIENCES as readonly string[]).includes(audience);
}

/** Whether `fieldId` is a per-director field of `audience` (`nrDirector` must not match `nrDirector2*`). */
export function fieldBelongsToAudience(fieldId: string, audience: IncorpDirectorAudience): boolean {
  const prefix = directorFieldPrefix(audience);
  if (!fieldId.startsWith(prefix)) return false;
  return /^[A-Z]/.test(fieldId.slice(prefix.length));
}

/** The director audience a per-director field id belongs to, if any. */
export function audienceForDirectorFieldId(fieldId: string): IncorpDirectorAudience | null {
  const match = /^(nrDirector|residentDirector)(\d*)(?=[A-Z])/.exec(fieldId);
  if (!match) return null;
  const kind: IncorpDirectorKind = match[1] === 'nrDirector' ? 'non-resident' : 'resident';
  const slot = match[2] ? Number(match[2]) : 1;
  if (slot < 1 || slot > MAX_DIRECTOR_SLOTS_PER_KIND) return null;
  return directorAudienceKey(kind, slot);
}

/**
 * The director audiences present in a `pre-6`-shaped map (stored legacy or
 * synthesised from `pre-15`), in kind-then-slot order. A slot counts as present
 * when any of its fields holds a value. Empty map → the two legacy audiences,
 * so callers without director data behave exactly as before.
 */
export function directorAudiencesFromPre6(
  pre6: ChecklistItemResponses | undefined,
): IncorpDirectorAudience[] {
  if (!pre6) return [...LEGACY_DIRECTOR_AUDIENCES];
  const present = new Set<IncorpDirectorAudience>();
  for (const [key, value] of Object.entries(pre6)) {
    if (!value?.trim()) continue;
    const audience = audienceForDirectorFieldId(key);
    if (audience) present.add(audience);
  }
  if (present.size === 0) return [...LEGACY_DIRECTOR_AUDIENCES];
  return sortDirectorAudiences([...present]);
}

export function sortDirectorAudiences(audiences: IncorpDirectorAudience[]): IncorpDirectorAudience[] {
  const rank = (a: IncorpDirectorAudience) => {
    const parsed = parseDirectorAudience(a);
    return parsed ? (parsed.kind === 'non-resident' ? 0 : 100) + parsed.slot : 999;
  };
  return [...new Set(audiences)].sort((a, b) => rank(a) - rank(b));
}
