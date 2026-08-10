'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, FileText, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import type { ChecklistItem } from '@/data/checklist';
import { getItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import {
  computeMcaNameApprovalExpiryDate,
  extractItemResponses,
  type ChecklistItemResponses,
} from '@/lib/checklist-responses';
import { formatPre1DateDisplay } from '@/lib/checklist-pre1-validation';
import { fetchBoardResolutionInDb } from '@/lib/engagements-db';
import { isDeliveredToClient } from '@/lib/checklist-state-key';
import { clientBoardResolutionPath } from '@/lib/project-step-path';
import {
  incorpDraftDocLinksFromResponses,
  incorpDraftDocSlotsFromResponses,
  type IncorpDraftDocLink,
} from '@/lib/incorporation-docs/client';
import {
  filterClientVisibleIncorpDrafts,
  hasAnyClientVisibleIncorpDraft,
} from '@/lib/incorporation-docs/share';
import { draftUrlFieldFor } from '@/lib/incorporation-docs/types';
import type { IncorpDocKind } from '@/lib/incorporation-docs/types';
import { cn } from '@/lib/utils';
import { BoardResolutionStepLink } from '@/components/incorporation/BoardResolutionStepLink';
import { IncorporationDocsGeneratePanel } from '@/components/incorporation/IncorporationDocsGeneratePanel';
import { IncorporationDocsBulkShareBar } from '@/components/incorporation/IncorporationDocsBulkShareBar';
import {
  IncorporationDraftDocsGenerateList,
  IncorporationDraftDocsPreviewList,
} from '@/components/incorporation/IncorporationDocInlinePreview';
import { MilestoneFileDisplay } from '@/components/incorporation/MilestoneFileDisplay';
import {
  buildPre7OtherAttachmentLinks,
  hasPre7OtherAttachments,
} from '@/lib/checklist-pre7-other-attachments';
import { buildPre7NonIncorpDraftDocLinks } from '@/components/incorporation/phase1-step-panel-utils';
import {
  PanelShell,
  Pre7OtherAttachmentsList,
  DraftDocLinksList,
  Pre8DeliveredDraftDocsPanel,
} from '@/components/incorporation/Phase1StepPanelParts';
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
  const isClient = variant === 'client';
  const isIntern = user?.role === 'intern';
  const brFetchKey = `${engagement?.id ?? ''}:${item.id}`;
  const brFetchScopeRef = useRef(brFetchKey);
  const [brStatus, setBrStatus] = useState<
    'loading' | 'none' | 'draft' | 'finalized' | 'signed'
  >('loading');

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
    const pre6Item = getItem('pre-6');
    const pre6State = getStateForEngagement(engagement)['pre-6'];
    return extractItemResponses(pre6Item, pre6State);
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

  return (
    <Phase1StepPanelRoutes
      item={item}
      engagement={engagement}
      responses={responses}
      className={className}
      isClient={isClient}
      isIntern={isIntern}
      brStatus={brStatus}
      deliveredToClient={deliveredToClient}
      itemState={itemState}
      incorpDraftLabelOptions={incorpDraftLabelOptions}
      getStateForEngagement={getStateForEngagement}
    />
  );
}

