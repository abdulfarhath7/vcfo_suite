import { PROPOSED_DIRECTORS_STEP_ID } from '@/lib/proposed-directors';
import {
  anyDirectorName,
  authorisedShareCapital,
  companyName,
  directorFormInputs,
  directorInputs,
  firstNonResident,
  nominalValuePerShare,
  nonResidentDirectorExists,
  paidUpShareCapital,
  parentEntityAddress,
  parentEntityName,
  passportOrParentRegistration,
  registeredOfficeAddress,
  signatoryDesignation,
  signatoryName,
} from '@/lib/doc-pack/inputs';
import type { DocDefinition, DocPackContext, RequiredInput } from '@/lib/doc-pack/types';

/**
 * One definition per document the app generates today, and nothing else
 * (Phase 0 discovery, `docs/doc-pack/DISCOVERY.md` §1). Required inputs
 * follow the generators' own missing-field collectors so the pack agrees
 * with the generate route.
 */

const DIRECTOR_STEP = PROPOSED_DIRECTORS_STEP_ID;

/** Inputs for the documents written for the first non-resident director. */
function nonResidentLetterInputs(
  ctx: DocPackContext,
  fields: Parameters<typeof directorInputs>[1],
  extra: (director: NonNullable<ReturnType<typeof firstNonResident>>) => RequiredInput[] = () => [],
): RequiredInput[] {
  const nr = firstNonResident(ctx);
  if (!nr) return [nonResidentDirectorExists];
  return [...directorInputs(nr, fields), ...extra(nr)];
}

export const DOC_PACK_REGISTRY: DocDefinition[] = [
  {
    id: 'board-resolution',
    part: 'part-a',
    label: 'Board resolution',
    sourceStepIds: ['pre-1', 'pre-2'],
    requiredInputs: () => [],
    releaseGate: 'br-finalized',
    generate: { kind: 'board-resolution' },
  },
  {
    id: 'dir-2',
    part: 'part-b',
    label: 'DIR-2 consent to act as director',
    sourceStepIds: ['pre-5', DIRECTOR_STEP],
    expandsPer: 'director',
    requiredInputs: (_ctx, director) => [companyName, ...(director ? directorFormInputs(director) : [])],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'dir-2' },
  },
  {
    id: 'dir-8',
    part: 'part-b',
    label: 'DIR-8 intimation of disqualification',
    sourceStepIds: ['pre-5', DIRECTOR_STEP],
    expandsPer: 'director',
    requiredInputs: (_ctx, director) => [companyName, ...(director ? directorFormInputs(director) : [])],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'dir-8' },
  },
  {
    id: 'inc-9',
    part: 'part-b',
    label: 'INC-9 declaration by first director',
    sourceStepIds: ['pre-5', DIRECTOR_STEP],
    expandsPer: 'director',
    requiredInputs: (_ctx, director) => [companyName, ...(director ? directorFormInputs(director) : [])],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'inc-9' },
  },
  {
    id: 'pan-undertaking',
    part: 'part-b',
    label: 'PAN undertaking',
    sourceStepIds: ['pre-5', DIRECTOR_STEP],
    expandsPer: 'director',
    appliesTo: (director) => director.audience === 'non-resident',
    requiredInputs: (_ctx, director) => [
      companyName,
      ...(director ? directorInputs(director, ['fullName', 'fatherName', 'passport', 'address']) : []),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'pan-undertaking' },
  },
  {
    id: 'moa',
    part: 'part-b',
    label: 'Memorandum of association',
    sourceStepIds: ['pre-1', 'pre-5', 'pre-14'],
    requiredInputs: () => [
      companyName,
      registeredOfficeAddress,
      authorisedShareCapital,
      paidUpShareCapital,
      nominalValuePerShare,
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'moa' },
  },
  {
    id: 'aoa',
    part: 'part-b',
    label: 'Articles of association',
    sourceStepIds: ['pre-5', DIRECTOR_STEP],
    requiredInputs: () => [companyName, anyDirectorName],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'aoa' },
  },
  {
    id: 'authorisation-letter',
    part: 'part-b',
    label: 'Authorisation letter',
    sourceStepIds: ['pre-1', 'pre-5', DIRECTOR_STEP],
    requiredInputs: (ctx) => [
      companyName,
      parentEntityName,
      parentEntityAddress,
      signatoryName,
      signatoryDesignation,
      ...nonResidentLetterInputs(ctx, ['fullName', 'address'], (nr) => [passportOrParentRegistration(nr)]),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'authorisation-letter' },
  },
  {
    id: 'acceptance-letter',
    part: 'part-b',
    label: 'Acceptance letter',
    sourceStepIds: ['pre-1', 'pre-5', DIRECTOR_STEP],
    requiredInputs: (ctx) => [
      companyName,
      parentEntityName,
      parentEntityAddress,
      ...nonResidentLetterInputs(ctx, ['fullName', 'fatherName', 'passport', 'address']),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'acceptance-letter' },
  },
  {
    id: 'moa-subscription-sheet',
    part: 'part-b',
    label: 'MOA subscription sheet',
    sourceStepIds: ['pre-1', 'pre-5', DIRECTOR_STEP],
    requiredInputs: (ctx) => [
      companyName,
      parentEntityName,
      parentEntityAddress,
      paidUpShareCapital,
      ...nonResidentLetterInputs(ctx, ['fullName', 'fatherName', 'address', 'dob']),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'moa-subscription-sheet' },
  },
  {
    id: 'aoa-subscription-sheet',
    part: 'part-b',
    label: 'AOA subscription sheet',
    sourceStepIds: ['pre-1', 'pre-5', DIRECTOR_STEP],
    requiredInputs: (ctx) => [
      companyName,
      parentEntityName,
      parentEntityAddress,
      paidUpShareCapital,
      ...nonResidentLetterInputs(ctx, ['fullName', 'fatherName', 'address', 'dob']),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'aoa-subscription-sheet' },
  },
];

export function docDefinition(id: string): DocDefinition | undefined {
  return DOC_PACK_REGISTRY.find((d) => d.id === id);
}
