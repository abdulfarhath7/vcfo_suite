import type { ChipTone } from '@/components/ui/spectrum-chip';
import type { NotificationKind } from '@/lib/checklist/checklist-notifications';
import { NOTIFICATION_KIND_LOOK } from '@/components/notifications/notification-kind-look';
import { cn } from '@/lib/utils';

const TILE: Record<ChipTone, string> = {
  ok: 'bg-positive-soft text-positive',
  warn: 'bg-warning-soft text-warning',
  bad: 'bg-danger-soft text-danger',
  prog: 'bg-brand-soft text-brand-text',
  idle: 'bg-upcoming-soft text-upcoming',
  violet: 'bg-identity-soft text-identity',
  teal: 'bg-waiting-soft text-waiting',
};

/** The tinted square before a notification row (28px in the bell menu, 30px in lists, 36px in the live card). */
export function NotificationKindTile({
  kind,
  size = 30,
  className,
}: {
  kind: NotificationKind;
  size?: 28 | 30 | 36;
  className?: string;
}) {
  const look = NOTIFICATION_KIND_LOOK[kind] ?? NOTIFICATION_KIND_LOOK['checklist.review'];
  const { Icon } = look;
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-md',
        size === 36 ? 'h-9 w-9' : size === 28 ? 'h-7 w-7' : 'h-[30px] w-[30px]',
        TILE[look.tone],
        className,
      )}
      aria-hidden
    >
      <Icon className={size === 28 ? 'h-3.5 w-3.5' : 'h-[15px] w-[15px]'} strokeWidth={1.6} />
    </span>
  );
}
