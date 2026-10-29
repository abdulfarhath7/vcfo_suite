'use client';

import { Button } from '@/components/ui/button';
import { useRemindClient } from '@/hooks/use-remind-client';
import { cn } from '@/lib/utils';

/**
 * "Remind" (G-15): one click sends the client the reminder email (and WhatsApp when they
 * opted in) through `POST /api/engagements/:id/remind`. After a send, or when the item was
 * already reminded today, the button reads "Reminded" and rests. `onFailed` is the caller's
 * old path (Mail or the record), used only when the route could not send.
 */
export function RemindClientButton({
  engagementId,
  itemKey,
  title,
  onFailed,
  className,
}: {
  engagementId: string;
  itemKey: string;
  title: string;
  onFailed?: () => void;
  className?: string;
}) {
  const { remind, pending, sent } = useRemindClient();
  const done = sent.has(itemKey);
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={cn('shrink-0', className)}
      disabled={pending === itemKey || done}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const outcome = await remind({ engagementId, itemKey, title });
        if (outcome === 'failed') onFailed?.();
      }}
    >
      {done ? 'Reminded' : 'Remind'}
    </Button>
  );
}
