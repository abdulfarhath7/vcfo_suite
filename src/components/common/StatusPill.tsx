import { StatusCode } from '@/data/checklist';
import { cn } from '@/lib/utils';

const map: Record<StatusCode, { label: string; cls: string; dot: string }> = {
  'not-started':     { label: 'Not started',     cls: 'bg-surface-sunken text-ink-muted',           dot: 'bg-text-tertiary' },
  'in-progress':     { label: 'In progress',     cls: 'bg-info-soft text-info',           dot: 'bg-info' },
  'awaiting-client': { label: 'Waiting on client', cls: 'bg-warning-soft text-warning',     dot: 'bg-warning' },
  'completed':       { label: 'Completed',       cls: 'bg-positive-soft text-positive',     dot: 'bg-positive' },
  'overdue':         { label: 'Overdue',         cls: 'bg-danger-soft text-danger',       dot: 'bg-danger' },
  'not-applicable':  { label: 'Not applicable',  cls: 'bg-surface-sunken/70 text-ink-faint',         dot: 'bg-text-tertiary' },
};

export function StatusPill({ status, className }: { status: StatusCode; className?: string }) {
  const m = map[status] ?? map['not-started'];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[11px] font-medium', m.cls, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}
