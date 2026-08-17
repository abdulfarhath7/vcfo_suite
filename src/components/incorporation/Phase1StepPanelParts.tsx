'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { incorpDraftDocSlotsFromResponses, type IncorpDraftDocLink } from '@/lib/incorporation-docs/client';
import { draftUrlFieldFor } from '@/lib/incorporation-docs/types';
import type { IncorpDocKind } from '@/lib/incorporation-docs/types';
import { cn } from '@/lib/utils';
import {
  IncorporationDraftDocsGenerateList,
  IncorporationDraftDocsPreviewList,
} from '@/components/incorporation/IncorporationDocInlinePreview';
import { MilestoneFileDisplay } from '@/components/incorporation/MilestoneFileDisplay';
import { buildPre7OtherAttachmentLinks } from '@/lib/checklist-pre7-other-attachments';
import type { OtherDraftDocLink } from '@/components/incorporation/phase1-step-panel-utils';

export function PanelShell({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-primary/25 bg-primary/5 px-4 py-3 space-y-2',
        className,
      )}
    >
      <p className="text-[12px] font-medium text-ink">{title}</p>
      <div className="text-[12px] leading-relaxed text-text-secondary space-y-1.5">{children}</div>
    </div>
  );
}

type DraftDocLink = IncorpDraftDocLink | OtherDraftDocLink;

function isIncorpDraftDocLink(doc: DraftDocLink): doc is IncorpDraftDocLink {
  return 'doc' in doc && 'audience' in doc;
}

export function Pre7OtherAttachmentsList({
  responses,
  className,
}: {
  responses: ChecklistItemResponses;
  className?: string;
}) {
  const links = buildPre7OtherAttachmentLinks(responses);
  if (links.length === 0) return null;

  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Other attachments</p>
      {links.map((link) => (
        <div key={link.fieldId}>
          <MilestoneFileDisplay storagePath={link.path} label={link.label} />
        </div>
      ))}
    </div>
  );
}

export function DraftDocLinksList({
  docs,
  engagementId,
  checklistItemId = 'pre-7',
  allowRegenerate = false,
  showIncorpDocxPreview = false,
}: {
  docs: DraftDocLink[];
  engagementId?: string;
  checklistItemId?: string;
  allowRegenerate?: boolean;
  showIncorpDocxPreview?: boolean;
}) {
  if (docs.length === 0) return null;

  const incorpDocs = docs.filter(isIncorpDraftDocLink);
  const otherDocs = docs.filter((doc): doc is OtherDraftDocLink => !isIncorpDraftDocLink(doc));

  return (
    <div className="space-y-4">
      {engagementId && incorpDocs.length > 0 && (
        <IncorporationDraftDocsPreviewList
          docs={incorpDocs}
          engagementId={engagementId}
          checklistItemId={checklistItemId}
          showDocxPreview={showIncorpDocxPreview}
          allowRegenerate={allowRegenerate && showIncorpDocxPreview}
        />
      )}
      {otherDocs.length > 0 && (
        <div className="space-y-1">
          {otherDocs.map((doc) => (
            <div key={doc.path}>
              <MilestoneFileDisplay storagePath={doc.path} label={doc.label} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pre8DeliveredDraftDocsPanel({
  engagementId,
  pre7Responses,
  labelOptions,
}: {
  engagementId: string;
  pre7Responses: ChecklistItemResponses;
  labelOptions?: { pre6?: ChecklistItemResponses };
}) {
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(() => new Set());
  const [slotPaths, setSlotPaths] = useState<Record<string, string>>({});

  const slots = useMemo(
    () => incorpDraftDocSlotsFromResponses({ ...pre7Responses, ...slotPaths }, labelOptions),
    [pre7Responses, slotPaths, labelOptions],
  );

  const handleSlotPathChange = useCallback((key: string, path: string) => {
    const [doc, audience] = key.split(':') as [
      IncorpDocKind,
      import('@/lib/incorporation-docs/shared').IncorpDocAudience,
    ];
    const fieldId = draftUrlFieldFor(doc, audience);
    if (fieldId) {
      setSlotPaths((prev) => ({ ...prev, [fieldId]: path }));
    }
  }, []);

  return (
    <IncorporationDraftDocsGenerateList
      slots={slots}
      engagementId={engagementId}
      checklistItemId="pre-7"
      unlockedKeys={unlockedKeys}
      onUnlockKey={(key) => setUnlockedKeys((prev) => new Set(prev).add(key))}
      onSlotPathChange={handleSlotPathChange}
    />
  );
}
