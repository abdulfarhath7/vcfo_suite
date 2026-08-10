'use client';

import { CheckCircle2, Loader2, Share2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { GoldButton } from '@/components/noir';
import { useApp } from '@/context/AppContext';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import type { IncorpDraftLabelOptions } from '@/lib/incorporation-docs/paths';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  allIncorpDraftSlotsGenerated,
  generatedIncorpDraftRowKeys,
  incorpDraftSlotCount,
  isBulkIncorpShareComplete,
} from '@/lib/incorporation-docs/share';
import { incorpDraftDocSlotsFromResponses } from '@/lib/incorporation-docs/paths';
import { toastError, toastSuccess, toastEmailDispatch } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

export type IncorpDocFlushRegistrar = (
  key: string,
  flush: (() => Promise<boolean>) | null,
) => void;

type IncorporationDocsBulkShareBarProps = {
  engagementId: string;
  responses: ChecklistItemResponses;
  pre7State?: ChecklistItemStateSlice;
  labelOptions?: IncorpDraftLabelOptions;
  className?: string;
  /** Flush unsaved inline edits from open previews before share. */
  flushAllPreviews?: () => Promise<boolean>;
};

export function IncorporationDocsBulkShareBar({
  engagementId,
  responses,
  pre7State,
  labelOptions,
  className,
  flushAllPreviews,
}: IncorporationDocsBulkShareBarProps) {
  const { refreshEngagementChecklist, suppressChecklistNotification } = useApp();
  const [sharing, setSharing] = useState(false);

  const slots = useMemo(
    () => incorpDraftDocSlotsFromResponses(responses, labelOptions),
    [responses, labelOptions],
  );
  const totalSlots = incorpDraftSlotCount(slots);
  const generatedCount = generatedIncorpDraftRowKeys(slots).length;
  const allGenerated = allIncorpDraftSlotsGenerated(slots);
  const shareComplete = isBulkIncorpShareComplete(responses, pre7State);
  const sharedAt = pre7State?.incorpDraftsSharedAt?.trim();

  const shareAllWithClient = useCallback(async () => {
    setSharing(true);
    try {
      if (flushAllPreviews) {
        const flushed = await flushAllPreviews();
        if (!flushed) return;
      }

      const res = await fetch(`/api/engagements/${engagementId}/incorporation-docs/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        email?: import('@/lib/email/email-dispatch').EmailDispatchResult;
      };
      if (!res.ok || body.ok === false) {
        throw new Error(body.error ?? 'Could not share with client.');
      }
      suppressChecklistNotification(engagementId, 'pre-7', 'docs.share');
      await refreshEngagementChecklist(engagementId);
      toastSuccess(
        'Shared with client',
        'All draft incorporation forms are on the client portal (Pre-8) for download, notarization, and signed upload.',
      );
      toastEmailDispatch(body.email);
    } catch (err) {
      toastError(
        'Could not share with client',
        err instanceof Error ? err.message : 'Try again in a moment.',
      );
    } finally {
      setSharing(false);
    }
  }, [engagementId, flushAllPreviews, refreshEngagementChecklist, suppressChecklistNotification]);

  if (generatedCount === 0) return null;

  return (
    <div
      className={cn(
        'rounded-md border border-orange/40 bg-panel px-4 py-3 space-y-2',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[12px] font-medium text-ink">Share all drafts with client</p>
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            After you generate and review every draft, share them in one step. The client downloads
            each form on <strong>Pre-8</strong>, notarizes or apostilles them, then uploads signed
            copies using the fields on that step.
          </p>
        </div>
        {shareComplete ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success-text shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Shared with client
          </span>
        ) : (
          <GoldButton
            type="button"
            size="sm"
            disabled={sharing || !allGenerated}
            onClick={() => void shareAllWithClient()}
          >
            {sharing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Sharing…
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" aria-hidden />
                Share with client
              </>
            )}
          </GoldButton>
        )}
      </div>
      {!shareComplete && (
        <p className="text-[10px] text-text-tertiary">
          {allGenerated
            ? `${totalSlots}/${totalSlots} drafts ready — click Share when edits are saved.`
            : `${generatedCount}/${totalSlots} drafts generated — generate the remaining forms before sharing.`}
        </p>
      )}
      {shareComplete && sharedAt && (
        <p className="text-[10px] text-text-tertiary">
          Shared{' '}
          {new Date(sharedAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      )}
    </div>
  );
}

/** Register inline preview flush handlers keyed by `doc:director`. */
export function useIncorpDocFlushRegistry() {
  const mapRef = useRef<Map<string, () => Promise<boolean>> | null>(null);
  if (mapRef.current === null) {
    mapRef.current = new Map();
  }

  const register: IncorpDocFlushRegistrar = useCallback((key, flush) => {
    const map = mapRef.current!;
    if (flush) map.set(key, flush);
    else map.delete(key);
  }, []);

  const flushAll = useCallback(async (): Promise<boolean> => {
    const map = mapRef.current!;
    const results = await Promise.all([...map.values()].map((flush) => flush()));
    return results.every(Boolean);
  }, []);

  return { register, flushAll };
}
