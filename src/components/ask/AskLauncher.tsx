'use client';

import { useEffect } from 'react';
import { MessageCircleQuestion, Sparkles } from 'lucide-react';
import { isAskShortcut } from '@/lib/ask/shortcut';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

/** True when the person is typing, so "/" stays a character. */
function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * "Ask VCFO" + ⌘J / Ctrl+J toggle (U4); "/" opens it too (R-45). Renders nothing without
 * Ask VCFO. `variant="sidebar"` is the VCFO Spectrum sidebar button at the bottom of the
 * navy rail (R-45: never a floating bubble). Mount the shortcut once per page: pass
 * `withShortcut={false}` on every copy but one.
 */
export function AskLauncher({
  variant = 'top',
  expanded = true,
  withShortcut = true,
}: {
  variant?: 'top' | 'sidebar';
  expanded?: boolean;
  withShortcut?: boolean;
} = {}) {
  const ask = useAskOptional();
  const enabled = Boolean(ask?.enabled);
  const toggle = ask?.toggle;
  const isOpen = Boolean(ask?.open);

  useEffect(() => {
    if (!enabled || !toggle || !withShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (isAskShortcut(e)) {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isOpen && !isTyping(e.target)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, toggle, withShortcut, isOpen]);

  if (!ask || !enabled) return null;
  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={ask.toggle}
        aria-expanded={ask.open}
        aria-controls="ask-panel"
        aria-keyshortcuts="/ Meta+J Control+J"
        title="Ask VCFO (/)"
        className={cn(
          'flex h-[38px] w-full items-center gap-2.5 rounded-md border-1.5 border-side-line px-2.5 text-[14px] font-medium text-white transition-colors hover:bg-side-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          !expanded && 'justify-center px-0',
          ask.open && 'bg-side-active',
        )}
      >
        <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-mark bg-brand text-white" aria-hidden>
          <Sparkles className="h-[13px] w-[13px]" strokeWidth={1.6} />
        </span>
        <span className={cn('flex-1 text-left', !expanded && 'sr-only')}>Ask VCFO</span>
        {expanded ? (
          <kbd className="rounded-sm border border-side-line bg-white/[.07] px-[5px] font-sans text-[11px] font-medium leading-[18px] text-side-muted">
            /
          </kbd>
        ) : null}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={ask.toggle}
      aria-expanded={ask.open}
      aria-controls="ask-panel"
      aria-keyshortcuts="Meta+J Control+J"
      title="Ask VCFO (⌘J / Ctrl+J)"
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 transition-colors hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40',
        ask.open && 'bg-brand-soft text-ink',
      )}
    >
      <MessageCircleQuestion className="h-4 w-4" strokeWidth={1.6} aria-hidden />
      <span className="hidden sm:inline">Ask VCFO</span>
      <span className="sr-only sm:hidden">Ask VCFO</span>
    </button>
  );
}
