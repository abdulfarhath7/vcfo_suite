'use client';

import { RequestManagerApproval } from '@/components/admin/RequestManagerApproval';
import { Button } from '@/components/ui/button';
import type { ChecklistItem } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

export type InternStepActionBarProps = {
  engagementId: string;
  item: ChecklistItem;
  itemState?: ChecklistItemStateSlice;
  showLegacyChecklist?: boolean;
  totalsPct?: number;
  onMarkAll?: () => void;
};

/** Quiet intern step footer actions (not a second card). */
export function InternStepActionBar({
  engagementId,
  item,
  itemState,
  showLegacyChecklist = false,
  totalsPct = 0,
  onMarkAll,
}: InternStepActionBarProps) {
  return (
    <>
      <RequestManagerApproval
        engagementId={engagementId}
        itemId={item.id}
        itemState={itemState}
        emphasis="default"
        className="inline-flex"
      />
      {showLegacyChecklist && onMarkAll ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={onMarkAll}
          disabled={totalsPct === 100}
        >
          Mark all complete
        </Button>
      ) : null}
    </>
  );
}
