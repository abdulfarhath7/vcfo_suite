import { directorAudienceKind } from '@/lib/incorporation-docs/audiences';
import { PROPOSED_DIRECTORS_STEP_ID } from '@/lib/proposed-directors';
import {
  anyDirectorName,
  authorisedShareCapital,
  companyName,
  directorFormInputs,
  directorInputs,
  directorNationalityInputs,
  directorResidenceProofInputs,
  directorSigningInputs,
  firstNonResident,
  nominalValuePerShare,
  nonResidentDirectorExists,
  paidUpShareCapital,
  parentEntityAddress,
  parentEntityCountry,
  parentEntityName,
  passportOrParentRegistration,
  registeredOfficeAddress,
  registeredOfficeState,
  signatoryDesignation,
  signatoryName,
  subscriberEntryInputs,
  subscribersListed,
  subscriptionPlan,
  subscriptionWitnessInputs,
} from '@/lib/doc-pack/inputs';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import { SUBSCRIBER_DETAILS_STEP_ID } from '@/lib/incorporation-docs/subscription-sheet';
import type { DocDefinition, DocPackContext, DocPackDirector, RequiredInput } from '@/lib/doc-pack/types';

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

/**
 * Documents that exist only because a parent entity incorporates the company
 * (its board resolution, its letters). An independent company never sees them
 * — same rule as the parent-entity sections of Part A (`part-a-sections.ts`).
 */
const hasParentEntity = (ctx: DocPackContext): boolean => ctx.engagement?.ownershipType !== 'independent';

const SUBSCRIPTION_KYC: Parameters<typeof directorInputs>[1] = ['fullName', 'fatherName', 'address', 'dob'];

function subscriberDirectorInputs(director: DocPackDirector): RequiredInput[] {
  return [...directorInputs(director, SUBSCRIPTION_KYC), ...directorNationalityInputs(director)];
}

/** A body corporate listed on `pre-16`: its address (body corporate only) and share count. */
function corporateSubscriberInputs(entryIndex: number, address: string, shares: number): RequiredInput[] {
  const tabId = sectionSlug('Subscribers');
  return [
    {
      key: `subscriber.${entryIndex}.address`,
      label: `Subscriber ${entryIndex} — registered address`,
      stepId: SUBSCRIBER_DETAILS_STEP_ID,
      tabId,
      isPresent: () => Boolean(address.trim()) && !address.startsWith('['),
    },
    {
      key: `subscriber.${entryIndex}.shares`,
      label: `Subscriber ${entryIndex} — number of shares`,
      stepId: SUBSCRIBER_DETAILS_STEP_ID,
      tabId,
      isPresent: () => shares > 0,
    },
  ];
}

/**
 * The sheets follow `planSubscription`: a subscribing company (the parent,
 * or a body corporate on `pre-16`) gets the body-corporate sheet with a
 * director as its representative; individuals only get the individual sheet,
 * one row per `pre-16` subscriber, each of whom must be a proposed director.
 */
function subscriptionSheetInputs(ctx: DocPackContext): RequiredInput[] {
  const plan = subscriptionPlan(ctx);
  const common = [companyName, ...subscriptionWitnessInputs];
  if (plan.variant === 'foreign') {
    const corporate = plan.corporate!;
    const company =
      corporate.entryIndex === null
        ? [parentEntityName, parentEntityAddress, paidUpShareCapital]
        : corporateSubscriberInputs(corporate.entryIndex, corporate.address, corporate.shares);
    const representative = ctx.directors.find((d) => d.audience === plan.representative);
    const person =
      plan.representative === 'non-resident' || !representative
        ? nonResidentLetterInputs(ctx, SUBSCRIPTION_KYC, (nr) => directorNationalityInputs(nr))
        : subscriberDirectorInputs(representative);
    return [...common, ...company, ...person];
  }
  if (plan.individuals.length === 0) return [...common, subscribersListed];
  return [
    ...common,
    ...plan.individuals.flatMap((individual) => {
      const director = individual.audience
        ? ctx.directors.find((d) => d.audience === individual.audience)
        : undefined;
      return [
        ...subscriberEntryInputs(individual.entryIndex, individual.name, Boolean(director), individual.shares),
        ...(director ? subscriberDirectorInputs(director) : []),
      ];
    }),
  ];
}

export const DOC_PACK_REGISTRY: DocDefinition[] = [
  {
    id: 'board-resolution',
    part: 'part-a',
    label: 'Board resolution',
    sourceStepIds: ['pre-1', 'pre-2'],
    appliesToEngagement: hasParentEntity,
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
    requiredInputs: (_ctx, director) => [
      companyName,
      ...(director
        ? [
            ...directorFormInputs(director),
            ...directorNationalityInputs(director),
            ...directorResidenceProofInputs(director),
          ]
        : []),
    ],
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
    appliesTo: (director) => directorAudienceKind(director.audience) === 'non-resident',
    requiredInputs: (_ctx, director) => [
      companyName,
      ...(director
        ? [
            ...directorInputs(director, ['fullName', 'fatherName', 'passport', 'address']),
            ...directorNationalityInputs(director),
            ...directorSigningInputs(director),
          ]
        : []),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'pan-undertaking' },
  },
  {
    id: 'id-address-declaration',
    part: 'part-b',
    label: 'ID & address declaration (Rule 16(1)(m))',
    sourceStepIds: ['pre-5', DIRECTOR_STEP],
    expandsPer: 'director',
    // Owner answer Q1: only directors who already hold a DIN.
    appliesTo: (director) => Boolean(director.director.values.din?.trim()),
    requiredInputs: (_ctx, director) => [
      companyName,
      ...(director
        ? [...directorInputs(director, ['fullName', 'fatherName', 'address']), ...directorSigningInputs(director)]
        : []),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'id-address-declaration' },
  },
  {
    id: 'deposit-declaration',
    part: 'part-b',
    label: 'Deposit declaration',
    sourceStepIds: ['pre-5', DIRECTOR_STEP],
    expandsPer: 'director',
    requiredInputs: (_ctx, director) => [
      companyName,
      ...(director
        ? [...directorInputs(director, ['fullName', 'fatherName', 'address']), ...directorSigningInputs(director)]
        : []),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'deposit-declaration' },
  },
  {
    id: 'moa',
    part: 'part-b',
    label: 'Memorandum of association',
    sourceStepIds: ['pre-1', 'pre-5', 'pre-13', 'pre-14'],
    requiredInputs: () => [
      companyName,
      registeredOfficeAddress,
      registeredOfficeState,
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
    appliesToEngagement: hasParentEntity,
    requiredInputs: (ctx) => [
      companyName,
      parentEntityName,
      parentEntityAddress,
      parentEntityCountry,
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
    appliesToEngagement: hasParentEntity,
    requiredInputs: (ctx) => [
      companyName,
      parentEntityName,
      parentEntityAddress,
      parentEntityCountry,
      ...nonResidentLetterInputs(ctx, ['fullName', 'fatherName', 'passport', 'address']),
    ],
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'acceptance-letter' },
  },
  {
    id: 'moa-subscription-sheet',
    part: 'part-b',
    label: 'MOA subscription sheet',
    sourceStepIds: ['pre-1', 'pre-5', 'pre-7', 'pre-13', DIRECTOR_STEP, 'pre-16'],
    requiredInputs: subscriptionSheetInputs,
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'moa-subscription-sheet' },
  },
  {
    id: 'aoa-subscription-sheet',
    part: 'part-b',
    label: 'AOA subscription sheet',
    sourceStepIds: ['pre-1', 'pre-5', 'pre-7', 'pre-13', DIRECTOR_STEP, 'pre-16'],
    requiredInputs: subscriptionSheetInputs,
    releaseGate: 'directors-accepted',
    generate: { kind: 'incorp', doc: 'aoa-subscription-sheet' },
  },
];

export function docDefinition(id: string): DocDefinition | undefined {
  return DOC_PACK_REGISTRY.find((d) => d.id === id);
}
