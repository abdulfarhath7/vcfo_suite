import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { checklist, type ChecklistItem } from '@/data/checklist';
import {
  extractItemResponses,
  fieldsForOwnership,
  getClientResponseFields,
  type ChecklistItemResponses,
} from '@/lib/checklist/checklist-responses';
import { filterFieldsByViewer } from '@/lib/checklist/checklist-field-access';
import type { Pre1ValidationOptions } from '@/lib/checklist/checklist-pre1-validation';
import { isPre1SubmittedForPre6 } from '@/lib/checklist/checklist-pre6-validation';
import type { DirectorSlotContext } from '@/lib/incorporation/incorp-director-slots';
import { directorAudiencesFromPre6 } from '@/lib/incorporation-docs/audiences';
import { isIncorpSlotSetFrozen } from '@/lib/incorporation-docs/share';
import { directorResponsesFromState } from '@/lib/incorporation/proposed-directors';
import { findEngagementForClientUser } from '@/lib/checklist/checklist-state-key';

export interface MilestoneSourcesParams {
  item: ChecklistItem;
  clientId: string;
  engagementId?: string;
  responsesOverride?: ChecklistItemResponses;
  variant: 'admin' | 'client';
}

/**
 * Where the form's data comes from: the engagement, the step's fields for this
 * viewer, the saved answers, and the upstream steps (Part A, pre-6, pre-8) that
 * some steps read from.
 */
export function useMilestoneSources({
  item,
  clientId,
  engagementId,
  responsesOverride,
  variant,
}: MilestoneSourcesParams) {
  const {
    getState,
    getStateForEngagement,
    updateItem,
    submitChecklistItem,
    submitDirectStep,
    setUnlockedFields,
    user,
    engagements,
  } = useApp();
  const engagement = useMemo(() => {
    const scope = engagementId ?? clientId;
    const byScope = engagements.find((e) => e.id === scope || e.clientId === scope);
    if (byScope) return byScope;
    if (variant === 'client' && user) {
      return findEngagementForClientUser(engagements, user);
    }
    return undefined;
  }, [engagementId, clientId, engagements, user, variant]);
  const ownershipType = engagement?.ownershipType;
  // `getClientResponseFields` builds a fresh array per call. Memoise it, or
  // every callback keyed on `fields` (flush, debounce) is re-created each
  // render and the autosave timer is torn down before it can fire.
  const allFields = useMemo(
    () => fieldsForOwnership(item.id, getClientResponseFields(item), ownershipType),
    [item, ownershipType],
  );
  const fields = useMemo(
    () => filterFieldsByViewer(allFields, variant, item.id),
    [allFields, variant, item.id],
  );
  /** Part A validates only what this company's Part A shows (see `part-a-sections.ts`). */
  const pre1Validation = useMemo<Pre1ValidationOptions>(
    () => ({ visibleFieldIds: new Set(allFields.map((field) => field.id)) }),
    [allFields],
  );

  const itemState = useMemo(
    () => (engagement ? getStateForEngagement(engagement) : getState(clientId))[item.id],
    [engagement, getStateForEngagement, getState, clientId, item.id],
  );

  const contextResponses = useMemo(
    () => extractItemResponses(item, itemState),
    [item, itemState],
  );

  const saved = useMemo(() => {
    if (responsesOverride === undefined) return contextResponses;
    return { ...contextResponses, ...responsesOverride };
  }, [responsesOverride, contextResponses]);

  const pre1Item = useMemo(() => checklist.find((c) => c.id === 'pre-1'), []);
  const pre1State = useMemo(() => {
    if (!engagement) return undefined;
    return getStateForEngagement(engagement)['pre-1'];
  }, [engagement, getStateForEngagement]);
  const pre1Responses = useMemo(() => {
    if (!pre1Item) return {};
    return extractItemResponses(pre1Item, pre1State);
  }, [pre1Item, pre1State]);
  const pre1SubmittedForPre6 = isPre1SubmittedForPre6(pre1State);
  const pre8Item = useMemo(() => checklist.find((c) => c.id === 'pre-8'), []);
  const pre8State = useMemo(() => {
    if (!engagement) return undefined;
    return getStateForEngagement(engagement)['pre-8'];
  }, [engagement, getStateForEngagement]);
  const pre8Responses = useMemo(() => {
    if (!pre8Item) return {};
    return extractItemResponses(pre8Item, pre8State);
  }, [pre8Item, pre8State]);
  /** Legacy Director KYC answers — the registered office used to live there. */
  const pre6Responses = useMemo(() => {
    const pre6Item = checklist.find((c) => c.id === 'pre-6');
    if (!engagement || !pre6Item) return {};
    return extractItemResponses(pre6Item, getStateForEngagement(engagement)['pre-6']);
  }, [engagement, getStateForEngagement]);
  /** Pre-7 / pre-8 per-director fields follow the directors on file (`incorp-director-slots.ts`). */
  const directorSlots = useMemo<DirectorSlotContext | undefined>(() => {
    if (item.id !== 'pre-7' && item.id !== 'pre-8') return undefined;
    const state = engagement ? getStateForEngagement(engagement) : getState(clientId);
    return {
      directors: directorAudiencesFromPre6(directorResponsesFromState(state).pre6),
      frozen:
        item.id === 'pre-7' ? isIncorpSlotSetFrozen(itemState) : itemState?.reviewStatus === 'accepted',
    };
  }, [item.id, engagement, getStateForEngagement, getState, clientId, itemState]);

  return {
    updateItem,
    submitChecklistItem,
    submitDirectStep,
    setUnlockedFields,
    user,
    engagements,
    engagement,
    ownershipType,
    fields,
    pre1Validation,
    itemState,
    saved,
    pre1Responses,
    pre1SubmittedForPre6,
    pre8Responses,
    pre6Responses,
    directorSlots,
  };
}

export type MilestoneSources = ReturnType<typeof useMilestoneSources>;
