'use client';

import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { GlossaryTerm as Term } from '@/data/assist/schema';
import { GLOSSARY } from '@/data/assist/glossary';
import { withGlossary } from '@/lib/assist/glossary-match';
import { useAssistOptional } from './assist-context';

/** One underlined term: hover (desktop) or tap (mobile) shows a one-line card (F2). */
export function GlossaryTerm({ term, children }: { term: Term; children: string }) {
  const assist = useAssistOptional();
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => e.stopPropagation()}
          className="cursor-help underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {children}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="z-50 max-w-[260px] rounded-[var(--radius-md)] border border-border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <p className="text-[12.5px] font-semibold">{term.term}</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{term.short}</p>
          {assist?.enabled && assist.shell === 'client' && (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-primary underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                assist.setOpen(true);
                if (term.topicSlug) void assist.showTopic(term.topicSlug, undefined, `What is ${term.term}?`);
                else void assist.ask({ context: { kind: 'field', ref: term.term, label: term.term } });
              }}
            >
              Explain more
            </button>
          )}
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Text with the first occurrence of each known term underlined. Renders the
 * plain string for anyone without client Assist (managers, Project Leads).
 * Never used on `checklist.ts` strings at source — only at render time.
 */
export function GlossaryText({ text, className }: { text: string; className?: string }) {
  const assist = useAssistOptional();
  const active = Boolean(assist?.enabled && assist.shell === 'client');
  const segments = useMemo(() => (active ? withGlossary(text, GLOSSARY) : [{ text }]), [active, text]);
  if (!active) return className ? <span className={className}>{text}</span> : <>{text}</>;
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        'term' in seg ? (
          <GlossaryTerm key={i} term={seg.term}>
            {seg.text}
          </GlossaryTerm>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
