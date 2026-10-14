'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

/**
 * "Ask VCFO about this" on a dashboard card: opens the panel and asks the
 * card's question. Renders nothing where Ask VCFO is off or not the client's.
 */
export function AskAboutThis({ question, className }: { question: string; className?: string }) {
  const ask = useAskOptional();
  if (!ask?.enabled || ask.shell !== 'client') return null;
  return (
    <button
      type="button"
      disabled={ask.busy}
      onClick={() => {
        ask.setOpen(true);
        void ask.ask({ message: question });
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      Ask VCFO about this
    </button>
  );
}
