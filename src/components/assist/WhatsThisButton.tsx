'use client';

import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssistOptional } from './assist-context';

/**
 * "What's this?" (F1): opens Assist with the step / field / compliance item
 * as context. Client persona only — never on lead or manager screens.
 */
export function WhatsThisButton({
  kind,
  refId,
  label,
  compact = false,
  className,
}: {
  kind: 'step' | 'field' | 'compliance';
  refId: string;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  const assist = useAssistOptional();
  if (!assist?.enabled || assist.shell !== 'client' || assist.preview) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        // Often sits inside a clickable row or node.
        e.preventDefault();
        e.stopPropagation();
        assist.setOpen(true);
        void assist.ask({ context: { kind, ref: refId, label } });
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
