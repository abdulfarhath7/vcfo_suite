import { cn } from '@/lib/utils';
import { StatusCode, STATUS_LABEL } from '@/data/checklist';

const styles: Record<StatusCode, string> = {
  'not-started': 'bg-surface-sunken text-ink-muted',
  'in-progress': 'bg-info-soft text-info',
  'awaiting-client': 'bg-warning-soft text-warning',
  completed: 'bg-positive-soft text-positive',
  overdue: 'bg-danger-soft text-danger',
  'not-applicable': 'bg-surface-sunken/70 text-ink-faint',
};

export function StatusBadge({ status, className }: { status: StatusCode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
        styles[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
