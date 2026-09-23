'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useApp } from '@/context/AppContext';
import { directorResponsesFromState } from '@/lib/proposed-directors';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  INCORP_DOC_DEFINITIONS,
  incorpDocRowKey,
  incorpDraftDocSlotsFromResponses,
  responsePatchFromPaths,
  type IncorpDocKind,
  type IncorpDocPaths,
} from '@/lib/incorporation-docs/client';
import { draftUrlFieldFor } from '@/lib/incorporation-docs/types';
import { isIncorpSlotSetFrozen } from '@/lib/incorporation-docs/share';
import { formatIncorpDocsErrorDisplay } from '@/lib/api/incorporation-docs-errors';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { AccentButton } from '@/components/noir';
import {
  IncorporationDocsBulkShareBar,
  useIncorpDocFlushRegistry,
} from '@/components/incorporation/IncorporationDocsBulkShareBar';
import { IncorporationDraftDocsGenerateList } from '@/components/incorporation/IncorporationDocInlinePreview';

interface IncorporationDocsGeneratePanelProps {
  engagement: Engagement;
  responses: ChecklistItemResponses;
  className?: string;
}

type GenerateState = 'idle' | 'loading';

type GenerateApiResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  missingFields?: string[];
  paths?: IncorpDocPaths;
  responsePatch?: Record<string, string>;
};

/** Director forms summarised in the header, in this order. */
const STATUS_DOCS: IncorpDocKind[] = ['dir-2', 'dir-8', 'inc-9', 'pan-undertaking'];

function unlockRowKeysFromPatch(patch: Record<string, string>): string[] {
  const keys: string[] = [];
  // The patch's own draft fields name their audiences, so later directors unlock too.
  const slots = incorpDraftDocSlotsFromResponses(patch);
  for (const [fieldId, path] of Object.entries(patch)) {
    if (!path.trim()) continue;
    for (const slot of slots) {
      if (draftUrlFieldFor(slot.doc, slot.audience) === fieldId) {
        keys.push(incorpDocRowKey(slot.doc, slot.audience));
      }
    }
  }
  return keys;
}

function unlockRowKeysFromPaths(paths: IncorpDocPaths): string[] {
  const keys: string[] = [];
  for (const doc of Object.keys(paths) as IncorpDocKind[]) {
    const byDirector = paths[doc];
    if (!byDirector) continue;
    for (const audience of Object.keys(byDirector) as import('@/lib/incorporation-docs/shared').IncorpDocAudience[]) {
      if (byDirector[audience]?.trim()) {
        keys.push(incorpDocRowKey(doc, audience));
      }
    }
  }
  return keys;
}

export function IncorporationDocsGeneratePanel({
  engagement,
  responses,
  className,
}: IncorporationDocsGeneratePanelProps) {
  const { refreshEngagementChecklist, mergeEngagementChecklistResponses, getStateForEngagement } =
    useApp();
  const { register: onFlushRegister, flushAll: flushAllPreviews } = useIncorpDocFlushRegistry();
  const pre7State = getStateForEngagement(engagement)['pre-7'];
  // Director names for the draft labels — from `pre-15` entries, legacy `pre-6` otherwise.
  const pre6Responses = useMemo(
    () => directorResponsesFromState(getStateForEngagement(engagement)).pre6,
    [engagement, getStateForEngagement],
  );
  const labelOptions = useMemo(
    () => ({ pre6: pre6Responses, frozen: isIncorpSlotSetFrozen(pre7State) }),
    [pre6Responses, pre7State],
  );
  const [state, setState] = useState<GenerateState>('idle');
  const [recentPaths, setRecentPaths] = useState<IncorpDocPaths | null>(null);
  const [slotPaths, setSlotPaths] = useState<Record<string, string>>({});
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(() => new Set());

  const mergedResponses = useMemo(() => {
    const patch = recentPaths ? responsePatchFromPaths(recentPaths) : {};
    return { ...responses, ...patch, ...slotPaths };
  }, [recentPaths, responses, slotPaths]);

  const docSlots = useMemo(
    () => incorpDraftDocSlotsFromResponses(mergedResponses, labelOptions),
    [mergedResponses, labelOptions],
  );

  const statusSummary = useMemo(() => {
    return STATUS_DOCS.flatMap((doc) => {
      const docSlotsForKind = docSlots.filter((s) => s.doc === doc);
      if (docSlotsForKind.length === 0) return [];
      const saved = docSlotsForKind.filter((s) => s.path.trim()).length;
      return [`${INCORP_DOC_DEFINITIONS[doc].label}: ${saved}/${docSlotsForKind.length}`];
    }).join(' · ');
  }, [docSlots]);

  const addUnlockedKeys = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setUnlockedKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) next.add(key);
      return next;
    });
  }, []);

  const generate = useCallback(
    async (docs?: IncorpDocKind[]) => {
      setState('loading');
      try {
        const res = await fetch(`/api/engagements/${engagement.id}/incorporation-docs/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docs?.length ? { docs } : {}),
        });
        const body = (await res.json()) as GenerateApiResponse;
        if (!res.ok || body.ok === false) {
          const display = formatIncorpDocsErrorDisplay({
            ok: false,
            error: body.error,
            code: body.code as import('@/lib/api/incorporation-docs-errors').IncorpDocsErrorCode | undefined,
            missingFields: body.missingFields,
          });
          throw new Error(
            display.missingFields?.length
              ? `${display.description}`
              : (body.error ?? display.description),
          );
        }

        const responsePatch =
          body.responsePatch ??
          (body.paths ? responsePatchFromPaths(body.paths) : {});

        if (Object.keys(responsePatch).length > 0) {
          mergeEngagementChecklistResponses(engagement.id, 'pre-7', responsePatch);
          setSlotPaths((prev) => ({ ...prev, ...responsePatch }));
          addUnlockedKeys(unlockRowKeysFromPatch(responsePatch));
        }
        if (body.paths && Object.keys(body.paths).length > 0) {
          setRecentPaths(body.paths);
          addUnlockedKeys(unlockRowKeysFromPaths(body.paths));
        }

        await refreshEngagementChecklist(engagement.id);

        const label = docs?.length
          ? docs.map((d) => INCORP_DOC_DEFINITIONS[d].label).join(', ')
          : 'All incorporation drafts';
        toastSuccess(`${label} generated`, 'Draft documents saved to Pre-7 — share with client when all drafts are ready.');
      } catch (err) {
        toastError(
          'Could not generate documents',
          err instanceof Error ? err.message : 'Try again in a moment.',
        );
      } finally {
        setState('idle');
      }
    },
    [addUnlockedKeys, engagement.id, mergeEngagementChecklistResponses, refreshEngagementChecklist],
  );

  const handleUnlockKey = useCallback((key: string) => {
    setUnlockedKeys((prev) => new Set(prev).add(key));
  }, []);

  const handleSlotPathChange = useCallback((key: string, path: string) => {
    const [doc, audience] = key.split(':') as [IncorpDocKind, import('@/lib/incorporation-docs/shared').IncorpDocAudience];
    const fieldId = draftUrlFieldFor(doc, audience);
    if (fieldId) {
      setSlotPaths((prev) => ({ ...prev, [fieldId]: path }));
    }
  }, []);

  return (
    <div
      className={cn(
        'rounded-md border border-primary/30 bg-primary/5 px-4 py-3 space-y-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[13px] font-medium text-ink">Generate incorporation drafts</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AccentButton
          type="button"
          size="sm"
          disabled={state === 'loading'}
          onClick={() => void generate()}
        >
          {state === 'loading' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Generating…
            </>
          ) : (
            'Generate all drafts'
          )}
        </AccentButton>
        <span className="text-[10px] text-text-tertiary">{statusSummary}</span>
      </div>

      <IncorporationDocsBulkShareBar
        engagementId={engagement.id}
        responses={mergedResponses}
        pre7State={pre7State}
        labelOptions={labelOptions}
        flushAllPreviews={flushAllPreviews}
        className="border-t border-primary/20 pt-3"
      />

      <div className="space-y-3 border-t border-primary/20 pt-3">
        <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
          Incorporation documents
        </p>
        <IncorporationDraftDocsGenerateList
          slots={docSlots}
          engagementId={engagement.id}
          checklistItemId="pre-7"
          showEmptySlots
          unlockedKeys={unlockedKeys}
          onUnlockKey={handleUnlockKey}
          onSlotPathChange={handleSlotPathChange}
          onFlushRegister={onFlushRegister}
          groupByDirector
        />
      </div>
    </div>
  );
}

