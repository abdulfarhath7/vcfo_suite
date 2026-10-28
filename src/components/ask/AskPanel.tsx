'use client';

import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
// `m`, not `motion`: the app runs framer-motion in strict LazyMotion mode.
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { ease } from '@/lib/shell/motion';
import { cn } from '@/lib/utils';
import { AskComposer } from './AskComposer';
import { AskHome } from './AskHome';
import { useAskOptional } from './ask-context';
import { AskThread } from './AskThread';
import { ASK_PANEL_WIDTH, useAskLayoutMode } from './use-ask-layout';

const iconButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';

/** Prototype AskButton head: 52px, the title in 15px weight 500, no bot figure (R-04). */
function Header({ onClose }: { onClose: () => void }) {
  const ask = useAskOptional()!;
  const client = ask.shell === 'client';
  return (
    <div className="flex-none border-b border-line-soft">
      {ask.preview && (
        <div className="flex items-center gap-2 bg-brand-soft px-4 py-1.5 text-[12.5px] font-medium text-brand-text">
          Client view · {ask.preview.companyName}
          <button type="button" className="ml-auto underline underline-offset-2" onClick={() => ask.setPreview(null)}>
            Exit preview
          </button>
        </div>
      )}
      <div className="flex min-h-[52px] items-center gap-2.5 px-4">
        <h2 className="text-[15px] font-medium text-ink">Ask VCFO</h2>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
          {client ? 'Verified sources' : 'Firm-wide · read only'}
        </span>
        {ask.thread.length > 0 && (
          <button
            type="button"
            onClick={ask.reset}
            aria-label="Start a new conversation"
            title="New conversation"
            className={iconButton}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.6} />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close Ask VCFO" className={iconButton}>
          <X className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

function Body({ compactHome }: { compactHome: boolean }) {
  const ask = useAskOptional()!;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {ask.thread.length === 0 ? <AskHome /> : <AskThread />}
      </div>
      <div className="flex-none space-y-2 border-t border-line-soft p-3">
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
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30" />
          <Dialog.Content
            id="ask-panel"
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-md border-t-1.5 border-line bg-surface-raised shadow-dialog focus:outline-none"
          >
            <Dialog.Title className="sr-only">Ask VCFO</Dialog.Title>
            <div className="flex justify-center pt-2" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-line-strong" />
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
              className="fixed inset-0 z-40 bg-ink/15"
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
            className={cn('fixed inset-y-0 right-0 z-50 flex flex-col border-l-1.5 border-line bg-surface-raised shadow-dialog')}
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

