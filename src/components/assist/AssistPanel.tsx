'use client';

import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageCircleQuestion, RotateCcw, X } from 'lucide-react';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AssistComposer } from './AssistComposer';
import { AssistHome } from './AssistHome';
import { useAssistOptional } from './assist-context';
import { AssistThread } from './AssistThread';
import { ASSIST_PANEL_WIDTH, useAssistLayoutMode } from './use-assist-layout';

function Header({ onClose }: { onClose: () => void }) {
  const assist = useAssistOptional()!;
  const client = assist.shell === 'client';
  return (
    <div className="border-b border-border">
      {assist.preview && (
        <div className="flex items-center gap-2 bg-phase-pre-soft px-4 py-1.5 text-[12px] text-phase-pre-text">
          Client view · {assist.preview.companyName}
          <button type="button" className="ml-auto underline" onClick={() => assist.setPreview(null)}>
            Exit preview
          </button>
        </div>
      )}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-muted text-foreground" aria-hidden>
          <MessageCircleQuestion className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">Assist</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {client ? 'Answers from verified sources' : 'Firm-wide · read only'}
          </p>
        </div>
        {assist.thread.length > 0 && (
          <button
            type="button"
            onClick={assist.reset}
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
          aria-label="Close Assist"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Body({ compactHome }: { compactHome: boolean }) {
  const assist = useAssistOptional()!;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {assist.thread.length === 0 ? <AssistHome /> : <AssistThread />}
      </div>
      <div className="space-y-2 border-t border-border px-4 pb-4 pt-3">
        {assist.thread.length > 0 && compactHome && <AssistHome compact />}
        <AssistComposer />
      </div>
    </>
  );
}

/**
 * The panel (§7.3): 400 px side panel that pushes content at ≥1440 px and
 * overlays below that; a bottom sheet dialog with a focus trap under 1024 px.
 */
export function AssistPanel() {
  const assist = useAssistOptional();
  const mode = useAssistLayoutMode();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const open = Boolean(assist?.open);
  const close = () => assist?.setOpen(false);

  // Esc closes the side panel; the bottom sheet gets it from Radix.
  useEffect(() => {
    if (!open || mode === 'sheet') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') assist?.setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, assist]);

  useEffect(() => {
    if (open && mode !== 'sheet') {
      panelRef.current?.querySelector<HTMLTextAreaElement>('#assist-composer')?.focus();
    }
  }, [open, mode]);

  if (!assist?.enabled) return null;

  if (mode === 'sheet') {
    return (
      <Dialog.Root open={open} onOpenChange={assist.setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Content
            id="assist-panel"
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-[calc(var(--radius)+6px)] border-t border-border bg-background shadow-xl focus:outline-none"
          >
            <Dialog.Title className="sr-only">Assist</Dialog.Title>
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
            <motion.div
              key="assist-scrim"
              className="fixed inset-0 z-40 bg-foreground/15"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease }}
              onClick={close}
              aria-hidden
            />
          )}
          <motion.aside
            key="assist-panel"
            id="assist-panel"
            ref={panelRef}
            role="complementary"
            aria-label="Assist"
            className={cn('fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-background shadow-xl')}
            style={{ width: ASSIST_PANEL_WIDTH }}
            initial={reduceMotion ? { opacity: 0 } : { x: ASSIST_PANEL_WIDTH }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: ASSIST_PANEL_WIDTH }}
            transition={{ duration: reduceMotion ? 0.1 : 0.2, ease }}
          >
            <Header onClose={close} />
            <Body compactHome={false} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

