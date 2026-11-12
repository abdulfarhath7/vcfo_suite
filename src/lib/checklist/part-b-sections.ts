/**
 * Section headings of the SPICe+ Part B steps (pre-13 to pre-16), named and
 * numbered as on the MCA SPICe+ Part B form (INC-32), so a Lead can copy the
 * answers into the MCA portal one section after another (CR-2026-11 SB-01).
 *
 * A heading is also the section's tab key: `sectionSlug(heading)` is the
 * `?tab=` value. Change a heading here and every deep link follows. Field ids
 * never change, so the stored answers of current projects stay where they are.
 *
 * MCA order: 3A capital, 4 address, 5 and 6 first subscribers, 7 directors.
 */
export const PART_B_SECTION = {
  equityCapital: '3A(i) Equity share capital',
  preferenceCapital: '3A(ii) Preference share capital',
  correspondenceAddress: '4A Correspondence Address',
  officeProof: '4B Proof of Office address',
  subscribers: '5–6 First subscriber(s) to MOA',
  agileNominee: 'AGILE-PRO-S (INC-35) nominee',
  directors: '7 Particulars of Subscriber(s) cum Directors/Director of the Company',
} as const;

export type PartBSection = (typeof PART_B_SECTION)[keyof typeof PART_B_SECTION];

/**
 * Splits "3A(i) Equity share capital" into the MCA number and the name, so a
 * section card can show the number in its chip. A heading with no MCA number
 * returns `null`.
 */
export function splitMcaSectionHeading(heading: string): { number: string; name: string } | null {
  const m = /^(\d+[A-Z]?(?:\([ivx]+\))?(?:–\d+)?)\s+(.+)$/.exec(heading.trim());
  return m ? { number: m[1], name: m[2] } : null;
}

/**
 * The MCA section each SPICe+ Part B step fills, in MCA form order (3A, 4,
 * 5–6, 7). The checklist itself keeps Proposed directors (pre-15) before
 * Subscriber details (pre-16), because the gating and unlock order of live
 * projects depends on it (CR-2026-11 SB-01, owner decision "option A"). Only
 * what people see and export follows this table; never use it to decide which
 * step opens next.
 */
const PART_B_STEP_MCA_SECTIONS: ReadonlyArray<{ stepId: string; section: string }> = [
  { stepId: 'pre-13', section: '3A' },
  { stepId: 'pre-14', section: '4' },
  { stepId: 'pre-16', section: '5–6' },
  { stepId: 'pre-15', section: '7' },
];

const PART_B_STEP_RANK = new Map(PART_B_STEP_MCA_SECTIONS.map((row, index) => [row.stepId, index]));

/** The MCA section number of a Part B step ("5–6" for pre-16), or `null` for any other step. */
export function partBStepMcaSection(stepId: string): string | null {
  return PART_B_STEP_MCA_SECTIONS.find((row) => row.stepId === stepId)?.section ?? null;
}

/**
 * The label a list shows in place of a step number for a Part B step
 * ("MCA 5–6"), so a list in MCA order never shows "Step 9" above "Step 8".
 * Any other step keeps `fallback`.
 */
export function partBStepDisplayLabel(stepId: string, fallback: string): string;
export function partBStepDisplayLabel(stepId: string, fallback?: string): string | undefined;
export function partBStepDisplayLabel(stepId: string, fallback?: string): string | undefined {
  const section = partBStepMcaSection(stepId);
  return section ? `MCA ${section}` : fallback;
}

/**
 * Returns a copy of `items` with the SPICe+ Part B steps in MCA form order. The
 * Part B steps are re-sorted among the places they already hold, so every other
 * item keeps its position and order. This is for display and exports only; the
 * gating order, the "next step" and the "current step" still follow
 * `src/data/checklist.ts`.
 */
export function orderByMcaSection<T>(items: readonly T[], getStepId: (item: T) => string): T[] {
  const out = [...items];
  const slots: number[] = [];
  out.forEach((item, index) => {
    if (PART_B_STEP_RANK.has(getStepId(item))) slots.push(index);
  });
  if (slots.length < 2) return out;
  const partB = slots
    .map((index) => out[index]!)
    .sort((a, b) => PART_B_STEP_RANK.get(getStepId(a))! - PART_B_STEP_RANK.get(getStepId(b))!);
  slots.forEach((slot, i) => {
    out[slot] = partB[i]!;
  });
  return out;
}
