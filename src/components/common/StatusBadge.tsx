import { cn } from '@/lib/utils';
import { StatusCode, STATUS_LABEL } from '@/data/checklist';

const styles: Record<StatusCode, string> = {
  'not-started': 'bg-muted text-text-secondary',
  'in-progress': 'bg-info-light text-info-text',
  'awaiting-client': 'bg-warning-light text-warning-text',
  completed: 'bg-success-light text-success-text',
  overdue: 'bg-danger-light text-danger-text',
  'not-applicable': 'bg-muted/70 text-text-tertiary',
};

export function StatusBadge({ status, className }: { status: StatusCode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        styles[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
