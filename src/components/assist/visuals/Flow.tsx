import { Check } from 'lucide-react';
import type { Visual } from '@/data/assist/schema';
import { flowText } from './visual-text';
import { cn } from '@/lib/utils';

type FlowVisual = Extract<Visual, { type: 'flow' }>;



export function Flow({ visual }: { visual: FlowVisual }) {
  return (
    <div>
      <p className="sr-only">{flowText(visual)}</p>
      <ol className="flex items-stretch gap-1.5" aria-hidden>
        {visual.stages.map((stage, i) => (
          <li
            key={`${stage.label}-${i}`}
            className={cn(
              'flex min-w-0 flex-1 flex-col gap-0.5 rounded-[var(--radius-md)] border px-2.5 py-2',
              stage.state === 'here' && 'border-primary bg-primary-light',
              stage.state === 'done' && 'border-border bg-muted',
              stage.state === 'next' && 'border-dashed border-border bg-panel',
            )}
          >
            <span className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide">
              {stage.state === 'done' ? (
                <span className="inline-flex items-center gap-1 text-success-text">
                  <Check className="h-3 w-3" strokeWidth={2.25} /> Done
                </span>
              ) : stage.state === 'here' ? (
                <span className="text-primary">You are here</span>
              ) : (
                <span className="text-muted-foreground">Next</span>
              )}
            </span>
            <span className="truncate text-[13px] font-medium text-foreground">{stage.label}</span>
            {stage.sub && <span className="truncate text-[11.5px] text-muted-foreground">{stage.sub}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
