'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { phaseClasses } from '@/lib/phase-colors';
import { cn } from '@/lib/utils';

type PhaseCelebrationProps = {
  phaseId: string;
  phaseTitle: string;
  /** Fires celebration when this flips true */
  completed: boolean;
  className?: string;
};

/** Brief tasteful phase-complete ribbon — not confetti. */
export function PhaseCelebration({
  phaseId,
  phaseTitle,
  completed,
  className,
}: PhaseCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [shownFor, setShownFor] = useState<string | null>(null);
  const phase = phaseClasses(phaseId);

  useEffect(() => {
    if (!completed || shownFor === phaseId) return;
    setShownFor(phaseId);
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(t);
  }, [completed, phaseId, shownFor]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 page-fade-up',
        phase.soft,
        phase.border,
        className,
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full journey-complete',
          phase.solid,
        )}
      >
        <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', phase.label)}>
          Phase complete
        </p>
        <p className="text-sm font-semibold text-foreground">{phaseTitle}</p>
      </div>
      <span
        className={cn(
          'ml-auto hidden h-1 w-16 rounded-full sm:block',
          'bg-gradient-to-r from-transparent via-current to-transparent opacity-40',
          phase.text,
        )}
        aria-hidden
      />
    </div>
  );
}
