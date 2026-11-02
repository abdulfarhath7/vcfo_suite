import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrackState } from './track';

/**
 * C4: the numbered "What you do" list. The open line has the brand-soft fill, done lines a tick.
 * `action` is the one main button; the foot is left out when there is none.
 */
export function DocTodo({
  items,
  action,
  className,
}: {
  items: Array<{ key: string; label: string; state: TrackState }>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <ol className="m-0 grid list-none gap-0.5 px-2.5 py-2">
        {items.map((t, i) => (
          <li
            key={t.key}
            data-state={t.state}
            aria-current={t.state === 'now' ? 'step' : undefined}
            className={cn(
              'grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 rounded-md px-1.5 py-2 text-[13px]',
              t.state === 'done' && 'text-ink-muted',
              t.state === 'now' && 'bg-brand-soft text-ink',
              t.state === 'next' && 'text-ink',
            )}
          >
            <span className={cn('text-right font-mono text-[12px] font-medium', t.state === 'now' ? 'text-brand-text' : 'text-ink-faint')}>
              {t.state === 'done' ? (
                <Check size={14} strokeWidth={2.4} className="ml-auto text-positive" aria-label="Done" />
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0">{t.label}</span>
          </li>
        ))}
      </ol>
      {action ? <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-4 py-3">{action}</div> : null}
    </div>
  );
}
