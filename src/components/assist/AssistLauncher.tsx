'use client';

import { useEffect } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { isAssistShortcut } from '@/lib/assist/shortcut';
import { cn } from '@/lib/utils';
import { useAssistOptional } from './assist-context';


/** Top-bar "Ask Assist" + ⌘J / Ctrl+J toggle (U4). Renders nothing without Assist. */
export function AssistLauncher() {
  const assist = useAssistOptional();
  const enabled = Boolean(assist?.enabled);
  const toggle = assist?.toggle;

  useEffect(() => {
    if (!enabled || !toggle) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isAssistShortcut(e)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, toggle]);

  if (!assist || !enabled) return null;
  return (
    <button
      type="button"
      onClick={assist.toggle}
      aria-expanded={assist.open}
      aria-controls="assist-panel"
      aria-keyshortcuts="Meta+J Control+J"
      title="Ask Assist (⌘J / Ctrl+J)"
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-[13px] text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        assist.open && 'bg-primary-light text-foreground',
      )}
    >
      <MessageCircleQuestion className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      <span className="hidden sm:inline">Ask Assist</span>
      <span className="sr-only sm:hidden">Ask Assist</span>
    </button>
  );
}
