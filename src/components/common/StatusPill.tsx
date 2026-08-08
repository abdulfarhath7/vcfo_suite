import { StatusCode } from '@/data/checklist';
import { cn } from '@/lib/utils';

const map: Record<StatusCode, { label: string; cls: string; dot: string }> = {
  'not-started':     { label: 'Not started',     cls: 'bg-muted text-text-secondary',           dot: 'bg-text-tertiary' },
  'in-progress':     { label: 'In progress',     cls: 'bg-info-light text-info-text',           dot: 'bg-info' },
  'awaiting-client': { label: 'Waiting on client', cls: 'bg-warning-light text-warning-text',     dot: 'bg-warning' },
  'completed':       { label: 'Completed',       cls: 'bg-success-light text-success-text',     dot: 'bg-success' },
  'overdue':         { label: 'Overdue',         cls: 'bg-danger-light text-danger-text',       dot: 'bg-danger' },
  'not-applicable':  { label: 'Not applicable',  cls: 'bg-muted/70 text-text-tertiary',         dot: 'bg-text-tertiary' },
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
