import { cn } from '@/lib/utils';
import { isNewSince } from '@/lib/ui/table-prefs';

/** "29 Oct, 14:05" for the square's tooltip. */
function stamp(at: Date): string {
  return `${at.getDate()} ${at.toLocaleString('en-GB', { month: 'short' })}, ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/**
 * E-08 "new since last visit": a 6px blurple square before a row that changed after the person
 * last opened the page, with the change time in a tooltip. Renders nothing for an older row.
 * Get `since` from `useLastVisit(pageKey)`. The square is absolutely placed, so give its cell
 * `position: relative`; pass `inline` to draw it in the text flow instead.
 */
export function NewSinceMark({
  changedAt,
  since,
  inline,
  className,
}: {
  changedAt: Date | string | null | undefined;
  since: number | null;
  inline?: boolean;
  className?: string;
}) {
  if (!changedAt || !isNewSince(changedAt, since)) return null;
  const at = changedAt instanceof Date ? changedAt : new Date(changedAt);
  return (
    <i
      className={cn(
        'block h-1.5 w-1.5 flex-none rounded-[2px] bg-brand',
        inline ? 'mr-1.5 inline-block align-middle' : 'absolute left-[2px] top-1/2 -mt-[3px]',
        className,
      )}
      title={`Changed ${stamp(at)}`}
    >
      <span className="sr-only">Changed since your last visit</span>
    </i>
  );
}
