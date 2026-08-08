import { cn } from '@/lib/utils';
import { DeadlineRule, computeDueDate, daysLeft, formatTimeline } from '@/lib/deadlines';

interface Props {
  rule: DeadlineRule;
  incorporationDate: string | null;
  className?: string;
  /** When true, hide static timeline text (shown elsewhere on the card). */
  onlyCountdown?: boolean;
}

export function CountdownChip({ rule, incorporationDate, className, onlyCountdown = false }: Props) {
  const incDate = incorporationDate ? new Date(incorporationDate) : null;
  const due = computeDueDate(rule, incDate);
  const dl = daysLeft(due);

  if (onlyCountdown && dl === null) return null;

  if (dl === null) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
          className
        )}
      >
        {formatTimeline(rule)}
      </span>
    );
  }

  let tone = 'bg-muted text-muted-foreground';
  let label = `Due in ${dl} days`;
  if (dl < 0) {
    tone = 'bg-danger-light text-danger-text';
    label = `${Math.abs(dl)} days overdue`;
  } else if (dl < 7) tone = 'bg-danger-light text-danger-text';
  else if (dl < 30) tone = 'bg-warning-light text-warning-text';
  else tone = 'bg-success-light text-success-text';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}
