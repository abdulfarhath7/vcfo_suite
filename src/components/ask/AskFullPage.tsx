'use client';

import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { AskComposer } from './AskComposer';
import { AskHome } from './AskHome';
import { useAskOptional } from './ask-context';
import { AskThread } from './AskThread';

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * The full Ask VCFO page, `/app/<role>/ask` (owner item F4, 30 Oct 2026). Past chats on the
 * left, the conversation on the right, with the same thread, answer cards and composer as the
 * pop-up. It reads and writes the same Ask provider, so "Open full page" in the pop-up shows the
 * same conversation. While the page is on screen the pop-up hides (`pageOpen`).
 */
export function AskFullPage() {
  const ask = useAskOptional();
  const { user } = useApp();
  const setPageOpen = ask?.setPageOpen;
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!setPageOpen) return;
    setPageOpen(true);
    return () => setPageOpen(false);
  }, [setPageOpen]);

  useEffect(() => {
    mainRef.current?.querySelector<HTMLTextAreaElement>('#ask-composer')?.focus();
  }, [ask?.conversationId]);

  if (!ask?.enabled) {
    return (
      <div className="cp-tw">
        <p className="rounded-md border-1.5 border-line bg-surface-raised px-4 py-6 text-center text-[14px] text-ink-muted">Ask VCFO is off</p>
      </div>
    );
  }

  const client = ask.shell === 'client';
  const scoped = user?.role === 'manager' || user?.role === 'intern';
  const current = ask.conversationId;

  return (
    <div className="cp-tw">
      <div className="grid h-[calc(100dvh-140px)] min-h-[480px] grid-cols-1 overflow-hidden rounded-md border-1.5 border-line bg-surface-raised text-ink md:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Past chats" className="hidden min-h-0 flex-col border-r border-line-soft md:flex">
          <div className="flex min-h-[52px] flex-none items-center gap-2 border-b border-line-soft px-3">
            <h2 className="flex-1 text-[14px] font-medium text-ink">Chats</h2>
            <button
              type="button"
              onClick={ask.reset}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border-1.5 border-line-strong bg-surface-raised px-2.5 text-[13px] font-medium text-ink hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
            >
              <Plus className="h-4 w-4" strokeWidth={1.6} aria-hidden />
              New chat
            </button>
          </div>
          {ask.history.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-ink-faint">No past chats</p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {ask.history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    aria-current={h.id === current ? 'true' : undefined}
                    onClick={() => ask.openConversation(h.id)}
                    className={cn(
                      'flex w-full items-baseline gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25',
                      h.id === current ? 'bg-brand-soft text-brand-text hover:bg-brand-soft' : 'text-ink-2',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{h.title}</span>
                    <span className="flex-none text-[12px] tabular-nums text-ink-faint">{shortDate(h.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <section ref={mainRef} aria-label="Ask VCFO" className="flex min-h-0 flex-col">
          <div className="flex min-h-[52px] flex-none items-center gap-2.5 border-b border-line-soft px-4">
            {ask.preview && (
              <span className="rounded-sm bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand-text">Client view · {ask.preview.companyName}</span>
            )}
            <h1 className="text-[15px] font-medium text-ink">Ask VCFO</h1>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
              {client ? 'Verified sources' : scoped ? 'Your clients · read only' : 'Firm-wide · read only'}
            </span>
            <button
              type="button"
              onClick={ask.reset}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 md:hidden"
            >
              <Plus className="h-4 w-4" strokeWidth={1.6} aria-hidden />
              New chat
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto w-full max-w-[760px]">{ask.thread.length === 0 ? <AskHome /> : <AskThread />}</div>
          </div>
          <div className="flex-none border-t border-line-soft px-4 py-3">
            <div className="mx-auto w-full max-w-[760px] space-y-2">
              {ask.thread.length > 0 && <AskHome compact />}
              <AskComposer />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
