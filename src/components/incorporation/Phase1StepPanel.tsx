'use client';

import type { BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { directorResponsesFromState } from '@/lib/incorporation/proposed-directors';
import type { ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { fetchBoardResolutionInDb } from '@/lib/projects/engagements-db';
import { isDeliveredToClient } from '@/lib/checklist/checklist-state-key';
import { isInternEngagementPathname } from '@/lib/projects/project-step-path';










import { Phase1StepPanelRoutes } from '@/components/incorporation/Phase1StepPanelSections';

interface Phase1StepPanelProps {
  item: ChecklistItem;
  engagement?: Engagement;
  responses?: ChecklistItemResponses;
  variant?: 'admin' | 'client';
  className?: string;
}

/** Step 2â€“5 workflow panels (board resolution + intern deliverables). */
export function Phase1StepPanel({
  item,
  engagement,
  responses: responsesOverride,
  variant = 'admin',
  className,
}: Phase1StepPanelProps) {
  const { user, getStateForEngagement } = useApp();
  const pathname = usePathname();
  const isClient = variant === 'client';
  const isIntern = user?.role === 'intern' || isInternEngagementPathname(pathname);
  const brFetchKey = `${engagement?.id ?? ''}:${item.id}`;
  const brFetchScopeRef = useRef(brFetchKey);
  const [brStatus, setBrStatus] = useState<
    'loading' | 'none' | 'draft' | 'finalized' | 'signed'
  >('loading');
  const [brDoc, setBrDoc] = useState<BoardResolutionDoc | null>(null);

  if (brFetchKey !== brFetchScopeRef.current) {
    brFetchScopeRef.current = brFetchKey;
    setBrStatus(
      !engagement?.id || !['pre-2', 'pre-3', 'pre-4'].includes(item.id) ? 'none' : 'loading',
    );
  }

  const responses = responsesOverride ?? {};
  const itemState = engagement ? getStateForEngagement(engagement)[item.id] : undefined;
  const deliveredToClient = isDeliveredToClient(itemState);
  const pre6Responses = useMemo(() => {
    if (!engagement) return {} as ChecklistItemResponses;
    return directorResponsesFromState(getStateForEngagement(engagement)).pre6;
  }, [engagement, getStateForEngagement]);
  const incorpDraftLabelOptions = useMemo(
    () => ({ pre6: pre6Responses }),
    [pre6Responses],
  );

  useEffect(() => {
    if (!engagement?.id || !['pre-2', 'pre-3', 'pre-4'].includes(item.id)) {
      return;
    }
    let cancelled = false;
    void fetchBoardResolutionInDb(engagement.id)
      .then((doc) => {
        if (cancelled) return;
        setBrDoc(doc ?? null);
        if (!doc) setBrStatus('none');
        else if (doc.signedStoragePath?.trim()) setBrStatus('signed');
        else if (doc.status === 'finalized') setBrStatus('finalized');
        else setBrStatus('draft');
      })
      .catch(() => {
        if (!cancelled) setBrStatus('none');
      });
    return () => {
      cancelled = true;
    };
  }, [engagement?.id, item.id]);

  // BR-02: an upload on the signed step's card updates the status line below it at once.
  const onBrDocChange = (doc: BoardResolutionDoc | null) => {
    if (!doc) return;
    setBrDoc(doc);
    setBrStatus(doc.signedStoragePath?.trim() ? 'signed' : doc.status === 'finalized' ? 'finalized' : 'draft');
  };

  return (
    <Phase1StepPanelRoutes
      item={item}
      engagement={engagement}
      responses={responses}
      className={className}
      isClient={isClient}
      isIntern={isIntern}
      brStatus={brStatus}
      brDoc={brDoc}
      onBrDocChange={onBrDocChange}
      role={isClient ? 'client' : user?.role}
      deliveredToClient={deliveredToClient}
      itemState={itemState}
      incorpDraftLabelOptions={incorpDraftLabelOptions}
      getStateForEngagement={getStateForEngagement}
    />
  );
}

