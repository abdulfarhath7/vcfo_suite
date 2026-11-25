import { Check } from 'lucide-react';
import { completenessLabel, type StepCompleteness } from '@/lib/incorporation/step-completeness';
import { cn } from '@/lib/utils';

/**
 * Whether a step's required answers are all saved (PLAN K): the green tick of the form's section
 * tabs, or their red square dot with "N to fill". Colour carries the information only; the words
 * (visible for the dot, screen-reader only for the tick) and the tooltip say the same.
 */
export function StepCompletenessMark({ mark, className }: { mark: Pick<StepCompleteness, 'complete' | 'missing' | 'labels'>; className?: string }) {
  const label = completenessLabel(mark);
  if (mark.complete)
    return (
      <span data-testid="step-complete-mark" className={cn('inline-flex flex-none items-center text-positive', className)} title={label}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  const tip = mark.labels.length > 0 ? `${label}: ${mark.labels.slice(0, 6).join(', ')}${mark.labels.length > 6 ? '…' : ''}` : label;
  return (
    <span data-testid="step-missing-mark" className={cn('inline-flex flex-none items-center gap-1 text-[11.5px] tabular-nums text-ink-muted', className)} title={tip}>
      <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-danger-mid" aria-hidden />
      {label}
    </span>
  );
}
