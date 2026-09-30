'use client';

import { useEffect } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { isAskShortcut } from '@/lib/ask/shortcut';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';


/** Top-bar "Ask VCFO" + ⌘J / Ctrl+J toggle (U4). Renders nothing without Ask VCFO. */
export function AskLauncher() {
  const ask = useAskOptional();
  const enabled = Boolean(ask?.enabled);
  const toggle = ask?.toggle;

  useEffect(() => {
    if (!enabled || !toggle) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isAskShortcut(e)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, toggle]);

  if (!ask || !enabled) return null;
  return (
    <button
      type="button"
      onClick={ask.toggle}
      aria-expanded={ask.open}
      aria-controls="ask-panel"
      aria-keyshortcuts="Meta+J Control+J"
      title="Ask VCFO (⌘J / Ctrl+J)"
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-[13px] text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        ask.open && 'bg-primary-light text-foreground',
      )}
    >
      <MessageCircleQuestion className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      <span className="hidden sm:inline">Ask VCFO</span>
      <span className="sr-only sm:hidden">Ask VCFO</span>
    </button>
  );
}
