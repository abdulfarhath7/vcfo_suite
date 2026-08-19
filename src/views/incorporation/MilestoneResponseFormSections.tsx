'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m as motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Upload,
} from 'lucide-react';
import { ease } from '@/lib/motion';
import { useApp } from '@/context/AppContext';
import { checklist, type ChecklistField, type ChecklistItem } from '@/data/checklist';
import {
  computeMcaNameApprovalExpiryDate,
  extractItemResponses,
  getClientResponseFields,
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


import {
  FormErrorSummary,
  InternSectionHeadingNav,
  SHOW_INTERN_FORM_ERROR_SUMMARY,
} from '@/views/incorporation/MilestoneResponseFormParts';
import { MilestoneResponseFormViewFooters } from '@/views/incorporation/MilestoneResponseFormViewFooters';
import type { MilestoneResponseFormViewModel } from '@/views/incorporation/useMilestoneResponseFormState';

export function MilestoneResponseFormView(p: MilestoneResponseFormViewModel) {
  const {
    autoSaveEnabled,
    autoSaveStatus,
    canEdit,
    className,
    compactChrome,
    cn,
    completedStructuredSections,
    fieldErrors,
    formReadOnly,
    isClient,
    isPhase2StructuredStep,
    isPre1,
    isPre6,
    internSectionNav,
    item,
    peakEndMoment,
    pre1SubmittedForPre6,
    pre6DirectorSlots,
    readOnly,
    renderedFieldGroups,
    reviewBanner,
    reviewBannerIcon,
    saving,
    sectionCompleteFlags,
    sectionTabs,
    selectedSectionIndex,
    setSelectedSectionIndex,
    showStaffSaveFooter,
    structuredSectionLabels,
    submissionLocked,
    submitting,
    unlockedFields,
    visibleFields,
  } = p;

  const internWorkspace = Boolean(sectionTabs);

  return (
    <div
      className={cn(
        internWorkspace
          ? 'surface overflow-hidden'
          : compactChrome
            ? 'space-y-3'
            : (isPre1 || isPre6)
              ? 'mx-auto w-full max-w-3xl space-y-6'
              : 'space-y-4 rounded-md border p-4 sm:p-5',
        !internWorkspace && !compactChrome && !(isPre1 || isPre6) && 'border-border bg-panel',
        className,
      )}
    >
      {peakEndMoment === 'submit' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-raised px-5 py-6 text-center"
        >
          <CheckCircle2 className="w-10 h-10 mx-auto text-success mb-3" aria-hidden />
          <p className="serif text-xl text-foreground">Submitted for review</p>
          <p className="text-sm text-muted-foreground mt-1 prose-narrow mx-auto">
            Your engagement team has been notified. You will hear back once your answers are
            reviewed.
          </p>
          {isClient && (
            <TrustBadge className="mt-4 mx-auto w-fit">Received by VCFO · under review</TrustBadge>
          )}
        </motion.div>
      )}

      {internSectionNav ? (
        <InternSectionHeadingNav
          sections={structuredSectionLabels.map((title, index) => ({
            title,
            complete: sectionCompleteFlags[index] ?? false,
          }))}
          selectedIndex={selectedSectionIndex}
          onSelect={setSelectedSectionIndex}
        />
      ) : (isPre1 || isPhase2StructuredStep) && structuredSectionLabels.length > 0 ? (
        <div className="sticky top-14 z-10 surface px-4 py-3 -mx-0.5">
          <StepIndicator
            current={completedStructuredSections}
            total={structuredSectionLabels.length}
            labels={structuredSectionLabels.slice(0, 4)}
          />
        </div>
      ) : null}

      <div
        className={cn(
          internWorkspace ? 'space-y-4 px-5 py-5' : compactChrome ? 'space-y-3' : 'space-y-5',
          showStaffSaveFooter && !internWorkspace && 'pb-24',
        )}
      >
      {isPre6 && !pre1SubmittedForPre6 && (
        <output
          className="rounded-lg border border-primary/30 bg-primary-light px-4 py-3 text-sm text-foreground block"
        >
          <p className="font-medium">Phase 1 Step 1 required first</p>
          <p className="mt-1 text-muted-foreground">
            Submit proposed directors (count and India residency) in Phase 1 Step 1. Director KYC
            sections here are based on that information.
          </p>
        </output>
      )}

      {isPre6 && pre1SubmittedForPre6 && pre6DirectorSlots.length === 0 && (
        <output
          className="rounded-lg border border-warning/25 bg-warning-light/40 px-4 py-3 text-sm text-foreground block"
        >
          <p className="font-medium">No director KYC sections yet</p>
          <p className="mt-1 text-muted-foreground">
            Set each proposed director&apos;s &quot;Resident of India&quot; in Phase 1 Step 1 to
            show the matching KYC forms.
          </p>
        </output>
      )}

      {Object.keys(fieldErrors).length > 0 &&
        (!internWorkspace || SHOW_INTERN_FORM_ERROR_SUMMARY) && (
          <FormErrorSummary errors={fieldErrors} fields={visibleFields} />
        )}

      {!compactChrome && !internWorkspace && (
      <div className={isPre1 || isPhase2StructuredStep ? 'space-y-1.5 px-0.5' : undefined}>
        {isPre1 || isPhase2StructuredStep ? (
          <div className="space-y-1">
            <p className="eyebrow text-blue-700">
              {isPre1
                ? 'Phase 1 — Name Application'
                : 'Phase 2 — Incorporation'}
            </p>
            <h2 className="display-md text-foreground">{item.title}</h2>
            {!readOnly && isClient && (
              <p className="text-xs leading-relaxed text-muted-foreground pt-0.5">
                {autoSaveEnabled
                  ? 'Fill in each section below — your answers save automatically.'
                  : 'Fill in each section below; your engagement team will use this for filings.'}
              </p>
            )}
            {!readOnly && !isClient && submissionLocked && (
              <p className="text-xs leading-relaxed text-muted-foreground pt-0.5">
                Client submitted this step — edit any field below and save. The client stays
                locked until you unlock fields for them.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {readOnly ? 'Client submission' : 'Your answers'}
            </p>
            {!readOnly && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {autoSaveEnabled
                  ? 'Fill in what you can — your answers save automatically.'
                  : 'Fill in what you can; your engagement team will use this for filings.'}
              </p>
            )}
          </>
        )}
      </div>
      )}

      {reviewBanner && isClient && reviewBannerIcon && (
        <div
          className={cn(
            'milestone-review-banner',
            reviewBanner.tone === 'rejected' &&
              'border-danger/30 bg-danger-light/80',
            reviewBanner.tone === 'reviewing' &&
              'border-primary/30 bg-primary-light',
            reviewBanner.tone === 'accepted' &&
              'border-success/25 bg-success-light',
          )}
        >
          {(() => {
            const Icon = reviewBannerIcon;
            return (
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 mt-0.5',
                  reviewBanner.tone === 'rejected' && 'text-danger',
                  reviewBanner.tone === 'reviewing' && 'text-blue-700',
                  reviewBanner.tone === 'accepted' && 'text-success',
                )}
                aria-hidden
              />
            );
          })()}
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-foreground">{reviewBanner.title}</p>
            {reviewBanner.body && (
              <p className="text-muted-foreground leading-relaxed">{reviewBanner.body}</p>
            )}
            {reviewBanner.tone === 'rejected' && unlockedFields.length > 0 && (
              <p className="text-muted-foreground leading-relaxed">
                Highlighted fields below are unlocked — update them, save, then submit again.
              </p>
            )}
            {reviewBanner.tone === 'rejected' && unlockedFields.length === 0 && (
              <p className="text-muted-foreground leading-relaxed">
                Your engagement team will unlock specific fields for you to edit.
              </p>
            )}
          </div>
        </div>
      )}

        {renderedFieldGroups}
      </div>

      <MilestoneResponseFormViewFooters {...p} />
    </div>
  );
}
