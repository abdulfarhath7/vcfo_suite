'use client';

import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
// `m`, not `motion`: the app runs framer-motion in strict LazyMotion mode.
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { ease } from '@/lib/shell/motion';
import { useApp } from '@/context/AppContext';
import { AskComposer } from './AskComposer';
import { AskHome } from './AskHome';
import { useAskOptional } from './ask-context';
import { AskThread } from './AskThread';
import { ASK_PANEL_HEIGHT, ASK_PANEL_WIDTH, useAskLayoutMode } from './use-ask-layout';

const iconButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';

/** Prototype AskButton head: 52px, the title in 15px weight 500, no bot figure (R-04). */
function Header({ onClose }: { onClose: () => void }) {
  const ask = useAskOptional()!;
  const { user } = useApp();
  const client = ask.shell === 'client';
  // Managers and leads read through their own scope, not the whole firm.
  const scoped = user?.role === 'manager' || user?.role === 'intern';
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
          {client ? 'Verified sources' : scoped ? 'Your clients · read only' : 'Firm-wide · read only'}
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
 * The panel (§7.3, VCFO Spectrum F-299): from 640 px a floating card at the bottom right,
 * 420 x 620 px, 6 px corners and the dialog shadow, with no scrim. Under 640 px it fills
 * the screen as a dialog with a focus trap.
 */
export function AskPanel() {
  const ask = useAskOptional();
  const mode = useAskLayoutMode();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const open = Boolean(ask?.open);
  const close = () => ask?.setOpen(false);

  // Esc closes the floating card; the phone dialog gets it from Radix.
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
          <Dialog.Content
            id="ask-panel"
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col bg-surface-raised focus:outline-none"
          >
            <Dialog.Title className="sr-only">Ask VCFO</Dialog.Title>
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
        <m.aside
          key="ask-panel"
          id="ask-panel"
          ref={panelRef}
          role="complementary"
          aria-label="Ask VCFO"
          className="fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-md border border-line bg-surface-raised shadow-dialog"
          style={{
            width: `min(${ASK_PANEL_WIDTH}px, calc(100vw - 40px))`,
            height: `min(${ASK_PANEL_HEIGHT}px, calc(100vh - 40px))`,
          }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.16, ease }}
        >
          <Header onClose={close} />
          <Body compactHome />
        </m.aside>
      )}
    </AnimatePresence>
  );
}
