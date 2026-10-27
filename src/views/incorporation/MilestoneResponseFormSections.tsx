'use client';

import { m as motion } from 'framer-motion';
import {
  CheckCircle2,
} from 'lucide-react';
















import { StepIndicator, TrustBadge } from '@/components/noir';







import {
  FormErrorSummary,
  InternSectionHeadingNav,
  SHOW_INTERN_FORM_ERROR_SUMMARY,
} from '@/views/incorporation/MilestoneResponseFormParts';
import { MilestoneResponseFormViewFooters } from '@/views/incorporation/MilestoneResponseFormViewFooters';
import type { MilestoneResponseFormViewModel } from '@/views/incorporation/useMilestoneResponseFormState';

export function MilestoneResponseFormView(p: MilestoneResponseFormViewModel) {
  const {
    className,
    compactChrome,
    cn,
    completedStructuredSections,
    fieldLabelFor,
    focusField,
    isClient,
    isPhase2StructuredStep,
    isPre1,
    isPre6,
    internSectionNav,
    provenanceNote,
    item,
    peakEndMoment,
    pre1SubmittedForPre6,
    pre6DirectorSlots,
    readOnly,
    renderedFieldGroups,
    reviewBanner,
    reviewBannerIcon,
    sectionCompleteFlags,
    sectionErrorFlags,
    sectionTabs,
    selectedSectionIndex,
    setSelectedSectionIndex,
    showStaffSaveFooter,
    structuredSectionLabels,
    summaryErrors,
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
        !internWorkspace && !compactChrome && !(isPre1 || isPre6) && 'border-line bg-surface-raised',
        className,
      )}
    >
      {peakEndMoment === 'submit' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-raised px-5 py-6 text-center"
        >
          <CheckCircle2 className="w-10 h-10 mx-auto text-positive mb-3" aria-hidden />
          <p className="serif text-xl text-ink">Submitted for review</p>
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
            hasErrors: sectionErrorFlags[index] ?? false,
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
          className="rounded-lg border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-ink block"
        >
          <p className="font-medium">Phase 1 Step 1 required first</p>
        </output>
      )}

      {provenanceNote ? (
        <p className="text-[11px] text-ink-muted">{provenanceNote} — edit anything that changed.</p>
      ) : null}

      {isPre6 && pre1SubmittedForPre6 && pre6DirectorSlots.length === 0 && (
        <output
          className="rounded-lg border border-warning/25 bg-warning-soft/40 px-4 py-3 text-sm text-ink block"
        >
          <p className="font-medium">No director KYC sections yet</p>
        </output>
      )}

      {Object.keys(summaryErrors).length > 0 &&
        (!internWorkspace || SHOW_INTERN_FORM_ERROR_SUMMARY) && (
          <FormErrorSummary
            errors={summaryErrors}
            fields={visibleFields}
            labelFor={fieldLabelFor}
            onSelect={focusField}
          />
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
            <h2 className="display-md text-ink">{item.title}</h2>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {readOnly ? 'Client submission' : 'Your answers'}
            </p>
          </>
        )}
      </div>
      )}

      {reviewBanner && isClient && reviewBannerIcon && (
        <div
          className={cn(
            'milestone-review-banner',
            reviewBanner.tone === 'rejected' &&
              'border-danger/30 bg-danger-soft/80',
            reviewBanner.tone === 'reviewing' &&
              'border-brand/30 bg-brand-soft',
            reviewBanner.tone === 'accepted' &&
              'border-positive/25 bg-positive-soft',
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
                  reviewBanner.tone === 'accepted' && 'text-positive',
                )}
                aria-hidden
              />
            );
          })()}
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-ink">{reviewBanner.title}</p>
            {reviewBanner.body && (
              <p className="text-ink-muted leading-relaxed">{reviewBanner.body}</p>
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
