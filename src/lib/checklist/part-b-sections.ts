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
