'use client';

/**
 * Spectrum overlays for the Compliances and Registrations pages (prototype src/components/ui/Modal.tsx
 * and SidePanel.tsx): a centred dialog on the navy scrim and a full-height side panel at the right
 * edge. Both are Tailwind islands fixed to the viewport, so they never inherit the legacy board
 * CSS. Esc and the scrim close them, focus stays inside (useModal), and focus returns to the opener.
 * On phones the dialog is a bottom sheet and the side panel takes the full width.
 */
import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModal } from './bits';

/** Above the portal chrome (sidebar, top bar, Ask panel); below the portal toast and tooltip. */
const Z = 'z-[2147482600]';

const WIDTH = { sm: 'sm:max-w-[420px]', md: 'sm:max-w-[560px]', lg: 'sm:max-w-[760px]', xl: 'sm:max-w-[1000px]' } as const;

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="grid h-8 w-8 flex-none place-items-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink"
    >
      <X size={16} strokeWidth={1.6} aria-hidden />
    </button>
  );
}

export function CpModal({
  title,
  titleId,
  eyebrow,
  sub,
  footer,
  size = 'md',
  flush,
  onClose,
  children,
}: {
  title: ReactNode;
  /** Id of the title element (the dialog's accessible name). */
  titleId: string;
  /** Small line above the title. */
  eyebrow?: ReactNode;
  /** Chips or small text under the title. */
  sub?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof WIDTH;
  /** No body padding: for lists and grids. */
  flush?: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, onClose);
  return (
    <div className={cn('cp-tw fixed inset-0', Z)}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Esc closes (useModal) */}
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-md border border-line bg-surface-raised text-ink shadow-dialog outline-none',
          'sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md',
          WIDTH[size],
        )}
      >
        <span className="mx-auto mt-2 block h-1 w-9 flex-none rounded-bar bg-line-strong sm:hidden" aria-hidden />
        <header className="flex min-h-[52px] flex-none items-start gap-3 border-b border-line-soft px-4 py-3 md:px-5">
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="truncate text-[12.5px] text-ink-muted">{eyebrow}</div> : null}
            <h2 id={titleId} className="text-[15px] font-medium leading-snug text-ink">
              {title}
            </h2>
            {sub ? <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">{sub}</div> : null}
          </div>
          <CloseButton onClose={onClose} />
        </header>
        <div className={cn('min-h-0 flex-1 overflow-y-auto', !flush && 'px-4 py-4 md:px-5')}>{children}</div>
        {footer ? <footer className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-line-soft px-4 py-3 md:px-5">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function CpSidePanel({
  title,
  titleId,
  eyebrow,
  sub,
  footer,
  width = 520,
  onClose,
  children,
}: {
  title: ReactNode;
  titleId: string;
  eyebrow?: ReactNode;
  sub?: ReactNode;
  footer?: ReactNode;
  width?: number;
  onClose: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, onClose);
  return (
    <div className={cn('cp-tw fixed inset-0', Z)}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Esc closes (useModal) */}
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface-raised text-ink shadow-dialog outline-none"
        style={{ maxWidth: width }}
      >
        <header className="flex flex-none items-start gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="flex min-w-0 items-center gap-2 truncate text-[12.5px] text-ink-muted">{eyebrow}</div> : null}
            <h2 id={titleId} className="mt-0.5 text-[15px] font-medium leading-snug text-ink">
              {title}
            </h2>
            {sub ? <div className="mt-2 flex flex-wrap items-center gap-2">{sub}</div> : null}
          </div>
          <CloseButton onClose={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <footer className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-3">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** A titled block inside a side panel or dialog, with a hairline under it. */
export function PanelSection({ title, right, flush, className, children }: { title?: ReactNode; right?: ReactNode; flush?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('border-b border-line-soft last:border-b-0', !flush && 'px-5 py-4', className)}>
      {title || right ? (
        <div className={cn('mb-2 flex items-center gap-2', flush && 'px-5 pt-4')}>
          {title ? <h3 className="flex-1 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">{title}</h3> : <span className="flex-1" />}
          {right}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Label and value pairs in one or two columns (prototype KeyValue). Identifiers go in mono (R-28). */
export function KeyValue({ rows, cols = 2 }: { rows: Array<{ k: string; v: ReactNode; mono?: boolean }>; cols?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', cols === 2 && 'sm:grid-cols-2')}>
      {rows.map((r) => (
        <div key={r.k} className="min-w-0">
          <dt className="text-[12.5px] text-ink-muted">{r.k}</dt>
          <dd className={cn('mt-0.5 min-w-0 break-words text-[13.5px] font-medium text-ink', r.mono && 'font-mono text-[13px]')}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
