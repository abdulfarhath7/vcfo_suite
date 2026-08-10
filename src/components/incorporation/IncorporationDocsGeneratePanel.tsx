'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useApp } from '@/context/AppContext';
import { checklist } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import { extractItemResponses, type ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  INCORP_DOC_DEFINITIONS,
  incorpDocRowKey,
  incorpDraftDocSlotsFromResponses,
  responsePatchFromPaths,
  type IncorpDocKind,
  type IncorpDocPaths,
} from '@/lib/incorporation-docs/client';
import { draftUrlFieldFor } from '@/lib/incorporation-docs/types';
import { formatIncorpDocsErrorDisplay } from '@/lib/api/incorporation-docs-errors';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { GoldButton } from '@/components/noir';
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

const DOC_STATUS: {
  doc: IncorpDocKind;
  label: string;
  fields: { director: 'non-resident' | 'resident'; field: keyof ChecklistItemResponses }[];
}[] = [
  {
    doc: 'dir-2',
    label: 'DIR-2',
    fields: [
      { director: 'non-resident', field: 'nrDirectorDir2DraftUrl' },
      { director: 'resident', field: 'residentDirectorDir2DraftUrl' },
    ],
  },
  {
    doc: 'dir-8',
    label: 'DIR-8',
    fields: [
      { director: 'non-resident', field: 'nrDirectorDir8DraftUrl' },
      { director: 'resident', field: 'residentDirectorDir8DraftUrl' },
    ],
  },
  {
    doc: 'inc-9',
    label: 'INC-9',
    fields: [
      { director: 'non-resident', field: 'nrDirectorInc9DraftUrl' },
      { director: 'resident', field: 'residentDirectorInc9DraftUrl' },
    ],
  },
  {
    doc: 'pan-undertaking',
    label: 'PAN Undertaking',
    fields: [{ director: 'non-resident', field: 'nrDirectorPanUndertakingDraftUrl' }],
  },
];

function unlockRowKeysFromPatch(patch: Record<string, string>): string[] {
  const keys: string[] = [];
  for (const [fieldId, path] of Object.entries(patch)) {
    if (!path.trim()) continue;
    for (const slot of incorpDraftDocSlotsFromResponses({})) {
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
  const pre6Responses = useMemo(() => {
    const pre6Item = checklist.find((c) => c.id === 'pre-6');
    const pre6State = getStateForEngagement(engagement)['pre-6'];
    return pre6Item ? extractItemResponses(pre6Item, pre6State) : {};
  }, [engagement, getStateForEngagement]);
  const labelOptions = useMemo(() => ({ pre6: pre6Responses }), [pre6Responses]);
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
    return DOC_STATUS.map(({ label, fields }) => {
      const saved = fields.filter((f) => (mergedResponses[f.field] ?? '').trim()).length;
      return `${label}: ${saved}/${fields.length}`;
    }).join(' · ');
  }, [mergedResponses]);

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
        'rounded-md border border-orange/30 bg-orange/5 px-4 py-3 space-y-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[13px] font-medium text-ink">Generate incorporation drafts</p>
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            Click <strong>Generate</strong> on each document to build drafts from client data (Pre-6
            KYC and company name from Pre-1 / Pre-5). Word previews appear only after you generate.
            When all drafts are ready, use <strong>Share with client</strong> so they can
            download on Pre-8, notarize, and upload signed copies.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GoldButton
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
        </GoldButton>
        <span className="text-[10px] text-text-tertiary">{statusSummary}</span>
      </div>

      <IncorporationDocsBulkShareBar
        engagementId={engagement.id}
        responses={mergedResponses}
        pre7State={pre7State}
        labelOptions={labelOptions}
        flushAllPreviews={flushAllPreviews}
        className="border-t border-orange/20 pt-3"
      />

      <div className="space-y-3 border-t border-orange/20 pt-3">
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
        />
      </div>
    </div>
  );
}

