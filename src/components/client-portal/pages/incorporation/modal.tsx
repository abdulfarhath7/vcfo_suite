'use client';

/**
 * VCFO Spectrum dialog for the client portal (prototype src/components/ui/Modal.tsx). It mounts
 * at the portal root (`.cp`) inside a Tailwind island, so the page's light or dark tokens apply
 * and no animated page wrapper traps its fixed position. A centred card from 640px, a bottom
 * sheet below. Escape and the scrim close it; Tab stays inside; focus returns to the opener.
 *
 * This file must not import `PortalProvider` (the provider draws the drill dialog with it).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WIDTHS = { sm: 'sm:max-w-[420px]', md: 'sm:max-w-[560px]', lg: 'sm:max-w-[760px]', xl: 'sm:max-w-[1000px]' } as const;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface PortalModalProps {
  onClose: () => void;
  title: ReactNode;
  /** Small muted line above the title. */
  eyebrow?: ReactNode;
  /** Small muted line or chips under the title. */
  sub?: ReactNode;
  /** Footer: one main button and secondary buttons (R-12). */
  footer?: ReactNode;
  /** Right side of the head, before the close button. */
  right?: ReactNode;
  size?: keyof typeof WIDTHS;
  /** No body padding: for lists. */
  flush?: boolean;
  /** Element that takes focus first (defaults to the first field, then the close button). */
  initialFocus?: React.RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
}

export function PortalModal({ onClose, title, eyebrow, sub, footer, right, size = 'md', flush, initialFocus, className, children }: PortalModalProps) {
  const [host, setHost] = useState<Element | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => setHost(document.querySelector('.cp') ?? document.body), []);

  useEffect(() => {
    if (!host) return;
    const last = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = initialFocus?.current ?? box.current?.querySelector<HTMLElement>('input,textarea,select') ?? closeRef.current;
      el?.focus({ preventScroll: true });
    }, 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !box.current) return;
      const list = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
      if (!list.length) return;
      const first = list[0]!;
      const end = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', key, true);
      last?.focus?.({ preventScroll: true });
    };
  }, [host, initialFocus]);

  if (!host) return null;
  return createPortal(
    <div className="cp-tw">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the scrim click closes; Escape is handled on the document */}
      <div className="fixed inset-0 z-[2147482000] bg-scrim motion-safe:animate-in motion-safe:fade-in-0" onClick={() => onCloseRef.current()} />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[2147482001] flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-md border border-line bg-surface-raised text-ink shadow-dialog outline-none',
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md',
          WIDTHS[size],
          className,
        )}
      >
        <header className="flex min-h-head items-start gap-3 border-b border-line-soft px-4 py-3 md:px-5">
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="truncate text-[12.5px] text-ink-muted">{eyebrow}</div> : null}
            <h2 id={titleId} className="m-0 text-[15px] font-medium leading-snug text-ink">
              {title}
            </h2>
            {sub ? <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">{sub}</div> : null}
          </div>
          {right ? <div className="flex flex-none items-center gap-2 self-center">{right}</div> : null}
          <button
            ref={closeRef}
            type="button"
            className="grid h-8 w-8 flex-none place-items-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
            aria-label="Close"
            onClick={() => onCloseRef.current()}
          >
            <X size={16} strokeWidth={1.6} aria-hidden />
          </button>
        </header>
        <div className={cn('min-h-0 flex-1 overflow-y-auto', !flush && 'px-4 py-4 md:px-5')}>{children}</div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-4 py-3 md:px-5">{footer}</footer> : null}
      </div>
    </div>,
    host,
  );
}

/** Text area in the Spectrum field look (prototype MessageModal). */
export function FieldArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  maxLength = 2000,
  areaRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  areaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <textarea
        ref={areaRef}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-md border-1.5 border-line-strong bg-surface-raised px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus-visible:border-brand focus-visible:shadow-[0_0_0_4px_oklch(var(--brand-soft))]"
      />
    </label>
  );
}
