import { StepMark } from '@/components/ui/step-track';
import { cn } from '@/lib/utils';
import { docDay } from './format';
import { trackStates } from './track';
import type { DocStageDef, DocStageRecords } from './types';

/**
 * C2: the ST5 track of a document. Done steps show who and when, the open step shows who holds
 * it now. One row from `lg`, three columns on tablets, two on phones; hairlines between cells.
 */
export function DocTrack({
  stages,
  records,
  nowLabel,
  nowTone = 'prog',
  label = 'Progress of the document',
  className,
}: {
  stages: DocStageDef[];
  records: DocStageRecords;
  /** The open step's line, for example "Waiting on Northwind". Default "Now". */
  nowLabel?: string;
  /** Teal when the open step waits on the client (R-13), blurple otherwise. */
  nowTone?: 'prog' | 'teal';
  label?: string;
  className?: string;
}) {
  const steps = trackStates(stages, records);
  return (
    <ol
      aria-label={label}
      className={cn(
        'm-0 grid list-none grid-cols-2 overflow-hidden rounded-md border-1.5 border-line bg-surface-raised p-0 sm:grid-cols-3 lg:grid-cols-[repeat(var(--doc-steps),minmax(0,1fr))]',
        className,
      )}
      style={{ ['--doc-steps' as string]: String(Math.max(1, steps.length)) }}
    >
      {steps.map((s) => {
        const sub = s.state === 'done' ? [s.by, docDay(s.at)].filter(Boolean).join(' · ') : s.state === 'now' ? nowLabel || 'Now' : '';
        return (
          <li
            key={s.key}
            data-state={s.state}
            className="-mb-px -mr-px grid min-w-0 content-start gap-1 border-b border-r border-line-soft px-3 py-3.5"
          >
            <StepMark
              state={s.state}
              tone={s.state === 'now' ? nowTone : 'prog'}
              size={18}
              label={s.state === 'done' ? 'Done' : s.state === 'now' ? 'Now' : 'Not started'}
            />
            <b className={cn('truncate text-[13px] font-medium', s.state === 'next' ? 'text-ink-muted' : 'text-ink')}>{s.label}</b>
            <span className="min-h-[18px] truncate text-[12px] text-ink-muted">{sub}</span>
          </li>
        );
      })}
    </ol>
  );
}
