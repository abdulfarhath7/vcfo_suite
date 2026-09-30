'use client';

import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

/**
 * "What's this?" (F1): opens Ask VCFO with the step / field / compliance item
 * as context. Client persona only — never on lead or manager screens.
 */
export function WhatsThisButton({
  kind,
  refId,
  label,
  compact = false,
  className,
  feature,
}: {
  kind: 'step' | 'field' | 'compliance' | 'document';
  refId: string;
  label: string;
  compact?: boolean;
  className?: string;
  /** Phase 9 feature this placement belongs to; hidden unless its flag is on. */
  feature?: 'C2' | 'C5';
}) {
  const ask = useAskOptional();
  if (!ask?.enabled || ask.shell !== 'client' || ask.preview) return null;
  if (feature && !ask.features[feature]) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        // Often sits inside a clickable row or node.
        e.preventDefault();
        e.stopPropagation();
        ask.setOpen(true);
        void ask.ask({ context: { kind, ref: refId, label } });
      }}
      aria-label={`What's this: ${label}`}
      title="What's this?"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full text-[11.5px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        compact ? 'h-7 w-7 justify-center' : 'min-h-[28px] px-1.5',
        className,
      )}
    >
      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      {!compact && <span>What&apos;s this?</span>}
    </button>
  );
}
