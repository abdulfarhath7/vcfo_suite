'use client';

import { AlertCircle, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MilestoneResponseFormViewModel } from '@/views/incorporation/useMilestoneResponseFormState';

export function MilestoneResponseFormViewFooters(p: MilestoneResponseFormViewModel) {
  const {
    autoSaveEnabled,
    autoSaveStatus,
    canEdit,
    clientResubmit,
    cn,
    deliveredToClient,
    delivering,
    formReadOnly,
    handleDeliverToClient,
    handleRetryAutoSave,
    handleSaveNow,
    handleSubmit,
    hasChanges,
    isClient,
    isInternDeliveryStep,
    isPhase2StructuredStep,
    isPre1,
    reviewAccepted,
    saving,
    showStaffSaveFooter,
    staffSaveStatus,
    staffSaveStatusText,
    submissionLocked,
    submitting,
    unlockedFields,
  } = p;

  return (
    <>
      {!formReadOnly && canEdit && isClient && !submissionLocked && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 border-t border-border/70 pt-4',
            (isPre1 || isPhase2StructuredStep) && 'surface px-4 py-4 sm:px-5',
          )}
        >
          {autoSaveEnabled && (
            <div
              aria-live="polite"
              className="flex min-h-[20px] items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              {(autoSaveStatus === 'pending' || autoSaveStatus === 'saving') && (
                <>
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                  <span>Saving…</span>
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <>
                  <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                  <span>Saved</span>
                </>
              )}
              {autoSaveStatus === 'error' && (
                <button
                  type="button"
                  onClick={handleRetryAutoSave}
                  className="cursor-pointer text-danger hover:underline"
                >
                  Couldn&apos;t save — retry
                </button>
              )}
            </div>
          )}
          {(autoSaveEnabled ? hasChanges || autoSaveStatus === 'error' : hasChanges) && (
            <Button
              type="button"
              size="sm"
              variant={autoSaveEnabled ? 'outline' : 'default'}
              onClick={() => void handleSaveNow()}
              disabled={
                saving || autoSaveStatus === 'saving' || (!autoSaveEnabled && !hasChanges)
              }
              className={cn(
                'cursor-pointer',
                !autoSaveEnabled && isClient && 'bg-blue-600 text-white hover:bg-blue-600/90',
              )}
            >
              {saving || autoSaveStatus === 'saving'
                ? 'Saving…'
                : autoSaveEnabled
                  ? 'Save now'
                  : 'Save answers'}
            </Button>
          )}
          {isClient && (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitting || saving || autoSaveStatus === 'saving'}
              className="cursor-pointer bg-blue-600 text-white hover:bg-blue-600/90"
            >
              {submitting ? 'Submitting…' : 'Submit for review'}
            </Button>
          )}
        </div>
      )}

      {showStaffSaveFooter && (
        <div
          className={cn(
            'sticky bottom-0 z-20 -mx-0.5 mt-4 border-t border-border/70 bg-panel/95 backdrop-blur-sm supports-[backdrop-filter]:bg-panel/80',
            (isPre1 || isPhase2StructuredStep) && 'px-4 py-3 sm:px-5',
            !(isPre1 || isPhase2StructuredStep) && 'px-4 py-3',
          )}
        >
          {deliveredToClient && isInternDeliveryStep && (
            <p className="mb-2 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Delivered to client
              </span>
              <span className="mt-1 block">
                You can still edit below. Save changes to update records, or use Update client
                portal to push corrections to the client view.
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              aria-live="polite"
              className="flex min-h-[20px] items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              {staffSaveStatusText && (
                <>
                  {saving && <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />}
                  {!saving && staffSaveStatus === 'saved' && (
                    <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                  )}
                  {!saving && staffSaveStatus === 'error' && (
                    <AlertCircle className="h-3 w-3 shrink-0 text-danger" aria-hidden />
                  )}
                  <span>{staffSaveStatusText}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveNow()}
                disabled={saving || (!hasChanges && staffSaveStatus !== 'error')}
                className="cursor-pointer bg-blue-600 text-white hover:bg-blue-600/90"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {isInternDeliveryStep && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDeliverToClient()}
                  disabled={delivering || saving}
                  className="cursor-pointer"
                >
                  {delivering
                    ? 'Updating…'
                    : deliveredToClient
                      ? 'Update client portal'
                      : 'Deliver to client'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!formReadOnly && canEdit && isClient && submissionLocked && !reviewAccepted && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 border-t border-border/70 pt-4',
            (isPre1 || isPhase2StructuredStep) && 'surface px-4 py-4 sm:px-5',
          )}
        >
          {autoSaveEnabled && unlockedFields.length > 0 && (
            <div
              aria-live="polite"
              className="flex min-h-[20px] items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              {(autoSaveStatus === 'pending' || autoSaveStatus === 'saving') && (
                <>
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                  <span>Saving…</span>
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <>
                  <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                  <span>Saved</span>
                </>
              )}
              {autoSaveStatus === 'error' && (
                <button
                  type="button"
                  onClick={handleRetryAutoSave}
                  className="cursor-pointer text-danger hover:underline"
                >
                  Couldn&apos;t save — retry
                </button>
              )}
            </div>
          )}
          {unlockedFields.length > 0 && (hasChanges || autoSaveStatus === 'error') && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleSaveNow()}
              disabled={saving || autoSaveStatus === 'saving'}
              className="cursor-pointer"
            >
              {saving || autoSaveStatus === 'saving' ? 'Saving…' : 'Save changes'}
            </Button>
          )}
          {clientResubmit && (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitting || saving || autoSaveStatus === 'saving'}
              className="cursor-pointer bg-blue-600 text-white hover:bg-blue-600/90"
            >
              {submitting ? 'Submitting…' : 'Submit again for review'}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
