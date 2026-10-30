import { Building2, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  URGENCY_BARS,
  VISIBILITY_LABEL,
  type TaskUrgency,
  type TaskVisibility,
} from '@/views/compliances/tasks/task-model';

/**
 * Marks of a non-statutory task (prototype TaskMarks, COMPLIANCE-MODEL.md S-6 and S-7).
 * Urgency stays neutral: red is for late work only (R-03). Only "Critical" fills its bars
 * with the warning colour.
 */

export function UrgencyPill({ urgency, className }: { urgency: TaskUrgency; className?: string }) {
  const n = URGENCY_BARS[urgency] ?? 1;
  return (
    <span
      className={cn(
        'inline-flex h-6 w-[88px] flex-none items-center gap-2 rounded-md border-1.5 border-line bg-surface-raised px-2 text-[12.5px] font-medium text-ink-2',
        className,
      )}
      title={`Urgency: ${urgency}`}
    >
      <span className="flex h-3 items-end gap-[2px]" aria-hidden data-bars={n}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn('w-[3px] rounded-bar', i <= n ? (urgency === 'Critical' ? 'bg-warning-mid' : 'bg-ink-2') : 'bg-line-strong')}
            style={{ height: `${3 + i * 2}px` }}
          />
        ))}
      </span>
      {urgency}
    </span>
  );
}

const VIS_ICON = { firm: Building2, client: User, both: Users } as const;
const VIS_TITLE: Record<TaskVisibility, string> = {
  both: 'Visible to the firm and the client',
  firm: 'Visible to the firm only',
  client: 'Visible to the client',
};

export function VisibilityTag({ visibility, className }: { visibility: TaskVisibility; className?: string }) {
  const Icon = VIS_ICON[visibility] ?? Users;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] text-ink-2', className)} title={VIS_TITLE[visibility]}>
      <Icon size={15} strokeWidth={1.6} aria-hidden className="text-ink-muted" />
      {VISIBILITY_LABEL[visibility] ?? visibility}
    </span>
  );
}
