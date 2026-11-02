import { StatusCode } from '@/data/checklist';
import { cn } from '@/lib/utils';

const map: Record<StatusCode, { label: string; cls: string; dot: string }> = {
  'not-started':     { label: 'Not started',     cls: 'bg-upcoming-soft text-upcoming',   dot: 'bg-upcoming-mid' },
  'in-progress':     { label: 'In progress',     cls: 'bg-brand-soft text-brand-text',    dot: 'bg-brand' },
  'awaiting-client': { label: 'Waiting',         cls: 'bg-waiting-soft text-waiting',     dot: 'bg-waiting-mid' },
  'completed':       { label: 'Done',            cls: 'bg-positive-soft text-positive',   dot: 'bg-positive-mid' },
  'overdue':         { label: 'Overdue',         cls: 'bg-danger-soft text-danger',       dot: 'bg-danger-mid' },
  'not-applicable':  { label: 'Not applicable',  cls: 'bg-surface-sunken text-ink-faint', dot: 'bg-ink-faint' },
};

export function StatusPill({ status, className }: { status: StatusCode; className?: string }) {
  const m = map[status] ?? map['not-started'];
  return (
    <span className={cn('inline-flex h-chip min-w-[104px] items-center gap-[7px] whitespace-nowrap rounded-md px-[9px] text-[12px] font-medium', m.cls, className)}>
      <span className={cn('h-[7px] w-[7px] shrink-0 rounded-[2px]', m.dot)} />
      {m.label}
    </span>
  );
}
