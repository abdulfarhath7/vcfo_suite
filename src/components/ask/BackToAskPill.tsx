'use client';

import { MessageCircleQuestion } from 'lucide-react';
import { useAskOptional } from './ask-context';

/** Bottom-right pill after a go-there link closed the panel; reopens where you left off (U3). */
export function BackToAskPill() {
  const ask = useAskOptional();
  if (!ask?.enabled || !ask.backPill || ask.open) return null;
  return (
    <button
      type="button"
      onClick={() => ask.setOpen(true)}
      className="fixed bottom-5 right-5 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-line bg-surface-raised px-4 text-[13px] font-medium text-ink shadow-lg hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40"
    >
      <MessageCircleQuestion className="h-4 w-4" aria-hidden /> Back to Ask VCFO
    </button>
  );
}
