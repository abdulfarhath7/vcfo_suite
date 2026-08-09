import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChecklistItem } from '@/data/checklist';
import { TaskInstance, ActivityEvent } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { StepDetailContent } from '@/components/admin/StepDetailContent';

const EMPTY_ACTIVITY: ActivityEvent[] = [];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: ChecklistItem;
  task?: TaskInstance;
  engagementId: string;
  clientId?: string;
  responses?: ChecklistItemResponses;
  activity?: ActivityEvent[];
  onCompleted?: (taskId: string) => void;
}

/** @deprecated Prefer navigating to admin project step page */
export function StepDetailDrawer({
  open,
  onOpenChange,
  item,
  task,
  engagementId,
  clientId,
  responses,
  activity = EMPTY_ACTIVITY,
  onCompleted,
}: Props) {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[560px] bg-panel border-l border-hairline-strong p-0 flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{item.title}</SheetTitle>
        </SheetHeader>
        <StepDetailContent
          item={item}
          task={task}
          engagementId={engagementId}
          clientId={clientId}
          responses={responses}
          activity={activity}
          onCompleted={onCompleted}
          theme="dark"
          contentReady={open}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
