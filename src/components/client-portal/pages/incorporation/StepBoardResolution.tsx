'use client';

/**
 * BR-01, BR-02, BR-04, BR-05 in the client portal: the board resolution on its two steps.
 * Step 2 ("Draft board resolution") shows the draft the firm sent and the client's edit
 * (edit, confirm, send to the firm). Step 3 ("Signed board resolution") shows the draft beside
 * the signed copy. The full page (`/app/client/board-resolution`) stays one click away.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import { fetchBoardResolutionInDb } from '@/lib/projects/engagements-db';
import { clientBoardResolutionPath } from '@/lib/projects/project-step-path';
import { useRealtimeBoardResolution } from '@/hooks/use-realtime-board-resolution';
import { BoardResolutionDocCards } from '@/components/incorporation/BoardResolutionDocCards';
import { BoardResolutionClientEdit } from '@/components/incorporation/BoardResolutionClientEdit';
import { SkeletonRows } from '@/components/ui/empty-state';
import { SCard } from './spectrum';

export const BOARD_RESOLUTION_STEPS = new Set(['pre-2', 'pre-3']);

export function StepBoardResolution({ engagementId, stepId }: { engagementId: string; stepId: string }) {
  const { engagements } = useApp();
  const engagement = useMemo(() => engagements.find((e) => e.id === engagementId), [engagements, engagementId]);
  const [doc, setDoc] = useState<BoardResolutionDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setDoc(await fetchBoardResolutionInDb(engagementId));
    } catch {
      /* shown as "no draft yet" */
    } finally {
      setLoaded(true);
    }
  }, [engagementId]);
  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeBoardResolution({ appEngagementId: engagementId, onRemoteChange: () => void load() });

  const draftStep = stepId === 'pre-2';
  return (
    <SCard
      title={draftStep ? 'Draft board resolution' : 'Signed board resolution'}
      right={
        <Link href={clientBoardResolutionPath()} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text hover:underline">
          <FileText size={14} strokeWidth={1.6} aria-hidden />
          Open the board resolution page
        </Link>
      }
    >
      {!loaded || !engagement ? (
        <SkeletonRows rows={2} />
      ) : (
        <div className="grid gap-1">
          <BoardResolutionDocCards engagement={engagement} doc={doc} step={draftStep ? 'draft' : 'signed'} viewerRole="client" />
          {draftStep && doc?.status === 'finalized' ? (
            <BoardResolutionClientEdit engagementId={engagementId} viewerRole="client" refreshKey={doc.updatedAt ?? undefined} />
          ) : null}
        </div>
      )}
    </SCard>
  );
}
