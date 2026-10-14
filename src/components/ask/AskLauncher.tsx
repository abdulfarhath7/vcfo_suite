'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircleQuestion } from 'lucide-react';
import { isAskShortcut } from '@/lib/ask/shortcut';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';


/** Top-bar "Ask VCFO" + ⌘J / Ctrl+J toggle (U4). Renders nothing without Ask VCFO. */
export function AskLauncher({ placement = 'fixed' }: { placement?: 'fixed' | 'inline' }) {
  const ask = useAskOptional();
  const pathname = usePathname();
  const enabled = Boolean(ask?.enabled);
  const toggle = ask?.toggle;
  // The client home draws this button in the page, beside Team, so the
  // fixed copy does not sit on top of the dashboard.
  const parked = placement === 'fixed' && pathname === '/app/client/overview';

  useEffect(() => {
    if (parked || !enabled || !toggle) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isAskShortcut(e)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parked, enabled, toggle]);

  if (parked) return null;

  if (!ask || !enabled) return null;
  if (ask.backPill && !ask.open) return null;
  return (
    <button
      type="button"
      onClick={ask.toggle}
      aria-expanded={ask.open}
      aria-controls="ask-panel"
      aria-keyshortcuts="Meta+J Control+J"
      title="Ask VCFO (⌘J / Ctrl+J)"
      className={cn(
        placement === 'inline'
          ? 'inline-flex h-10 items-center gap-2 rounded-full bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
          : 'fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        ask.open && 'bg-primary-dark',
      )}
    >
      <MessageCircleQuestion className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      Ask VCFO
    </button>
  );
}
