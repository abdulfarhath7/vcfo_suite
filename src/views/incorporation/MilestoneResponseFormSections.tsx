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
    fieldErrors,
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
    sectionTabs,
    selectedSectionIndex,
    setSelectedSectionIndex,
    showStaffSaveFooter,
    structuredSectionLabels,
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
        </output>
      )}

      {provenanceNote ? (
        <p className="font-mono text-[11px] text-muted-foreground">{provenanceNote} — edit anything that changed.</p>
      ) : null}

      {isPre6 && pre1SubmittedForPre6 && pre6DirectorSlots.length === 0 && (
        <output
          className="rounded-lg border border-warning/25 bg-warning-light/40 px-4 py-3 text-sm text-foreground block"
        >
          <p className="font-medium">No director KYC sections yet</p>
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
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
          </div>
        </div>
      )}

        {renderedFieldGroups}
      </div>

      <MilestoneResponseFormViewFooters {...p} />
    </div>
  );
}
