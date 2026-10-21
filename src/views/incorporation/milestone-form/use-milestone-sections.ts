import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import { STEP_TAB_PARAM } from '@/lib/doc-pack/paths';
import type { ChecklistField, ChecklistItem } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { runStepValidation } from '@/lib/checklist/checklist-step-validation';
import {
  getSectionPendingItems,
  isSectionFieldsComplete,
} from '@/lib/checklist/milestone-section-completion';
import { internEngagementPath, internEngagementStepPath } from '@/lib/projects/project-step-path';
import { internFormNextTarget } from '@/lib/intern/intern-overview-progress';
import {
  groupFieldsBySection,
  internNamedSectionGroups,
  internSectionFooterAction,
  internSectionFooterLabel,
} from '@/views/incorporation/milestone-response-form-utils';
import { errorKeyInFields, fieldErrorId, PHASE2_STRUCTURED_STEP_IDS } from './helpers';
import type { MilestoneSources } from './use-milestone-sources';
import type { MilestoneDraft } from './use-milestone-draft';
import type { MilestoneAccess } from './use-milestone-access';
import type { MilestoneAutoSave } from './use-milestone-autosave';
import type { MilestoneUiState } from './use-milestone-ui-state';

type MilestoneSectionsParams = {
  item: ChecklistItem;
  sectionTabs: boolean;
  readOnly: boolean;
} & Pick<
  MilestoneSources,
  'ownershipType' | 'pre1Validation' | 'pre1Responses' | 'pre1SubmittedForPre6' | 'directorSlots' | 'engagement' | 'saved'
> &
  Pick<MilestoneDraft, 'draft' | 'pre1Draft' | 'visibleFields'> &
  Pick<MilestoneUiState, 'fieldErrors' | 'fieldWarnings'> &
  Pick<MilestoneAccess, 'formReadOnly'> &
  Pick<MilestoneAutoSave, 'clearDebounce'>;

/**
 * Sections, validation and navigation: the section groups, the one step
 * validator and which errors to show, the intern section tabs (with `?tab=`
 * deep links), focus requests and the Next button's target.
 */
export function useMilestoneSections({
  item,
  sectionTabs,
  readOnly,
  ownershipType,
  pre1Validation,
  pre1Responses,
  pre1SubmittedForPre6,
  directorSlots,
  engagement,
  saved,
  draft,
  pre1Draft,
  visibleFields,
  fieldErrors,
  fieldWarnings,
  formReadOnly,
  clearDebounce,
}: MilestoneSectionsParams) {
  /**
   * Error display rule: before the first Submit, only tabs the user left with
   * Next show their errors; after a failed Submit every tab does, live.
   */
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [visitedSections, setVisitedSections] = useState<ReadonlySet<number>>(() => new Set());
  const pendingFocusRef = useRef<string | null>(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);

  const isPre1 = item.id === 'pre-1';
  const isPre6 = item.id === 'pre-6';
  const isPhase2StructuredStep = PHASE2_STRUCTURED_STEP_IDS.has(item.id);
  const sectionGroups = useMemo(
    () => groupFieldsBySection(visibleFields),
    [visibleFields],
  );
  const premiumSectionIndex = useMemo(() => {
    if (item.id !== 'pre-1' && !isPhase2StructuredStep) return new Map<string, number>();
    const map = new Map<string, number>();
    let n = 0;
    for (const g of sectionGroups) {
      if (g.section && !map.has(g.section)) {
        n += 1;
        map.set(g.section, n);
      }
    }
    return map;
  }, [item.id, isPhase2StructuredStep, sectionGroups]);

  const displayValues = readOnly || formReadOnly ? saved : draft;
  const completionValues = isPre1 ? pre1Draft : draft;

  /** The one step validator — the server runs the same function on Submit. */
  const validateStep = useCallback(
    (responses: ChecklistItemResponses) =>
      runStepValidation({
        itemId: item.id,
        responses,
        ownershipType,
        pre1Validation,
        pre1Responses,
        pre1Submitted: pre1SubmittedForPre6,
        directorSlots,
      }),
    [item.id, ownershipType, pre1Validation, pre1Responses, pre1SubmittedForPre6, directorSlots],
  );

  const liveValidation = useMemo(() => {
    // Legacy pre-6 before Part A is submitted renders no fields; its gate
    // message belongs to Submit, not to every section badge.
    if (isPre6 && !pre1SubmittedForPre6) return { ok: true, errors: {}, warnings: {} };
    return validateStep(isPre1 ? pre1Draft : draft);
  }, [isPre1, isPre6, pre1Draft, draft, pre1SubmittedForPre6, validateStep]);
  const liveValidationErrors = liveValidation.errors;

  const getSectionPending = useCallback(
    (groupFields: ChecklistField[]) =>
      getSectionPendingItems(groupFields, completionValues, liveValidationErrors),
    [completionValues, liveValidationErrors],
  );

  const isSectionComplete = useCallback(
    (groupFields: ChecklistField[]) =>
      isSectionFieldsComplete(groupFields, completionValues, liveValidationErrors),
    [completionValues, liveValidationErrors],
  );

  const internSectionGroups = useMemo(
    () => internNamedSectionGroups(sectionGroups),
    [sectionGroups],
  );
  const internSectionNav = sectionTabs && internSectionGroups.length > 0;

  /** Live errors the user should see now, plus explicit ones (server 422, autosave limits). */
  const shownErrors = useMemo(() => {
    const out: Record<string, string> = {};
    if (submitAttempted) {
      Object.assign(out, liveValidationErrors);
    } else if (internSectionNav) {
      for (const index of visitedSections) {
        const groupFields = internSectionGroups[index]?.fields ?? [];
        for (const [key, message] of Object.entries(liveValidationErrors)) {
          if (errorKeyInFields(key, groupFields)) out[key] = message;
        }
      }
    }
    return { ...out, ...fieldErrors };
  }, [submitAttempted, internSectionNav, visitedSections, internSectionGroups, liveValidationErrors, fieldErrors]);

  const shownWarnings = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, message] of Object.entries(liveValidation.warnings)) {
      if (submitAttempted) out[key] = message;
      else if (
        internSectionNav &&
        [...visitedSections].some((index) => errorKeyInFields(key, internSectionGroups[index]?.fields ?? []))
      ) {
        out[key] = message;
      }
    }
    return { ...out, ...fieldWarnings };
  }, [submitAttempted, internSectionNav, visitedSections, internSectionGroups, liveValidation.warnings, fieldWarnings]);

  const sectionErrorFlags = useMemo(() => {
    if (!internSectionNav) return [] as boolean[];
    const keys = Object.keys(shownErrors);
    return internSectionGroups.map((group) => keys.some((key) => errorKeyInFields(key, group.fields)));
  }, [internSectionNav, internSectionGroups, shownErrors]);

  /** The summary lists every error once the user has tried to submit (tab layout). */
  const summaryErrors = sectionTabs ? (submitAttempted ? shownErrors : {}) : fieldErrors;

  /** Summary line → open the tab that holds the field and move focus to it. */
  const focusField = useCallback(
    (fieldId: string) => {
      if (internSectionNav) {
        const index = internSectionGroups.findIndex((group) => errorKeyInFields(fieldId, group.fields));
        if (index >= 0) setSelectedSectionIndex(index);
      }
      pendingFocusRef.current = fieldId;
      setFocusRequest((n) => n + 1);
    },
    [internSectionNav, internSectionGroups],
  );

  useEffect(() => {
    const fieldId = pendingFocusRef.current;
    if (!fieldId) return;
    const frame = window.requestAnimationFrame(() => {
      pendingFocusRef.current = null;
      const target =
        document.getElementById(`${item.id}-${fieldId}`) ??
        document.getElementById(fieldErrorId(item.id, fieldId));
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRequest, item.id]);

  const structuredSectionLabels = useMemo(() => {
    if (internSectionNav) return internSectionGroups.map((group) => group.section);
    if (!isPre1 && !isPhase2StructuredStep) return [];
    const labels: string[] = [];
    for (const g of sectionGroups) {
      if (g.section) labels.push(g.section);
    }
    return labels;
  }, [internSectionNav, internSectionGroups, isPre1, isPhase2StructuredStep, sectionGroups]);

  const sectionCompleteFlags = useMemo(() => {
    if (!internSectionNav) return [] as boolean[];
    return internSectionGroups.map((group) => isSectionComplete(group.fields));
  }, [internSectionNav, internSectionGroups, isSectionComplete]);

  useEffect(() => {
    setSelectedSectionIndex(0);
  }, [item.id]);
  // `?tab=<section slug>` (document pack deep links) selects that tab once the
  // section list is known; an unknown slug leaves the step on its first tab.
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get(STEP_TAB_PARAM) ?? null;
  useEffect(() => {
    if (!requestedTab) return;
    const index = structuredSectionLabels.findIndex((label) => sectionSlug(label) === requestedTab);
    if (index >= 0) setSelectedSectionIndex(index);
  }, [item.id, requestedTab, structuredSectionLabels]);
  useEffect(() => {
    if (structuredSectionLabels.length === 0) return;
    if (selectedSectionIndex >= structuredSectionLabels.length) {
      setSelectedSectionIndex(0);
    }
  }, [selectedSectionIndex, structuredSectionLabels.length]);

  const internFooterAction = internSectionFooterAction(
    selectedSectionIndex,
    internSectionNav ? internSectionGroups.length : 0,
  );
  const internSectionNextLabel = internSectionFooterLabel(internFooterAction);

  const router = useRouter();
  const navigateInternAfterLastTab = useCallback(() => {
    if (!engagement) return;
    const target = internFormNextTarget(
      item.id,
      selectedSectionIndex,
      internSectionNav ? internSectionGroups.length : 0,
    );
    if (target.kind === 'section') {
      setSelectedSectionIndex(target.index);
      return;
    }
    if (target.kind === 'step') {
      router.push(internEngagementStepPath(engagement, target.item));
      return;
    }
    router.push(internEngagementPath(engagement));
  }, [
    engagement,
    internSectionGroups.length,
    internSectionNav,
    item.id,
    router,
    selectedSectionIndex,
  ]);

  const handleInternSectionNext = useCallback(() => {
    if (!sectionTabs) return;
    clearDebounce({ flush: true });
    setVisitedSections((prev) => new Set(prev).add(selectedSectionIndex));
    const target = internFormNextTarget(
      item.id,
      selectedSectionIndex,
      internSectionNav ? internSectionGroups.length : 0,
    );
    if (target.kind === 'section') {
      setSelectedSectionIndex(target.index);
      return;
    }
    navigateInternAfterLastTab();
  }, [
    clearDebounce,
    internSectionGroups.length,
    internSectionNav,
    item.id,
    navigateInternAfterLastTab,
    sectionTabs,
    selectedSectionIndex,
  ]);

  const completedStructuredSections = useMemo(() => {
    if (!isPre1 && !isPhase2StructuredStep) return 0;
    return sectionGroups.filter((g) => g.section && isSectionComplete(g.fields)).length;
  }, [isPre1, isPhase2StructuredStep, sectionGroups, isSectionComplete]);

  const stepPendingItems = useMemo(() => {
    if (!isPre1 && !isPhase2StructuredStep) return [];
    return sectionGroups.flatMap((g) => getSectionPending(g.fields));
  }, [isPre1, isPhase2StructuredStep, sectionGroups, getSectionPending]);

  return {
    isPre1,
    isPre6,
    isPhase2StructuredStep,
    sectionGroups,
    premiumSectionIndex,
    displayValues,
    validateStep,
    getSectionPending,
    internSectionGroups,
    internSectionNav,
    shownErrors,
    shownWarnings,
    sectionErrorFlags,
    summaryErrors,
    focusField,
    structuredSectionLabels,
    sectionCompleteFlags,
    internFooterAction,
    internSectionNextLabel,
    router,
    navigateInternAfterLastTab,
    handleInternSectionNext,
    completedStructuredSections,
    stepPendingItems,
    submitAttempted,
    setSubmitAttempted,
    selectedSectionIndex,
    setSelectedSectionIndex,
  };
}

export type MilestoneSections = ReturnType<typeof useMilestoneSections>;
