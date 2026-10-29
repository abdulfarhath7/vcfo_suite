'use client';

import { useRouter } from 'next/navigation';
import { internLeadManagerRequestPatch } from '@/lib/checklist/checklist-item-review';
import { internWorkCta, type InternWorkItem } from '@/lib/intern/intern-work';
import { useApp } from '@/context/AppContext';
import { useRemindClient } from '@/hooks/use-remind-client';
import { remindableItemKey } from '@/lib/reminders/reminder-rules';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export function InternWorkCtaButton({
  item,
  className,
  primary = false,
}: {
  item: InternWorkItem;
  className?: string;
  /** Draw the main (blurple) button whatever the kind, as the task drawer's footer does. */
  primary?: boolean;
}) {
  const router = useRouter();
  const { updateItem, updateTask, getStateForEngagement, engagements } = useApp();
  const { remind, pending, sent } = useRemindClient();
  const cta = internWorkCta(item);
  const remindKey = cta.action === 'remind-client' ? remindableItemKey(item) : null;

  const run = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (cta.action === 'open') {
      router.push(item.href);
      return;
    }
    if (cta.action === 'remind-client') {
      // One-click reminder (G-15); Mail stays the fallback when the route cannot send.
      if (!remindKey) {
        router.push('/app/intern/mail');
        return;
      }
      const outcome = await remind({ engagementId: item.engagementId, itemKey: remindKey, title: item.title });
      if (outcome === 'failed') router.push('/app/intern/mail');
      return;
    }
    if (cta.action === 'complete-task') {
      if (!item.taskId) return;
      updateTask(item.taskId, { status: 'completed', updatedAt: new Date().toISOString() });
      toastSuccess('Marked done', item.title, { id: `task-done:${item.taskId}` });
      return;
    }
    if (!item.catalogId) return;
    const engagement = engagements.find((row) => row.id === item.engagementId);
    if (!engagement) return;
    try {
      const slice = getStateForEngagement(engagement)[item.catalogId];
      await updateItem(item.engagementId, item.catalogId, {
        ...internLeadManagerRequestPatch(slice),
        resendManagerEmail: true,
      });
      toastSuccess('Emailed manager again', 'Watch for the send confirmation.', {
        id: `lead-nudge:${item.engagementId}:${item.catalogId}`,
      });
    } catch (err) {
      toastError('Could not email manager', errorMessage(err, 'Try again.'));
    }
  };

  if (item.kind === 'done') return null;
  const reminded = remindKey ? sent.has(remindKey) : false;

  return (
    <button
      type="button"
      onClick={(e) => void run(e)}
      disabled={Boolean(remindKey) && (pending === remindKey || reminded)}
      className={cn(
        buttonVariants({ variant: primary || cta.variant === 'solid' ? 'default' : 'secondary', size: primary ? 'default' : 'sm' }),
        'max-w-full shrink-0',
        className,
      )}
    >
      {reminded ? 'Reminded' : cta.label}
    </button>
  );
}
