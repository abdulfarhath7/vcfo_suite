'use client';

import * as Popover from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';
import { fieldHelp } from '@/data/ask/field-help';
import { useAskOptional } from './ask-context';

/**
 * C3 "Why do we ask this?" — a reviewed one-liner beside a client form field.
 * Client persona only, behind ASK_VCFO_FEATURE_C3; renders nothing when the
 * field has no reviewed line. No model call.
 */
export function FieldHelpButton({ stepId, fieldId, label }: { stepId: string; fieldId: string; label: string }) {
  const ask = useAskOptional();
  if (!ask?.enabled || ask.shell !== 'client' || ask.preview || !ask.features.C3) return null;
  const text = fieldHelp(stepId, fieldId);
  if (!text) return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Why do we ask this: ${label}`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          className="z-50 max-w-[260px] rounded-[var(--radius-md)] border border-border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <p className="text-[12px] font-semibold">Why do we ask this?</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{text}</p>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
