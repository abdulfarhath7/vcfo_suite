'use client';

import { useAskOptional } from './ask-context';

/** Bottom-right pill after a go-there link closed the panel; reopens where you left off (U3). R-04: text only. */
export function BackToAskPill() {
  const ask = useAskOptional();
  if (!ask?.enabled || !ask.backPill || ask.open) return null;
  return (
    <button
      type="button"
      onClick={() => ask.setOpen(true)}
      className="fixed bottom-5 right-5 z-40 inline-flex h-control-md items-center gap-2 rounded-md border-1.5 border-line-strong bg-surface-raised px-3.5 text-[14px] font-medium text-ink shadow-float hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
    >
      Back to Ask VCFO
    </button>
  );
}
