'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { AccentButton } from '@/components/noir';
import { cn } from '@/lib/utils';

type YourTurnBannerProps = {
  stepTitle: string;
  stepNumber?: number;
  phaseTitle?: string;
  onOpen?: () => void;
  className?: string;
};

/** Spotlight when the client owns the active checklist step. */
export function YourTurnBanner({
  stepTitle,
  stepNumber,
  phaseTitle,
  onOpen,
  className,
}: YourTurnBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        'relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-primary-light/90 via-panel to-blue-50/40 px-4 py-3.5 sm:px-5',
        'page-fade-up shadow-[0_12px_32px_-20px_oklch(var(--blue-900)/0.18)]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Your turn
            {phaseTitle ? ` · ${phaseTitle}` : ''}
          </p>
          <p className="mt-0.5 text-sm font-semibold tracking-tight text-foreground">
            {stepNumber != null ? `Step ${stepNumber}: ` : null}
            {stepTitle}
          </p>
        </div>
        {onOpen ? (
          <AccentButton size="sm" onClick={onOpen} className="shrink-0">
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </AccentButton>
        ) : null}
      </div>
    </div>
  );
}
