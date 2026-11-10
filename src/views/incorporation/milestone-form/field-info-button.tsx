'use client';

import * as Popover from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';

/**
 * A "?" beside a form label that opens the field's help text (owner, 10 Nov: what
 * "Authorised capital" means should be one click away). Every field with `helperText`
 * gets it, for the client and for staff.
 */
export function FieldInfoButton({ label, text }: { label: string; text: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          // Not named after the field, so the field's own label still finds only its input.
          aria-label="What does this mean?"
          title="What does this mean?"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-w-[280px] rounded-[var(--radius-md)] border border-line bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <p className="text-[12px] font-semibold">{label.replace(/\s*\(.*$/, '')}</p>
          <p className="mt-0.5 whitespace-pre-line text-[12.5px] text-ink-muted">{text}</p>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
