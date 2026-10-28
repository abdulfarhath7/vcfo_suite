import { cn } from '@/lib/utils';
import { StatusCode, STATUS_LABEL } from '@/data/checklist';

const styles: Record<StatusCode, string> = {
  'not-started': 'bg-upcoming-soft text-upcoming',
  'in-progress': 'bg-brand-soft text-brand-text',
  'awaiting-client': 'bg-waiting-soft text-waiting',
  completed: 'bg-positive-soft text-positive',
  overdue: 'bg-danger-soft text-danger',
  'not-applicable': 'bg-surface-sunken/70 text-ink-faint',
};

export function StatusBadge({ status, className }: { status: StatusCode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-chip min-w-[104px] items-center whitespace-nowrap rounded-md px-[9px] text-[12px] font-medium',
        styles[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
