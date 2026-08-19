import {
  getActiveCatalogItems,
  getIncorporationPhases,
  itemsByBucket,
  type Bucket,
  type ChecklistItem,
} from '@/data/checklist';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { getStepGate } from '@/lib/checklist-step-gate';

export type InternPhaseKind = 'done' | 'current' | 'locked';

export type InternOverviewNow = {
  item: ChecklistItem;
  bucket: Bucket;
  phaseId: string | null;
  phaseTitle: string;
  stepNumber: number;
  stepTotal: number;
  stepTitle: string;
  waiting: boolean;
};

/** Intern overview tab / Now-strip titles (does not change shared checklist phase names). */
export function internOverviewPhaseTitle(phaseId: string, fallbackTitle: string): string {
  switch (phaseId) {
    case 'pre-inc-phase-1':
      return 'SPICe+ Part A';
    case 'pre-inc-phase-2':
      return 'SPICe+ Part B';
    case 'post-inc-phase-3':
      return 'Post-incorporation';
    case 'registration-phase-4':
      return 'Registration';
    default:
      return fallbackTitle.replace(/^Phase\s+\d+\s+[—–-]\s+/i, '').trim() || fallbackTitle;
  }
}

export function internPhaseStepCounts(
  items: readonly { id: string }[],
  gates: Record<string, ChecklistStepGate>,
): { done: number; total: number } {
  const total = items.length;
  const done = items.filter((item) => getStepGate(gates, item.id).kind === 'done').length;
  return { done, total };
}

/**
 * Intern overview card / stepper target for a phase: first catalog item that
 * is not `gate.kind === 'done'`. If every item is done, the last step.
 */
export function internOverviewCurrentItemInPhase<T extends { id: string }>(
  items: readonly T[],
  gates: Record<string, ChecklistStepGate>,
): T | null {
  if (items.length === 0) return null;
  return items.find((item) => getStepGate(gates, item.id).kind !== 'done') ?? items[items.length - 1] ?? null;
}

export function internPhaseProgressLabel(done: number, total: number): string {
  return `${done} of ${total} complete`;
}

export function internPhaseProgressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export type InternOverviewPhase = {
  id: string;
  title: string;
  items: ChecklistItem[];
};

/** Four intern phase tabs: Part A, Part B, Post-inc, Registration (FEMA nested). */
export function internOverviewPhases(): InternOverviewPhase[] {
  return getIncorporationPhases().map((phase) => ({
    id: phase.id,
    title: internOverviewPhaseTitle(phase.id, phase.title),
    items:
      phase.id === 'registration-phase-4'
        ? internRegistrationCardItems(phase.items)
        : phase.items,
  }));
}

export const INTERN_OVERVIEW_PHASE_TAB_IDS = [
  'pre-inc-phase-1',
  'pre-inc-phase-2',
  'post-inc-phase-3',
  'registration-phase-4',
] as const;

export type InternOverviewPhaseTabId = (typeof INTERN_OVERVIEW_PHASE_TAB_IDS)[number];

/** Per-project last intern overview tab: `vcfo.intern.engagementPhaseTab.{engagementId}`. */
export const INTERN_ENGAGEMENT_PHASE_TAB_STORAGE_PREFIX = 'vcfo.intern.engagementPhaseTab.';

export function internEngagementPhaseTabStorageKey(engagementId: string): string {
  return `${INTERN_ENGAGEMENT_PHASE_TAB_STORAGE_PREFIX}${engagementId}`;
}

export function internEngagementPhaseTabDefault(
  stored: string | null | undefined,
  currentPhaseId: string | null | undefined,
  phaseIds: readonly string[],
): string {
  if (stored && phaseIds.includes(stored)) return stored;
  if (currentPhaseId && phaseIds.includes(currentPhaseId)) return currentPhaseId;
  return phaseIds[0] ?? INTERN_OVERVIEW_PHASE_TAB_IDS[0];
}

export function readInternEngagementPhaseTab(engagementId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(internEngagementPhaseTabStorageKey(engagementId));
  } catch {
    return null;
  }
}

export function writeInternEngagementPhaseTab(engagementId: string, phaseId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(internEngagementPhaseTabStorageKey(engagementId), phaseId);
  } catch {
    /* private mode / quota */
  }
}

/** Phase that owns this catalog item on intern overview / step rails. */
export function internOverviewPhaseForItem(itemId: string): InternOverviewPhase | null {
  return internOverviewPhases().find((phase) => phase.items.some((item) => item.id === itemId)) ?? null;
}

/** Next catalog item in the intern phase after `itemId`, or null at the last step. */
export function internNextCatalogItemInPhase(itemId: string): ChecklistItem | null {
  const phase = internOverviewPhaseForItem(itemId);
  if (!phase) return null;
  const index = phase.items.findIndex((item) => item.id === itemId);
  if (index < 0 || index >= phase.items.length - 1) return null;
  return phase.items[index + 1] ?? null;
}

export type InternFormNextTarget =
  | { kind: 'section'; index: number }
  | { kind: 'step'; item: ChecklistItem }
  | { kind: 'engagement' };

/**
 * Intern form footer Next: remaining headings in this step, then the next catalog
 * item in the same intern phase, then the engagement page.
 */
export function internFormNextTarget(
  itemId: string,
  selectedSectionIndex: number,
  sectionCount: number,
): InternFormNextTarget {
  if (sectionCount > 0 && selectedSectionIndex < sectionCount - 1) {
    return { kind: 'section', index: selectedSectionIndex + 1 };
  }
  const nextItem = internNextCatalogItemInPhase(itemId);
  if (nextItem) return { kind: 'step', item: nextItem };
  return { kind: 'engagement' };
}

export function internFormNextLabel(target: InternFormNextTarget): 'Next' | 'Done' {
  return target.kind === 'engagement' ? 'Done' : 'Next';
}

/** Sub-headers inside the intern Registration card (catalog order within each group). */
export const INTERN_REGISTRATION_HEADING_ORDER = [
  'Registrations',
  'FEMA',
  'Customs',
  'Foreign Trade',
  'Labour',
  'Local Compliance',
  'IP/Brand',
] as const;

export type InternRegistrationHeading = (typeof INTERN_REGISTRATION_HEADING_ORDER)[number];

function normalizeRegistrationTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Map a catalog title to the intern Registration sub-header.
 * GST wins over LUT so "GST & LUT" stays under Registrations; standalone LUT is Customs.
 */
export function internRegistrationHeadingForTitle(title: string): InternRegistrationHeading {
  const t = normalizeRegistrationTitle(title);

  if (
    /\bfc\s*gpr\b/.test(t) ||
    /\bfdi\b/.test(t) ||
    /\bodi\b/.test(t) ||
    /\bfla\b/.test(t) ||
    /\bfctrs\b/.test(t) ||
    /\bfema\b/.test(t)
  ) {
    return 'FEMA';
  }
  if (
    /\bgst\b/.test(t) ||
    /\bepf\b/.test(t) ||
    /\besi\b/.test(t) ||
    /\bprofessional tax\b/.test(t) ||
    /(^| )pf( |$)/.test(t) ||
    /(^| )pt( |$)/.test(t) ||
    /\bprovident fund\b/.test(t) ||
    /\blei\b/.test(t) ||
    /\bmsme\b/.test(t) ||
    /\budyam\b/.test(t) ||
    /\bpan\b/.test(t) ||
    /\btan\b/.test(t)
  ) {
    return 'Registrations';
  }
  if (/\bicegate\b/.test(t) || /\biec\b/.test(t) || /\blut\b/.test(t)) {
    return 'Customs';
  }
  if (/\bnon stpi\b/.test(t) || /\bstpi\b/.test(t)) {
    return 'Foreign Trade';
  }
  if (
    /\bshops?\b/.test(t) ||
    /\bestablishment\b/.test(t) ||
    /\bclra\b/.test(t) ||
    /\bposh\b/.test(t) ||
    /\bshe box\b/.test(t)
  ) {
    return 'Labour';
  }
  if (/\btrade licen/.test(t)) {
    return 'Local Compliance';
  }
  if (/\btrademark\b/.test(t) || /\bpatent\b/.test(t) || /\bicdr\b/.test(t)) {
    return 'IP/Brand';
  }
  return 'Registrations';
}

/** Registration phase rows plus FEMA-bucket items intern no longer sees as a top-level card. */
export function internRegistrationCardItems(
  registrationItems: readonly ChecklistItem[],
): ChecklistItem[] {
  const seen = new Set(registrationItems.map((item) => item.id));
  const extras = itemsByBucket('fema').filter((item) => !seen.has(item.id));
  return extras.length === 0 ? [...registrationItems] : [...registrationItems, ...extras];
}

export function internRegistrationHeadingGroups(
  items: readonly ChecklistItem[],
): Array<{ heading: InternRegistrationHeading; items: ChecklistItem[] }> {
  const buckets = new Map<InternRegistrationHeading, ChecklistItem[]>();
  for (const heading of INTERN_REGISTRATION_HEADING_ORDER) {
    buckets.set(heading, []);
  }
  for (const item of items) {
    buckets.get(internRegistrationHeadingForTitle(item.title))!.push(item);
  }
  return INTERN_REGISTRATION_HEADING_ORDER.map((heading) => ({
    heading,
    items: buckets.get(heading)!,
  })).filter((group) => group.items.length > 0);
}

/** Sequential phase state for the Now strip. Intern rows stay clickable regardless. */
export function internNodeKind(
  items: readonly { id: string }[],
  gates: Record<string, ChecklistStepGate>,
): InternPhaseKind {
  if (items.length === 0) return 'locked';
  let allDone = true;
  let hasCurrent = false;
  for (const item of items) {
    const kind = getStepGate(gates, item.id).kind;
    if (kind === 'active' || kind === 'waiting') hasCurrent = true;
    if (kind !== 'done') allDone = false;
  }
  if (allDone) return 'done';
  if (hasCurrent) return 'current';
  return 'locked';
}

/**
 * Current catalog step: first `active` (intern-owned) or `waiting` (client-owned) gate.
 * Locked later phases are not “now”.
 */
export function internOverviewNow(
  gates: Record<string, ChecklistStepGate>,
): InternOverviewNow | null {
  const current = getActiveCatalogItems().find((item) => {
    const kind = getStepGate(gates, item.id).kind;
    return kind === 'active' || kind === 'waiting';
  });
  if (!current) return null;

  const phase = getIncorporationPhases().find((group) =>
    group.items.some((item) => item.id === current.id),
  );
  const stepNumber = phase ? phase.items.findIndex((item) => item.id === current.id) + 1 : 1;
  const kind = getStepGate(gates, current.id).kind;

  return {
    item: current,
    bucket: current.bucket,
    phaseId: phase?.id ?? null,
    phaseTitle: internOverviewPhaseTitle(phase?.id ?? '', phase?.title ?? ''),
    stepNumber: stepNumber > 0 ? stepNumber : 1,
    stepTotal: phase?.items.length || 1,
    stepTitle: current.title,
    waiting: kind === 'waiting',
  };
}
