'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, m as motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Unlock,
  Upload,
} from 'lucide-react';
import { ease } from '@/lib/motion';
import { useApp } from '@/context/AppContext';
import { checklist, type ChecklistField, type ChecklistItem } from '@/data/checklist';
import {
  computeMcaNameApprovalExpiryDate,
  extractItemResponses,
  getClientResponseFields,
  appendStepRemarksToVisible,
  INTERN_DELIVERY_STEP_IDS,
  validateInternDelivery,
  type ChecklistItemResponses,
} from '@/lib/checklist-responses';
import { filterFieldsByViewer, isMilestoneFormReadOnly } from '@/lib/checklist-field-access';
import { isDeliveredToClient } from '@/lib/checklist-state-key';
import {
  applyPre1EngagementDefaults,
  countWords,
  directorFieldsToClear,
  formatPre1DateDisplay,
  getPre1VisibleFields,
  parseDirectorCount,
  PRE1_DEFAULT_DIRECTOR_COUNT,
  validatePre1Responses,
} from '@/lib/checklist-pre1-validation';
import {
  getPre6DirectorNameOptions,
  getPre6DirectorSlotsFromPre1,
  clearPre6OtherCompanyInterestFields,
  getPre6OtherCompanyInterestCount,
  getPre6VisibleFields,
  isPre1SubmittedForPre6,
  validatePre6Responses,
} from '@/lib/checklist-pre6-validation';
import { applyPre6PrefillFromPre1 } from '@/lib/pre6-prefill-from-pre1';
import { mergeRegisteredOfficeIntoPre6 } from '@/lib/registered-office-responses';
import { validatePre7Responses } from '@/lib/checklist-pre7-validation';
import { validatePre8Responses } from '@/lib/checklist-pre8-validation';
import { validatePre9Responses } from '@/lib/checklist-pre9-validation';
import { validatePre10Responses } from '@/lib/checklist-pre10-validation';
import { validatePre11Responses } from '@/lib/checklist-pre11-validation';
import { validatePre12Responses } from '@/lib/checklist-pre12-validation';
import {
  filterResponsesToEditableFields,
  isClientSubmissionLocked,
  isFieldEditableForClient,
} from '@/lib/checklist-item-lock';
import {
  canClientResubmit,
  getClientReviewBanner,
  internLeadManagerRequestPatch,
  isReviewAccepted,
} from '@/lib/checklist-item-review';
import {
  findEngagementForClientUser,
  engagementScopeIds,
  checklistStateKeyForEngagement,
} from '@/lib/checklist-state-key';
import {
  fileNameFromStoragePath,
  getMilestoneDocumentSignedUrl,
  uploadMilestoneDocument,
} from '@/lib/milestone-document-storage';
import { regenerateComplianceForEngagement } from '@/lib/compliance/compliance-store';
import { maxUploadSizeLabel } from '@/lib/upload-limits';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { NoirDatePicker } from '@/components/noir/NoirDatePicker';
import { StepIndicator, TrustBadge } from '@/components/noir';
import {
  getSectionPendingItems,
  isSectionFieldsComplete,
  type SectionPendingItem,
} from '@/lib/milestone-section-completion';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import {
  incorpDocTargetFromDraftField,
  isIncorpDraftUrlField,
} from '@/lib/incorporation-docs/client';
import { IncorporationDraftDocLink } from '@/components/incorporation/IncorporationDraftDocLink';
import { MilestoneFileDisplay } from '@/components/incorporation/MilestoneFileDisplay';
import { internEngagementPath, internEngagementStepPath } from '@/lib/project-step-path';
import { internFormNextTarget } from '@/lib/intern-overview-progress';
import { staffSaveStatusLabel, AUTO_SAVE_DEBOUNCE_MS, getChangedPartial, getMilestoneFormFieldLayout, groupFieldsBySection, internAutoSaveHint, internNamedSectionGroups, internSectionFooterAction, internSectionFooterLabel, internShowSaveButton, runStepValidation, computeMilestoneDraftFromSaved, mergeSavedFileFieldsIntoDraft, type AutoSaveStatus, type StaffSaveStatus } from '@/views/incorporation/milestone-response-form-utils';
import { FormErrorSummary, Pre1SectionCard, FieldUnlockControl, UploadedFilePreview } from '@/views/incorporation/MilestoneResponseFormParts';

const COMPLIANCE_TRIGGER_ITEMS = new Set(['pre-12', 'reg-1', 'reg-2', 'reg-3', 'reg-4']);
const DIRECTOR_HAS_DSC_RE = /^director(\d)HasDsc$/;
const PHASE2_STRUCTURED_STEP_IDS = new Set([
  'pre-6',
  'pre-7',
  'pre-8',
  'pre-9',
  'pre-10',
  'pre-11',
  'pre-12',
]);


export interface MilestoneResponseFormStateProps {
  item: ChecklistItem;
  clientId: string;
  engagementId?: string;
  responses?: ChecklistItemResponses;
  variant?: 'admin' | 'client';
  readOnly?: boolean;
  showFieldUnlock?: boolean;
  open?: boolean;
  className?: string;
  compactChrome?: boolean;
  extraFooterActions?: ReactNode;
  aboveFooterActions?: ReactNode;
  sectionTabs?: boolean;
}

export function useMilestoneResponseFormState(props: MilestoneResponseFormStateProps) {
  const {
    item,
    clientId,
    engagementId,
    responses: responsesOverride,
    variant = 'client',
    readOnly = false,
    showFieldUnlock = false,
    open = true,
    className,
    compactChrome = false,
    extraFooterActions,
    aboveFooterActions,
    sectionTabs = false,
  } = props;
  const {
    getState,
    getStateForEngagement,
    updateItem,
    submitChecklistItem,
    setUnlockedFields,
    user,
    engagements,
    updateEngagement,
  } = useApp();
  const allFields = getClientResponseFields(item);
  const fields = useMemo(
    () => filterFieldsByViewer(allFields, variant),
    [allFields, variant],
  );
  const engagement = useMemo(() => {
    const scope = engagementId ?? clientId;
    const byScope = engagements.find((e) => e.id === scope || e.clientId === scope);
    if (byScope) return byScope;
    if (variant === 'client' && user) {
      return findEngagementForClientUser(engagements, user);
    }
    return undefined;
  }, [engagementId, clientId, engagements, user, variant]);

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

  const [draftOverride, setDraftOverride] = useState<ChecklistItemResponses | null>(null);
  const baselineDraft = useMemo(
    () => computeMilestoneDraftFromSaved(item.id, saved, engagement, pre1Responses, pre8Responses),
    [item.id, saved, engagement, pre1Responses, pre8Responses],
  );
  const draft = useMemo(() => {
    const base = draftOverride ?? baselineDraft;
    if (!draftOverride) return base;
    const fileFields = fields.filter((field) => field.type === 'file');
    return mergeSavedFileFieldsIntoDraft(base, saved, fileFields);
  }, [draftOverride, baselineDraft, saved, fields]);

  const pre1Draft = useMemo(
    () =>
      item.id === 'pre-1'
        ? applyPre1EngagementDefaults(
            {
              ...draft,
              directorCount: draft.directorCount || String(PRE1_DEFAULT_DIRECTOR_COUNT),
            },
            engagement,
          )
        : draft,
    [item.id, draft, engagement],
  );
  const visibleFields = useMemo(() => {
    let visible: ChecklistField[];
    if (item.id === 'pre-1') visible = getPre1VisibleFields(fields, pre1Draft);
    else if (item.id === 'pre-6') {
      if (!pre1SubmittedForPre6) visible = [];
      else visible = getPre6VisibleFields(fields, draft, pre1Responses);
    } else visible = fields;
    return appendStepRemarksToVisible(visible, fields);
  }, [item.id, fields, pre1Draft, draft, pre1Responses, pre1SubmittedForPre6]);
  const pre6DirectorSlots = useMemo(
    () => (item.id === 'pre-6' ? getPre6DirectorSlotsFromPre1(pre1Responses) : []),
    [item.id, pre1Responses],
  );
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [staffSaveStatus, setStaffSaveStatus] = useState<StaffSaveStatus>('idle');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [peakEndMoment, setPeakEndMoment] = useState<'submit' | null>(null);

  const isClient = variant === 'client';
  const submissionLocked = isClientSubmissionLocked(itemState);
  const reviewBanner = isClient ? getClientReviewBanner(itemState) : null;
  const clientResubmit = canClientResubmit(itemState);
  const reviewAccepted = isReviewAccepted(itemState);
  const unlockedFields = itemState?.unlockedFields ?? [];
  const isInternDeliveryStep = INTERN_DELIVERY_STEP_IDS.has(item.id);
  const deliveredToClient = isDeliveredToClient(itemState);
  const formReadOnly = isMilestoneFormReadOnly({
    readOnly,
    variant,
    itemId: item.id,
    itemState,
  });

  const unlockedFieldsKey = unlockedFields.join('|');
  const unlockedFieldsSet = useMemo(
    () => new Set(unlockedFieldsKey ? unlockedFieldsKey.split('|').filter(Boolean) : []),
    [unlockedFieldsKey],
  );

  const [optimisticUnlock, setOptimisticUnlock] = useState<Record<string, boolean>>({});
  const displayOptimisticUnlock = useMemo(() => {
    if (Object.keys(optimisticUnlock).length === 0) return optimisticUnlock;
    const serverSet = new Set(unlockedFieldsKey ? unlockedFieldsKey.split('|').filter(Boolean) : []);
    const next: Record<string, boolean> = {};
    for (const [fieldId, value] of Object.entries(optimisticUnlock)) {
      if (serverSet.has(fieldId) !== value) {
        next[fieldId] = value;
      }
    }
    return next;
  }, [optimisticUnlock, unlockedFieldsKey]);

  const isFieldUnlockedForAdmin = useCallback(
    (fieldId: string) => {
      if (fieldId in displayOptimisticUnlock) return displayOptimisticUnlock[fieldId];
      return unlockedFieldsSet.has(fieldId);
    },
    [displayOptimisticUnlock, unlockedFieldsSet],
  );

  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffSavedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEditedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const pendingAfterFlightRef = useRef<ChecklistItemResponses | null>(null);
  const mountedRef = useRef(true);

  // Keep the latest draft/saved available to debounced autosave callbacks and
  // timeouts without listing them as dependencies. Synced in a passive
  // post-commit effect — refs must not be written during render (React 19).
  // Runs before the autosave effects declared below, so they read fresh values.
  useEffect(() => {
    draftRef.current = draft;
    savedRef.current = saved;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canEdit =
    user?.role !== 'client' ||
    (() => {
      if (!user) return false;
      const eng = findEngagementForClientUser(engagements, user);
      if (eng) return engagementScopeIds(eng, user.clientId).includes(clientId);
      return user.clientId != null && user.clientId === clientId;
    })();

  const internWorkspace = Boolean(sectionTabs);
  const internActor = user?.role === 'intern';
  const autoSaveEnabled =
    !formReadOnly &&
    canEdit &&
    (variant === 'client' || (internWorkspace && internActor));
  const scopeId = engagement ? checklistStateKeyForEngagement(engagement) : clientId;

  const flushPendingAutoSave = useCallback(() => {
    const partial = getChangedPartial(fields, draftRef.current, savedRef.current);
    const editablePartial = filterResponsesToEditableFields(itemState, partial, isClient);
    if (Object.keys(editablePartial).length === 0) return;
    void updateItem(scopeId, item.id, { responses: editablePartial }, { clientResponsesOnly: true });
  }, [fields, isClient, item.id, itemState, scopeId, updateItem]);

  const clearDebounce = useCallback(
    (options?: { flush?: boolean }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (options?.flush) flushPendingAutoSave();
    },
    [flushPendingAutoSave],
  );

  const validatePartialForAutoSave = useCallback(
    (responses: ChecklistItemResponses, partial: ChecklistItemResponses): boolean => {
      if (item.id !== 'pre-1' || partial.businessDescription === undefined) return true;
      const words = countWords(responses.businessDescription ?? '');
      if (words > 100) {
        setFieldErrors((prev) => ({
          ...prev,
          businessDescription: `Description must be 100 words or fewer (${words} entered).`,
        }));
        return false;
      }
      setFieldErrors((prev) => {
        if (!prev.businessDescription?.includes('100 words')) return prev;
        const next = { ...prev };
        delete next.businessDescription;
        return next;
      });
      return true;
    },
    [item.id],
  );

  const performSave = useCallback(
    async (partial: ChecklistItemResponses, options?: { explicit?: boolean }) => {
      const editablePartial = filterResponsesToEditableFields(itemState, partial, isClient);
      if (!autoSaveEnabled || Object.keys(editablePartial).length === 0) return;

      if (!validatePartialForAutoSave(draftRef.current, editablePartial)) {
        setAutoSaveStatus('idle');
        return;
      }

      if (saveInFlightRef.current) {
        pendingAfterFlightRef.current = {
          ...(pendingAfterFlightRef.current ?? {}),
          ...partial,
        };
        return;
      }

      saveInFlightRef.current = true;
      setAutoSaveStatus('saving');
      try {
        await updateItem(scopeId, item.id, { responses: editablePartial }, { clientResponsesOnly: true });
        setAutoSaveStatus('saved');
        if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
        savedStatusTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setAutoSaveStatus('idle');
        }, 2000);
      } catch (err) {
        setAutoSaveStatus('error');
        if (options?.explicit) {
          toastError(
            "Couldn't save answers",
            errorMessage(err, 'Check your connection and tap Save now to retry.'),
          );
        }
      } finally {
        saveInFlightRef.current = false;
        const pending = pendingAfterFlightRef.current;
        pendingAfterFlightRef.current = null;
        if (pending && Object.keys(pending).length > 0) {
          void performSave(pending);
        }
      }
    },
    [autoSaveEnabled, isClient, item.id, itemState, scopeId, updateItem, validatePartialForAutoSave],
  );

  const autoSaveStatusRef = useRef(autoSaveStatus);
  // Latest status for scheduleAutoSave (a callback); sync post-commit, not during render.
  useEffect(() => {
    autoSaveStatusRef.current = autoSaveStatus;
  });

  const setDraft = useCallback((updater: ChecklistItemResponses | ((prev: ChecklistItemResponses) => ChecklistItemResponses)) => {
    setDraftOverride((prev) => {
      const current = prev ?? baselineDraft;
      return typeof updater === 'function' ? updater(current) : updater;
    });
  }, [baselineDraft]);

  const scheduleAutoSave = useCallback(
    (immediate = false) => {
      if (!autoSaveEnabled || !userEditedRef.current) return;

      clearDebounce();

      const runPersist = () => {
        const nextPartial = filterResponsesToEditableFields(
          itemState,
          getChangedPartial(fields, draftRef.current, savedRef.current),
          isClient,
        );
        if (Object.keys(nextPartial).length === 0) {
          if (autoSaveStatusRef.current !== 'error') setAutoSaveStatus('idle');
          return;
        }
        void performSave(nextPartial);
      };

      if (immediate) {
        runPersist();
        return;
      }

      // Always schedule: draftRef may still be stale until the post-commit effect.
      setAutoSaveStatus('pending');
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        runPersist();
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    [autoSaveEnabled, clearDebounce, fields, isClient, itemState, performSave],
  );

  useEffect(() => {
    if (!autoSaveEnabled) return;
    return () => {
      clearDebounce({ flush: true });
    };
  }, [autoSaveEnabled, clearDebounce]);

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

  const liveValidationErrors = useMemo(() => {
    if (isPre1) return validatePre1Responses(pre1Draft).errors;
    if (isPre6) {
      if (!pre1SubmittedForPre6) return {};
      return validatePre6Responses(draft, pre1Responses).errors;
    }
    if (item.id === 'pre-7') return validatePre7Responses(draft).errors;
    if (item.id === 'pre-8') return validatePre8Responses(draft).errors;
    if (item.id === 'pre-9') return validatePre9Responses(draft).errors;
    if (item.id === 'pre-10') return validatePre10Responses(draft).errors;
    if (item.id === 'pre-11') return validatePre11Responses(draft).errors;
    if (item.id === 'pre-12') return validatePre12Responses(draft).errors;
    return {};
  }, [isPre1, isPre6, item.id, pre1Draft, draft, pre1Responses, pre1SubmittedForPre6]);

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

  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  useEffect(() => {
    setSelectedSectionIndex(0);
  }, [item.id]);
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
  if (!fields.length || (!canEdit && !formReadOnly)) return null;

  const isFieldLockedForClient = (fieldId: string) =>
    isClient && submissionLocked && !isFieldEditableForClient(itemState, fieldId);

  const toggleFieldUnlock = (fieldId: string) => {
    if (!showFieldUnlock || !submissionLocked) return;
    const nextUnlocked = !isFieldUnlockedForAdmin(fieldId);
    setOptimisticUnlock((prev) => ({ ...prev, [fieldId]: nextUnlocked }));

    const nextSet = new Set(unlockedFields);
    for (const [id, unlocked] of Object.entries({ ...optimisticUnlock, [fieldId]: nextUnlocked })) {
      if (unlocked) nextSet.add(id);
      else nextSet.delete(id);
    }
    const next = [...nextSet];

    void setUnlockedFields(scopeId, item.id, next)
      .then(() => {
        toastSuccess(
          nextUnlocked ? 'Field unlocked' : 'Field locked',
          nextUnlocked
            ? 'The client can edit this field again.'
            : 'This field is read-only for the client.',
        );
      })
      .catch((err) => {
        setOptimisticUnlock((prev) => {
          const { [fieldId]: _removed, ...rest } = prev;
          return rest;
        });
        toastError('Could not update field access', errorMessage(err, 'Try again.'));
      });
  };

  const setField = (fieldId: string, value: string) => {
    userEditedRef.current = true;
    setDraft((prev) => {
      const next: ChecklistItemResponses = { ...prev, [fieldId]: value };
      const hasDscMatch = DIRECTOR_HAS_DSC_RE.exec(fieldId);
      if (hasDscMatch && value !== 'yes') {
        next[`director${hasDscMatch[1]}DscExpiryDate`] = '';
      }
      if (item.id === 'pre-6' && fieldId.endsWith('HasValidDsc')) {
        const prefix = fieldId.slice(0, -'HasValidDsc'.length);
        if (value !== 'yes') next[`${prefix}DscExpiryDate`] = '';
        if (value !== 'no') next[`${prefix}DscAvailabilitySlots`] = '';
      }
      if (item.id === 'pre-6' && fieldId.endsWith('HasOtherCompanyInterest')) {
        const prefix = fieldId.slice(0, -'HasOtherCompanyInterest'.length);
        if (value !== 'yes') {
          Object.assign(next, clearPre6OtherCompanyInterestFields(next, prefix));
        }
      }
      if (item.id === 'pre-6' && fieldId.endsWith('OtherCompanyInterestCount')) {
        const prefix = fieldId.slice(0, -'OtherCompanyInterestCount'.length);
        const keepCount = Number.parseInt(value, 10);
        if (Number.isFinite(keepCount) && keepCount >= 1) {
          Object.assign(
            next,
            clearPre6OtherCompanyInterestFields(next, prefix, { keepCount }),
          );
        }
      }
      if (fieldId === 'parentEntityHasTrademark' && value !== 'yes') {
        next.parentEntityTrademarkUrl = '';
      }
      if (item.id === 'pre-5' && fieldId === 'nameApprovalDate') {
        next.nameApprovalExpiryDate = computeMcaNameApprovalExpiryDate(value);
      }
      return next;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      const hasDscMatch = DIRECTOR_HAS_DSC_RE.exec(fieldId);
      if (hasDscMatch && value !== 'yes') {
        delete next[`director${hasDscMatch[1]}DscExpiryDate`];
      }
      if (item.id === 'pre-6' && fieldId.endsWith('HasValidDsc')) {
        const prefix = fieldId.slice(0, -'HasValidDsc'.length);
        if (value !== 'yes') delete next[`${prefix}DscExpiryDate`];
        if (value !== 'no') delete next[`${prefix}DscAvailabilitySlots`];
      }
      if (item.id === 'pre-6' && fieldId.endsWith('HasOtherCompanyInterest')) {
        const prefix = fieldId.slice(0, -'HasOtherCompanyInterest'.length);
        if (value !== 'yes') {
          for (const key of Object.keys(next)) {
            if (key.startsWith(prefix) && key.includes('OtherCompanyInterest')) {
              delete next[key];
            }
          }
        }
      }
      if (item.id === 'pre-6' && fieldId.endsWith('OtherCompanyInterestCount')) {
        const prefix = fieldId.slice(0, -'OtherCompanyInterestCount'.length);
        const keepCount = getPre6OtherCompanyInterestCount({ ...prev, [fieldId]: value }, prefix);
        for (let i = keepCount + 1; i <= 5; i += 1) {
          for (const part of ['Name', 'Shareholding', 'Designation', 'StartDate', 'EndDate']) {
            delete next[`${prefix}OtherCompanyInterest${i}${part}`];
          }
        }
      }
      if (fieldId === 'parentEntityHasTrademark' && value !== 'yes') {
        delete next.parentEntityTrademarkUrl;
      }
      return next;
    });
    if (autoSaveEnabled) scheduleAutoSave(false);
  };

  const setDirectorCount = (value: string) => {
    userEditedRef.current = true;
    const count = parseDirectorCount({ directorCount: value });
    const clearedIds = directorFieldsToClear(count);
    setDraft((prev) => {
      const next: ChecklistItemResponses = { ...prev, directorCount: value };
      for (const id of clearedIds) {
        next[id] = '';
      }
      return next;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.directorCount;
      for (const id of clearedIds) {
        delete next[id];
      }
      return next;
    });
    if (autoSaveEnabled) scheduleAutoSave(false);
  };

  const handleFilePick = async (fieldId: string, file: File | null) => {
    if (!file || !engagement) {
      return;
    }
    setUploadingField(fieldId);
    try {
      const path = await uploadMilestoneDocument(engagement.id, fieldId, file);
      userEditedRef.current = true;
      setDraft((prev) => ({ ...prev, [fieldId]: path }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      clearDebounce();
      await performSave({ [fieldId]: path });
      toastSuccess('Uploaded', file.name);
    } catch (err) {
      toastError('Upload failed', errorMessage(err, 'Could not upload file.'));
    } finally {
      setUploadingField(null);
    }
  };

  const waitForSaveIdle = async () => {
    if (!saveInFlightRef.current) return;
    await new Promise<void>((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (!saveInFlightRef.current || Date.now() - started > 8000) {
          resolve();
          return;
        }
        window.setTimeout(tick, 40);
      };
      window.setTimeout(tick, 40);
    });
  };

  const handleSaveNow = async () => {
    clearDebounce();

    if (internWorkspace && autoSaveEnabled) {
      const responsesToSave = isPre1 ? pre1Draft : draft;
      const partial = getChangedPartial(fields, responsesToSave, saved);
      const editablePartial = filterResponsesToEditableFields(itemState, partial, isClient);
      if (Object.keys(editablePartial).length === 0 && autoSaveStatus !== 'error') return;
      setSaving(true);
      try {
        await performSave(
          Object.keys(editablePartial).length > 0
            ? editablePartial
            : getChangedPartial(fields, draftRef.current, savedRef.current),
          { explicit: true },
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    const { ok, errors, warnings } = runStepValidation(
      item.id,
      isPre1,
      isPre6,
      pre1Draft,
      draft,
      pre1Responses,
      pre1SubmittedForPre6,
    );
    setFieldErrors(errors);
    setFieldWarnings(warnings);
    if (!ok) {
      toastError(
        'Please fix the highlighted fields',
        'Complete required fields and upload all documents before saving.',
      );
      return;
    }

    const responsesToSave = isPre1 ? pre1Draft : draft;
    const partial = getChangedPartial(fields, responsesToSave, saved);
    const editablePartial = filterResponsesToEditableFields(itemState, partial, isClient);
    if (Object.keys(editablePartial).length === 0) return;

    setSaving(true);
    if (!autoSaveEnabled) setStaffSaveStatus('idle');
    try {
      if (autoSaveEnabled) {
        await performSave(editablePartial, { explicit: true });
      } else {
        await updateItem(
          scopeId,
          item.id,
          { responses: responsesToSave },
          { clientResponsesOnly: true },
        );
        setStaffSaveStatus('saved');
        if (staffSavedStatusTimerRef.current) clearTimeout(staffSavedStatusTimerRef.current);
        staffSavedStatusTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setStaffSaveStatus('idle');
        }, 2000);
        toastSuccess('Saved', `Answers for "${item.title}" were saved.`);
      }
    } catch (err) {
      if (!autoSaveEnabled) {
        setStaffSaveStatus('error');
        toastError(
          "Couldn't save answers",
          errorMessage(err, 'Your answers could not be saved. Try again.'),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInternSubmit = async () => {
    if (!internWorkspace) return;
    clearDebounce();
    pendingAfterFlightRef.current = null;
    await waitForSaveIdle();

    const { ok, errors, warnings } = runStepValidation(
      item.id,
      isPre1,
      isPre6,
      pre1Draft,
      draft,
      pre1Responses,
      pre1SubmittedForPre6,
    );
    setFieldErrors(errors);
    setFieldWarnings(warnings);
    if (!ok) {
      toastError(
        'Please complete required fields',
        'Fix the highlighted items before submitting.',
      );
      if (internSectionNav) {
        const errorIndex = internSectionGroups.findIndex((group) =>
          group.fields.some((field) => errors[field.id]),
        );
        if (errorIndex >= 0) setSelectedSectionIndex(errorIndex);
      }
      return;
    }

    setSubmitting(true);
    try {
      const submitDraft = isPre1 ? pre1Draft : draft;
      await updateItem(scopeId, item.id, {
        responses: submitDraft,
        ...internLeadManagerRequestPatch(itemState),
      });
      toastSuccess(
        'Submitted for review',
        'The manager can review this step in Approvals.',
        { id: `intern-submit:${scopeId}:${item.id}` },
      );
      navigateInternAfterLastTab();
    } catch (err) {
      toastError('Could not submit', errorMessage(err, 'Try again or use Save to keep a draft.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    clearDebounce();

    const { ok, errors, warnings } = runStepValidation(
      item.id,
      isPre1,
      isPre6,
      pre1Draft,
      draft,
      pre1Responses,
      pre1SubmittedForPre6,
    );
    setFieldErrors(errors);
    setFieldWarnings(warnings);
    if (!ok) {
      toastError(
        'Please complete required fields',
        'Fix the highlighted items before submitting for review.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const submitDraft = isPre1 ? pre1Draft : draft;
      const partial = getChangedPartial(fields, submitDraft, saved);
      if (Object.keys(partial).length > 0) {
        await updateItem(scopeId, item.id, { responses: partial }, { clientResponsesOnly: true });
      }
      await submitChecklistItem(scopeId, item.id, submitDraft);
      setPeakEndMoment('submit');
      toastSuccess(
        clientResubmit ? 'Resubmitted for review' : 'Submitted for review',
        'Your engagement team will review your answers shortly.',
      );
    } catch (err) {
      toastError('Could not submit', errorMessage(err, 'Try again or contact your project lead.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeliverToClient = async () => {
    clearDebounce();

    const deliveryDraft = { ...draft };
    if (item.id === 'pre-5' && deliveryDraft.nameApprovalDate?.trim()) {
      deliveryDraft.nameApprovalExpiryDate =
        deliveryDraft.nameApprovalExpiryDate?.trim() ||
        computeMcaNameApprovalExpiryDate(deliveryDraft.nameApprovalDate);
    }

    const { ok, errors } = validateInternDelivery(item.id, deliveryDraft);
    setFieldErrors(errors);
    if (!ok) {
      toastError(
        'Complete required fields',
        'Fill in all required details and upload documents before delivering to the client.',
      );
      return;
    }

    setDelivering(true);
    try {
      await updateItem(
        scopeId,
        item.id,
        { responses: deliveryDraft },
        { clientResponsesOnly: true },
      );
      await updateItem(scopeId, item.id, {
        status: 'completed',
        completedOn: new Date().toISOString(),
        deliveredToClientAt: new Date().toISOString(),
      });
      setDraft(deliveryDraft);
      const wasDelivered = isDeliveredToClient(itemState);
      toastSuccess(
        wasDelivered ? 'Client portal updated' : 'Delivered to client',
        wasDelivered
          ? 'The client will see your latest answers in their portal.'
          : 'The client can now view this step in their portal.',
        { id: `delivered-to-client:${scopeId}:${item.id}` },
      );
      if (item.id === 'pre-12' && deliveryDraft.dateOfIncorporation?.trim() && engagement) {
        const incDate = deliveryDraft.dateOfIncorporation.trim();
        const fullState = {
          ...getStateForEngagement(engagement),
          [item.id]: { ...itemState, responses: deliveryDraft, status: 'completed' as const },
        };
        const updatedEngagement = { ...engagement, incorporationDate: incDate };
        regenerateComplianceForEngagement(updatedEngagement, fullState);
        void updateEngagement(engagement.id, { incorporationDate: incDate }).catch(() => undefined);
      } else if (COMPLIANCE_TRIGGER_ITEMS.has(item.id) && engagement) {
        const fullState = {
          ...getStateForEngagement(engagement),
          [item.id]: { ...itemState, responses: deliveryDraft, status: 'completed' as const },
        };
        regenerateComplianceForEngagement(engagement, fullState);
      }
    } catch (err) {
      toastError('Could not deliver', errorMessage(err, 'Try again or contact your manager.'));
    } finally {
      setDelivering(false);
    }
  };

  const handleRetryAutoSave = () => {
    clearDebounce();
    void performSave(getChangedPartial(fields, draftRef.current, savedRef.current));
  };

  const draftForSave = isPre1 ? pre1Draft : draft;
  const hasChanges = fields.some((f) => (draftForSave[f.id] ?? '') !== (saved[f.id] ?? ''));
  const showStaffSaveFooter = !formReadOnly && canEdit && !isClient;
  const internAutoSave = internWorkspace && autoSaveEnabled;
  const internAutoSaveStatusText = internAutoSave ? internAutoSaveHint(autoSaveStatus) : null;
  const showInternSave = internAutoSave && internShowSaveButton(autoSaveStatus);
  const staffSaveStatusText = staffSaveStatusLabel(staffSaveStatus, hasChanges, saving);

  const fieldShellClass = (field: ChecklistField, stacked: string) =>
    cn(
      'min-w-0',
      stacked,
      getMilestoneFormFieldLayout(field) === 'full' && 'milestone-form-field-full',
    );

  const renderReadOnlyField = (field: ChecklistField, options?: { showUnlock?: boolean }) => {
    const value = (displayValues[field.id] ?? '').trim();
    return (
      <div key={field.id} className={fieldShellClass(field, 'space-y-1.5')}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex-1 text-xs font-medium leading-snug text-muted-foreground">
            {field.label}
          </p>
          <FieldUnlockControl
            field={field}
            showUnlock={options?.showUnlock}
            isUnlocked={isFieldUnlockedForAdmin(field.id)}
            onToggle={() => toggleFieldUnlock(field.id)}
          />
        </div>
        {field.type === 'file' ? (
          value ? (
            engagementId && isIncorpDraftUrlField(field.id) ? (
              (() => {
                const target = incorpDocTargetFromDraftField(field.id)!;
                return (
                  <IncorporationDraftDocLink
                    engagementId={engagementId}
                    checklistItemId="pre-7"
                    doc={target.doc}
                    director={target.audience}
                    storagePath={value}
                    label={field.label}
                    showDocxPreview={false}
                    docxPreviewPlaceholder="Word preview is in the Generate incorporation drafts panel at the top of this step — click Generate first."
                  />
                );
              })()
            ) : (
              <MilestoneFileDisplay storagePath={value} label={field.label} />
            )
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Not provided yet
            </p>
          )
        ) : field.type === 'select' && field.options ? (
          <p
            className={cn(
              'text-sm leading-relaxed',
              value ? 'text-foreground' : 'text-muted-foreground italic',
            )}
          >
            {value
              ? field.id === 'directorCount'
                ? `${value} directors`
                : (field.options.find((o) => o.value === value)?.label ?? value)
              : 'Not provided yet'}
          </p>
        ) : field.type === 'date' ? (
          <p
            className={cn(
              'text-sm leading-relaxed',
              value ? 'text-foreground' : 'text-muted-foreground italic',
            )}
          >
            {value ? formatPre1DateDisplay(value) ?? value : 'Not provided yet'}
          </p>
        ) : (
          <p
            className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap',
              value ? 'text-foreground' : 'text-muted-foreground italic',
            )}
          >
            {value || 'Not provided yet'}
          </p>
        )}
      </div>
    );
  };

  const renderEditableField = (
    field: ChecklistField,
    options?: { showUnlock?: boolean },
  ) => {
    const error = fieldErrors[field.id];
    const warning = fieldWarnings[field.id];
    const wordCount =
      field.type === 'textarea' && field.maxWords
        ? countWords(draft[field.id] ?? '')
        : null;

    return (
      <div key={field.id} className={fieldShellClass(field, compactChrome ? 'space-y-1.5' : 'space-y-2')}>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor={`${item.id}-${field.id}`}
              className="flex-1 text-xs font-medium leading-snug text-muted-foreground"
            >
              {field.label}
              {field.required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
            </Label>
            <FieldUnlockControl
              field={field}
              showUnlock={options?.showUnlock}
              isUnlocked={isFieldUnlockedForAdmin(field.id)}
              onToggle={() => toggleFieldUnlock(field.id)}
            />
          </div>
          {field.helperText && (
            <p className="text-[11px] leading-snug text-muted-foreground">{field.helperText}</p>
          )}
          {field.validationHint && (
            <p className="text-[11px] leading-snug text-muted-foreground">{field.validationHint}</p>
          )}
        </div>

        {field.type === 'textarea' ? (
          <>
            <Textarea
              id={`${item.id}-${field.id}`}
              value={draft[field.id] ?? ''}
              onChange={(e) => setField(field.id, e.target.value)}
              onBlur={() => autoSaveEnabled && scheduleAutoSave(true)}
              placeholder={field.placeholder}
              rows={3}
              className={cn('milestone-form-textarea min-h-[72px] overflow-y-auto', error && 'border-danger')}
            />
            {field.maxWords != null && (
              <p
                className={cn(
                  'text-[11px] tabular-nums',
                  wordCount != null && wordCount > field.maxWords
                    ? 'text-danger'
                    : 'text-muted-foreground',
                )}
              >
                {wordCount ?? 0} / {field.maxWords} words
              </p>
            )}
          </>
        ) : isPre1 && field.id === 'directorCount' && field.options ? (
          <div
            role="radiogroup"
            aria-label={field.label}
            className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border bg-raised/60 p-1"
          >
            {field.options.map((opt) => {
              const selected = pre1Draft.directorCount === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDirectorCount(opt.value)}
                  className={cn(
                    'milestone-segment-option',
                    selected
                      ? 'bg-white text-foreground shadow-sm ring-1 ring-border'
                      : 'text-slate-600 hover:bg-white/70 hover:text-foreground',
                  )}
                >
                  {opt.label} directors
                </button>
              );
            })}
          </div>
        ) : isPre1 && field.id.endsWith('Gender') && field.options ? (
          <div
            role="radiogroup"
            aria-label={field.label}
            className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border bg-raised/60 p-1"
          >
            {field.options.map((opt) => {
              const selected = (draft[field.id] ?? '') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setField(field.id, opt.value)}
                  className={cn(
                    'milestone-segment-option',
                    selected
                      ? 'bg-white text-foreground shadow-sm ring-1 ring-border'
                      : 'text-slate-600 hover:bg-white/70 hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        ) : field.type === 'select' &&
          ((isPre6 &&
            (field.id === 'shareholderAuthorizedPerson' ||
              field.id === 'shareholderNominee')) ||
            field.options) ? (
          (() => {
            const dynamicOptions =
              isPre6 &&
              (field.id === 'shareholderAuthorizedPerson' ||
                field.id === 'shareholderNominee')
                ? getPre6DirectorNameOptions(draft, pre1Responses)
                : field.options ?? [];
            return (
          <Select
            value={draft[field.id] ?? ''}
            onValueChange={(v) => setField(field.id, v)}
          >
            <SelectTrigger
              id={`${item.id}-${field.id}`}
              className={cn('milestone-form-input', error && 'border-danger')}
            >
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {dynamicOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
            );
          })()
        ) : field.type === 'file' ? (
          <div className="space-y-1.5">
            {draft[field.id]?.trim() ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {engagementId && isIncorpDraftUrlField(field.id) ? (
                    (() => {
                      const target = incorpDocTargetFromDraftField(field.id)!;
                      return (
                        <IncorporationDraftDocLink
                          engagementId={engagementId}
                          checklistItemId="pre-7"
                          doc={target.doc}
                          director={target.audience}
                          storagePath={draft[field.id]!}
                          label={field.label}
                          showDocxPreview={false}
                          docxPreviewPlaceholder="Word preview is in the Generate incorporation drafts panel at the top of this step — click Generate first."
                        />
                      );
                    })()
                  ) : (
                    <UploadedFilePreview storagePath={draft[field.id]!} label={field.label} />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={uploadingField === field.id}
                  onClick={() => {
                    setField(field.id, '');
                    if (autoSaveEnabled) {
                      clearDebounce();
                      void performSave({ [field.id]: '' });
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : null}
            <label
              className={cn(
                'milestone-upload-zone',
                error && 'border-danger',
                uploadingField === field.id && 'pointer-events-none opacity-60',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0] ?? null;
                void handleFilePick(field.id, file);
              }}
            >
              {uploadingField === field.id ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-700" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-raised px-2.5 text-xs font-medium text-foreground">
                {uploadingField === field.id
                  ? 'Uploading…'
                  : draft[field.id]?.trim()
                    ? 'Replace file'
                    : 'Choose file'}
              </span>
              <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                PDF, DOCX, or image · max {maxUploadSizeLabel()}
              </span>
              <input
                id={`${item.id}-${field.id}`}
                type="file"
                className="sr-only"
                accept={`${field.accept ?? '.pdf,image/*'},.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document`}
                disabled={uploadingField === field.id}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleFilePick(field.id, file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        ) : field.type === 'date' ? (
          item.id === 'pre-5' && field.id === 'nameApprovalExpiryDate' ? (
            <p
              className={cn(
                'text-sm leading-relaxed',
                draft[field.id]?.trim() ? 'text-foreground' : 'text-muted-foreground italic',
              )}
            >
              {draft[field.id]?.trim()
                ? formatPre1DateDisplay(draft[field.id]) ?? draft[field.id]
                : 'Set the approval date above to calculate expiry'}
            </p>
          ) : (
            <NoirDatePicker
              id={`${item.id}-${field.id}`}
              value={draft[field.id] ?? ''}
              onChange={(v) => setField(field.id, v)}
              onBlur={() => autoSaveEnabled && scheduleAutoSave(true)}
              placeholder={field.placeholder ?? 'Pick a date'}
              className={cn(error && 'border-danger')}
            />
          )
        ) : (
          <Input
            id={`${item.id}-${field.id}`}
            value={draft[field.id] ?? ''}
            onChange={(e) => setField(field.id, e.target.value)}
            onBlur={() => autoSaveEnabled && scheduleAutoSave(true)}
            placeholder={field.placeholder}
            className={cn('milestone-form-input', error && 'border-danger')}
          />
        )}

        {error && <p className="text-[11px] font-medium text-danger">{error}</p>}
        {!error && warning && (
          <p className="text-[11px] text-warning">{warning}</p>
        )}
      </div>
    );
  };

  const showUnlock = showFieldUnlock && submissionLocked && !isClient;
  const groupsForRender =
    internSectionNav && internSectionGroups.length > 0
      ? internSectionGroups.filter((_, index) => index === selectedSectionIndex)
      : sectionGroups;

  const renderedFieldGroups = groupsForRender.map((group, gi) => {
    const fieldsBlock = (
      <div
        className={cn(
          'milestone-form-grid',
          !compactChrome && 'milestone-form-grid-relaxed',
        )}
      >
        {group.fields.map((field) => {
          if (readOnly || formReadOnly || isFieldLockedForClient(field.id)) {
            return renderReadOnlyField(field, { showUnlock });
          }
          return renderEditableField(field, { showUnlock });
        })}
      </div>
    );

    if (internSectionNav && group.section) {
      return (
        <div
          key={group.section}
          role="tabpanel"
          aria-labelledby={`intern-section-tab-${selectedSectionIndex}`}
          className="space-y-3"
        >
          {fieldsBlock}
        </div>
      );
    }

    if ((isPre1 || isPhase2StructuredStep) && group.section) {
      const sectionNum = premiumSectionIndex.get(group.section) ?? gi + 1;
      const pendingItems = getSectionPending(group.fields);
      const complete = pendingItems.length === 0;
      return (
        <Pre1SectionCard
          key={group.section}
          index={sectionNum}
          title={group.section}
          complete={complete}
          pendingItems={pendingItems}
          defaultOpen={!complete}
        >
          {fieldsBlock}
        </Pre1SectionCard>
      );
    }

    return (
      <div key={group.section ?? `ungrouped-${gi}`} className="space-y-3">
        {group.section && !(compactChrome && group.section === item.title) && (
            <p className="text-base font-semibold text-foreground">
              {group.section}
            </p>
        )}
        {fieldsBlock}
      </div>
    );
  });

  const reviewBannerIcon =
    reviewBanner?.tone === 'rejected'
      ? AlertCircle
      : reviewBanner?.tone === 'reviewing'
        ? Clock
        : reviewBanner?.tone === 'accepted'
          ? CheckCircle2
          : null;

  return {
    aboveFooterActions,
    autoSaveEnabled,
    autoSaveStatus,
    canEdit,
    className,
    compactChrome,
    clientResubmit,
    cn,
    completedStructuredSections,
    deliveredToClient,
    delivering,
    fieldErrors,
    formReadOnly,
    extraFooterActions,
    handleDeliverToClient,
    handleInternSectionNext,
    handleInternSubmit,
    handleRetryAutoSave,
    handleSaveNow,
    handleSubmit,
    hasChanges,
    internAutoSave,
    internAutoSaveStatusText,
    internFooterAction,
    internSectionNav,
    internSectionNextLabel,
    isClient,
    isInternDeliveryStep,
    isPhase2StructuredStep,
    isPre1,
    isPre6,
    item,
    peakEndMoment,
    pre1SubmittedForPre6,
    pre6DirectorSlots,
    readOnly,
    renderedFieldGroups,
    reviewAccepted,
    reviewBanner,
    reviewBannerIcon,
    saving,
    sectionCompleteFlags,
    sectionTabs,
    selectedSectionIndex,
    setSelectedSectionIndex,
    showFieldUnlock,
    showInternSave,
    showStaffSaveFooter,
    staffSaveStatus,
    staffSaveStatusText,
    stepPendingItems,
    structuredSectionLabels,
    submissionLocked,
    submitting,
    unlockedFields,
    visibleFields,
  };
}

/**
 * The view-model returned by {@link useMilestoneResponseFormState}, used as the
 * props shape for the presentational view components. Derived from the hook's
 * return value so it can never drift out of sync. The hook may return `null`
 * (when there are no fields / the viewer cannot edit or read); callers guard
 * that before rendering, so the view model excludes `null`.
 */
export type MilestoneResponseFormViewModel = NonNullable<
  ReturnType<typeof useMilestoneResponseFormState>
>;
