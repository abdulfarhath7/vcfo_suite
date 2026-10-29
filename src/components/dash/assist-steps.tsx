import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StepMark } from '@/components/ui/step-track';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * VCFO Assist steps (prototype cards/AssistSteps): the filing assistant works on the government
 * portal one page at a time and keeps a screenshot of each. One row per step: the ST5 mark, the
 * title, a note ("Done · 10:02 AM", "Working on it", "Waiting") and the screenshot tag in mono.
 * Body only; put it in a `DashSection` with `flush`. The rows come from the stored run log
 * (`GET /api/filings/:id/assist-runs`), never from sample data.
 */
export interface AssistStepRow {
  id?: string;
  title: string;
  state: 'done' | 'run' | 'wait' | 'failed';
  note: string;
  /** Screenshot label: "GST · p1". */
  shot?: string;
  /** Link to the stored screenshot, when there is one. */
  shotHref?: string;
}

export function AssistSteps({ steps, empty = 'VCFO Assist has not worked on this filing yet', className }: { steps: AssistStepRow[]; empty?: string; className?: string }) {
  if (steps.length === 0) return <EmptyState title={empty} className="m-4" />;
  return (
    <ol className={cn('grid', className)}>
      {steps.map((s, i) => {
        const tag = s.shot ? (
          <>
            <ImageIcon size={12} strokeWidth={1.6} aria-hidden />
            {s.shot}
          </>
        ) : null;
        const tagCls = 'inline-flex h-[22px] flex-none items-center gap-1 rounded-sm bg-surface-sunken px-2 font-mono text-[11px] text-ink-muted';
        return (
          <li key={s.id ?? i} className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5 text-[13.5px] first:border-t-0 md:px-5">
            <StepMark
              state={s.state === 'done' ? 'done' : s.state === 'wait' ? 'next' : 'now'}
              tone={s.state === 'failed' ? 'bad' : 'prog'}
              size={20}
            />
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate', s.state === 'wait' ? 'text-ink-muted' : 'font-medium text-ink')}>{s.title}</span>
              <span className={cn('block text-[12.5px]', s.state === 'run' ? 'text-brand-text' : s.state === 'failed' ? 'text-danger' : 'text-ink-muted')}>{s.note}</span>
            </span>
            {tag ? (
              s.shotHref ? (
                <a href={s.shotHref} target="_blank" rel="noreferrer" className={cn(tagCls, 'hover:text-ink')} title="Screenshot of this page">
                  {tag}
                </a>
              ) : (
                <span className={tagCls} title="Screenshot of this page">
                  {tag}
                </span>
              )
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
