import { CircleDot } from 'lucide-react';
import type { Visual } from '@/data/assist/schema';

type NextStepVisual = Extract<Visual, { type: 'nextStep' }>;


export function NextStep({ visual }: { visual: NextStepVisual }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-primary/40 bg-primary-light/60 p-3">
      <div className="flex items-center gap-2">
        <CircleDot className="h-3.5 w-3.5 text-primary" strokeWidth={2} aria-hidden />
        <p className="text-[13px] font-semibold text-foreground">{visual.title}</p>
        {visual.dueLabel && (
          <span className="ml-auto rounded-full bg-warning-light px-2 py-px text-[11px] font-medium text-warning-text">
            {visual.dueLabel}
          </span>
        )}
      </div>
      {visual.items.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-muted-foreground">
          {visual.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
