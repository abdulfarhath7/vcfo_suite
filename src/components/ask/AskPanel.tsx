'use client';

import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
// `m`, not `motion`: the app runs framer-motion in strict LazyMotion mode.
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { MessageCircleQuestion, RotateCcw, X } from 'lucide-react';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AskComposer } from './AskComposer';
import { AskHome } from './AskHome';
import { useAskOptional } from './ask-context';
import { AskThread } from './AskThread';
import { ASK_PANEL_WIDTH, useAskLayoutMode } from './use-ask-layout';

function Header({ onClose }: { onClose: () => void }) {
  const ask = useAskOptional()!;
  const client = ask.shell === 'client';
  return (
    <div className="border-b border-border">
      {ask.preview && (
        <div className="flex items-center gap-2 bg-phase-pre-soft px-4 py-1.5 text-[12px] text-phase-pre-text">
          Client view · {ask.preview.companyName}
          <button type="button" className="ml-auto underline" onClick={() => ask.setPreview(null)}>
            Exit preview
          </button>
        </div>
      )}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-muted text-foreground" aria-hidden>
          <MessageCircleQuestion className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">Ask VCFO</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {client ? 'Answers from verified sources' : 'Firm-wide · read only'}
          </p>
        </div>
        {ask.thread.length > 0 && (
          <button
            type="button"
            onClick={ask.reset}
            aria-label="Start a new conversation"
            title="New conversation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Ask VCFO"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Body({ compactHome }: { compactHome: boolean }) {
  const ask = useAskOptional()!;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {ask.thread.length === 0 ? <AskHome /> : <AskThread />}
      </div>
      <div className="space-y-2 border-t border-border px-4 pb-4 pt-3">
        {ask.thread.length > 0 && compactHome && <AskHome compact />}
        <AskComposer />
      </div>
    </>
  );
}

/**
 * The panel (§7.3): 400 px side panel that pushes content at ≥1440 px and
 * overlays below that; a bottom sheet dialog with a focus trap under 1024 px.
 */
export function AskPanel() {
  const ask = useAskOptional();
  const mode = useAskLayoutMode();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const open = Boolean(ask?.open);
  const close = () => ask?.setOpen(false);

  // Esc closes the side panel; the bottom sheet gets it from Radix.
  useEffect(() => {
    if (!open || mode === 'sheet') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ask?.setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, ask]);

  useEffect(() => {
    if (open && mode !== 'sheet') {
      panelRef.current?.querySelector<HTMLTextAreaElement>('#ask-composer')?.focus();
    }
  }, [open, mode]);

  if (!ask?.enabled) return null;

  if (mode === 'sheet') {
    return (
      <Dialog.Root open={open} onOpenChange={ask.setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Content
            id="ask-panel"
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-[calc(var(--radius)+6px)] border-t border-border bg-panel shadow-xl focus:outline-none"
          >
            <Dialog.Title className="sr-only">Ask VCFO</Dialog.Title>
            <div className="flex justify-center pt-2" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>
            <Header onClose={close} />
            <Body compactHome />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {mode === 'overlay' && (
            <m.div
              key="ask-scrim"
              className="fixed inset-0 z-40 bg-foreground/15"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease }}
              onClick={close}
              aria-hidden
            />
          )}
          <m.aside
            key="ask-panel"
            id="ask-panel"
            ref={panelRef}
            role="complementary"
            aria-label="Ask VCFO"
            className={cn('fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-panel shadow-xl')}
            style={{ width: ASK_PANEL_WIDTH }}
            initial={reduceMotion ? { opacity: 0 } : { x: ASK_PANEL_WIDTH }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: ASK_PANEL_WIDTH }}
            transition={{ duration: reduceMotion ? 0.1 : 0.2, ease }}
          >
            <Header onClose={close} />
            <Body compactHome={false} />
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}

