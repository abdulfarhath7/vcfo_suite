import type { ChecklistField } from '@/data/checklist';
import type { OwnershipType } from '@/data/engagements';

/**
 * SPICe+ Part A (step `pre-1`) — the one place that decides which sections a
 * company sees and in what order.
 *
 * The tab strip, the client record, the attachments menu, the validator and
 * the completeness check all read `partAFieldsFor` / `partAsectionsFor`;
 * nothing else may hard-code a section list or a tab count. Fields stay keyed
 * by id, so reordering here never touches saved responses.
 */
export const PART_A_STEP_ID = 'pre-1';

export const PART_A_SECTION = {
  foreignEntity: 'Foreign Entity',
  foreignEntityProof: 'Foreign Entity Proof',
  authorizedSignatory: 'Authorized Signatory',
  signatoryKyc: 'Signatory KYC',
  proposedNames: 'Proposed Company Names',
  companyMail: 'Company Mail ID',
  companyMobile: 'Company Mobile Number',
  businessDescription: 'Business Description',
  proposedDirectors: 'Proposed Directors',
  shareCapital: 'Share Capital Details',
} as const;

export type PartASection = (typeof PART_A_SECTION)[keyof typeof PART_A_SECTION];

/**
 * Tab order — the MCA SPICe+ Part A sequence: main division of industrial
 * activity (NIC code) with its description, then the proposed name(s). Type /
 * class / category of company precede those on the portal but are project
 * settings here, not Part A answers. The parent-entity block sits together
 * ahead of Signatory KYC because the KYC belongs to the signatory it names.
 * Sections absent from a company's list are skipped, not renumbered.
 */
const PART_A_SECTION_ORDER: readonly PartASection[] = [
  PART_A_SECTION.businessDescription,
  PART_A_SECTION.proposedNames,
  PART_A_SECTION.foreignEntity,
  PART_A_SECTION.foreignEntityProof,
  PART_A_SECTION.authorizedSignatory,
  PART_A_SECTION.signatoryKyc,
  PART_A_SECTION.companyMail,
  PART_A_SECTION.companyMobile,
  PART_A_SECTION.proposedDirectors,
  PART_A_SECTION.shareCapital,
];

/**
 * Sections that exist only because a parent entity is incorporating the
 * company: who it is, its proof, its authorised signatory and their KYC. An
 * independent company has none of them.
 */
const PARENT_ENTITY_SECTIONS: ReadonlySet<string> = new Set([
  PART_A_SECTION.foreignEntity,
  PART_A_SECTION.foreignEntityProof,
  PART_A_SECTION.authorizedSignatory,
  PART_A_SECTION.signatoryKyc,
]);

/** Parent-entity fields that live inside an otherwise shared section. */
const PARENT_ENTITY_FIELD_IDS: ReadonlySet<string> = new Set(['boardResolutionDate']);

export function isParentEntityField(field: Pick<ChecklistField, 'id' | 'section'>): boolean {
  return (
    (field.section !== undefined && PARENT_ENTITY_SECTIONS.has(field.section)) ||
    PARENT_ENTITY_FIELD_IDS.has(field.id)
  );
}

/** The sections this company's Part A shows, in tab order. */
export function partAsectionsFor(ownershipType: OwnershipType | undefined): PartASection[] {
  const independent = ownershipType === 'independent';
  return PART_A_SECTION_ORDER.filter(
    (section) => !independent || !PARENT_ENTITY_SECTIONS.has(section),
  );
}

/**
 * Part A's fields for this company: parent-entity fields dropped for an
 * independent one, the rest sorted into tab order. Fields with no section
 * (the step remarks) keep their place at the end.
 */
export function partAFieldsFor(
  fields: ChecklistField[],
  ownershipType: OwnershipType | undefined,
): ChecklistField[] {
  const independent = ownershipType === 'independent';
  const rank = new Map<string, number>(
    partAsectionsFor(ownershipType).map((section, index) => [section, index]),
  );
  const kept = independent ? fields.filter((field) => !isParentEntityField(field)) : fields;
  // Unknown sections (a field added without a slot here) land after the known
  // ones; section-less fields last.
  const rankOf = (field: ChecklistField) =>
    field.section === undefined
      ? Number.MAX_SAFE_INTEGER
      : (rank.get(field.section) ?? PART_A_SECTION_ORDER.length);
  // Stable: fields inside a section keep their definition order.
  return kept
    .map((field, index) => ({ field, index }))
    .sort((a, b) => rankOf(a.field) - rankOf(b.field) || a.index - b.index)
    .map(({ field }) => field);
}
