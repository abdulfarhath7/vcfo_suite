'use client';

import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

/**
 * "What's this?" (F1): opens Ask VCFO with the step / field / compliance item
 * as context in the client shell.
 *
 * Staff screens (lead, manager, admin) have no client Ask conversation, so there
 * the button renders only when the screen passes `onOpen`, and a click calls it.
 * The staff screen opens its own "What's this?" panel about the step
 * (`src/views/client-record/StepAboutPanel.tsx`). `variant` picks the staff look:
 * the 12px accent link on a step row or the outline button on the step head.
 */
export function WhatsThisButton({
  kind,
  refId,
  label,
  compact = false,
  className,
  feature,
  onOpen,
  variant = 'link',
}: {
  kind: 'step' | 'field' | 'compliance' | 'document';
  refId: string;
  label: string;
  compact?: boolean;
  className?: string;
  /** Phase 9 feature this placement belongs to; hidden unless its flag is on. */
  feature?: 'C2' | 'C5';
  /** Staff screens: open the screen's own "What's this?" panel. */
  onOpen?: () => void;
  /** Staff look: `link` (12px accent text) or `outline` (a small outline button). */
  variant?: 'link' | 'outline';
}) {
  const ask = useAskOptional();
  const clientShell = Boolean(ask?.enabled && ask.shell === 'client' && !ask.preview);
  if (!clientShell && onOpen) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
        aria-label={`What's this: ${label}`}
        className={cn(
          variant === 'outline'
            ? 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border-1.5 border-line bg-surface-raised px-3 text-[13px] font-medium text-ink hover:bg-surface-sunken'
            : 'inline-flex shrink-0 items-center text-[12px] font-medium text-brand-text hover:underline',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40',
          className,
        )}
      >
        What&apos;s this?
      </button>
    );
  }
  if (!ask || !clientShell) return null;
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
        'inline-flex shrink-0 items-center gap-1 rounded-full text-[11.5px] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40',
        compact ? 'h-7 w-7 justify-center' : 'min-h-[28px] px-1.5',
        className,
      )}
    >
      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      {!compact && <span>What&apos;s this?</span>}
    </button>
  );
}
