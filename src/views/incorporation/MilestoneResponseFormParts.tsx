'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m, useReducedMotion, type Variants } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Lock, Unlock, Upload } from 'lucide-react';
import { ease } from '@/lib/motion';
import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { getMilestoneDocumentSignedUrl } from '@/lib/milestone-document-storage';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MilestoneFileDisplay } from '@/components/incorporation/MilestoneFileDisplay';
import { type SectionPendingItem } from '@/lib/milestone-section-completion';
import {
  EMPTY_PENDING_ITEMS,
  isImageStoragePath,
} from '@/views/incorporation/milestone-response-form-utils';
import {
  tabStripHorizontalDelta,
  tabStripOverflowState,
  tabStripScrollChunk,
} from '@/views/incorporation/intern-section-tab-strip';

export function Pre1SectionCard({
  index,
  title,
  children,
  complete,
  pendingItems = EMPTY_PENDING_ITEMS,
  defaultOpen = true,
}: {
  index: number;
  title: string;
  children: ReactNode;
  complete?: boolean;
  pendingItems?: SectionPendingItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface relative overflow-hidden bg-raised/50">
      <div className="accent-bar absolute left-0 top-3 bottom-3 w-[3px]" aria-hidden />
      <div className="pl-4 sm:pl-5">
        <header className="border-b border-border/70 py-3.5 pr-4 sm:pr-5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full gap-3 items-start text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-role/40 rounded-md"
            aria-expanded={open}
          >
            <span
              className={cn(
                'mono shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                complete ? 'bg-success-light text-success-text' : 'role-accent-bg text-role-foreground',
              )}
              aria-hidden
            >
              {complete ? <Check className="w-3 h-3 inline" /> : String(index).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-base font-semibold leading-snug text-foreground">{title}</h3>
            </span>
            <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-1', open && 'rotate-180')} />
          </button>
        </header>
        {open && <div className="p-5 sm:p-6 pt-4 space-y-4">{children}</div>}
      </div>
    </section>
  );
}

const unlockIconEase = ease;
const unlockIconMorphMs = 0.2;

const unlockIconVariants: Record<'lock' | 'unlock', Variants> = {
  lock: {
    initial: { opacity: 0, scale: 0.82, rotate: 14 },
    animate: { opacity: 1, scale: 1, rotate: 0 },
    exit: { opacity: 0, scale: 0.82, rotate: -14 },
  },
  unlock: {
    initial: { opacity: 0, scale: 0.82, rotate: -14 },
    animate: { opacity: 1, scale: 1, rotate: 0 },
    exit: { opacity: 0, scale: 0.82, rotate: 14 },
  },
};

const FIELD_UNLOCK_SLOT_CLASS = 'h-7 w-7 shrink-0 flex items-center justify-center';

export function FieldUnlockIconButton({
  isUnlocked,
  onClick,
  ariaLabel,
  className,
}: {
  isUnlocked: boolean;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const iconKey = isUnlocked ? 'unlock' : 'lock';
  const Icon = isUnlocked ? Unlock : Lock;
  const morphMs = reducedMotion ? 0 : unlockIconMorphMs;

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn('h-7 w-7 min-h-7 min-w-7 shrink-0 p-0', className)}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <AnimatePresence initial={false}>
          <m.span
            key={iconKey}
            className={cn(
              'absolute inset-0 inline-flex items-center justify-center',
              isUnlocked ? 'text-destructive' : 'text-success',
            )}
            variants={unlockIconVariants[iconKey]}
            initial={reducedMotion ? 'animate' : 'initial'}
            animate="animate"
            exit="exit"
            transition={{ duration: morphMs, ease: unlockIconEase }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </m.span>
        </AnimatePresence>
      </span>
    </Button>
  );
}

export function FieldUnlockControl({
  field,
  showUnlock,
  isUnlocked,
  onToggle,
}: {
  field: ChecklistField;
  showUnlock?: boolean;
  isUnlocked: boolean;
  onToggle: () => void;
}) {
  if (!showUnlock) return null;
  return (
    <span className={FIELD_UNLOCK_SLOT_CLASS}>
      <FieldUnlockIconButton
        isUnlocked={isUnlocked}
        onClick={onToggle}
        className="h-7 w-7 min-h-7 min-w-7 cursor-pointer hover:opacity-80"
        ariaLabel={
          isUnlocked
            ? `Lock ${field.label} for client`
            : `Allow client to edit ${field.label}`
        }
      />
    </span>
  );
}

function UploadedFilePreviewInner({
  storagePath,
  label,
}: {
  storagePath: string;
  label: string;
}) {
  const [href, setHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = isImageStoragePath(storagePath);

  useEffect(() => {
    let cancelled = false;
    void getMilestoneDocumentSignedUrl(storagePath).then((url) => {
      if (!cancelled) {
        setHref(url);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (loading) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-raised/50 px-2.5 py-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading preview…</span>
      </div>
    );
  }

  return (
    <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-raised/50 px-2.5 py-1.5">
      {isImage && href ? (
        <Image
          src={href}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="h-8 w-8 shrink-0 rounded-md object-cover border border-border"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel">
          <Upload className="h-3.5 w-3.5 text-role" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <MilestoneFileDisplay storagePath={storagePath} label={label} variant="card" />
      </div>
    </div>
  );
}

export function UploadedFilePreview(props: { storagePath: string; label: string }) {
  if (!props.storagePath.trim()) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-raised/50 px-2.5 py-1.5">
        <span className="text-xs text-muted-foreground">No file uploaded</span>
      </div>
    );
  }
  return <UploadedFilePreviewInner key={props.storagePath} {...props} />;
}

export function FormErrorSummary({
  errors,
  fields,
}: {
  errors: Record<string, string>;
  fields: ChecklistField[];
}) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger-light/90 px-4 py-3"
    >
      <div className="flex gap-2 items-start">
        <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {entries.length} item{entries.length === 1 ? '' : 's'} need attention before you continue
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {entries.slice(0, 6).map(([fieldId, message]) => {
              const field = fields.find((f) => f.id === fieldId);
              return (
                <li key={fieldId}>
                  <span className="font-medium text-foreground">{field?.label ?? fieldId}:</span>{' '}
                  {message}
                </li>
              );
            })}
            {entries.length > 6 && (
              <li className="text-muted-foreground">+ {entries.length - 6} more</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function InternSectionHeadingNav({
  sections,
  selectedIndex,
  onSelect,
}: {
  sections: { title: string; complete: boolean }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({
    overflowing: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflow(tabStripOverflowState(el.scrollLeft, el.scrollWidth, el.clientWidth));
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    el.addEventListener('scroll', updateOverflow, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateOverflow);
    };
  }, [sections.length, selectedIndex, updateOverflow]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const tab = el.querySelector(`#intern-section-tab-${selectedIndex}`);
    if (tab instanceof HTMLElement) {
      tab.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const delta = tabStripHorizontalDelta(event.deltaX, event.deltaY);
      if (delta === 0) return;
      event.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [sections.length]);

  const scrollTabs = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const tab = el.querySelector('[role="tab"]');
    const chunk = tabStripScrollChunk(
      tab instanceof HTMLElement ? tab.getBoundingClientRect().width : undefined,
    );
    el.scrollBy({ left: direction * chunk, behavior: 'smooth' });
  };

  if (sections.length === 0) return null;

  const arrowClass =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-raised hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

  return (
    <nav aria-label="Step sections" className="border-b border-border">
      <div className="flex h-11 min-w-0 items-stretch">
        {overflow.overflowing ? (
          <div className="flex w-9 shrink-0 items-center justify-center border-r border-border/60">
            <button
              type="button"
              className={arrowClass}
              aria-label="Scroll sections left"
              disabled={!overflow.canScrollLeft}
              onClick={() => scrollTabs(-1)}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
        <div
          ref={scrollerRef}
          className="flex min-w-0 flex-1 flex-nowrap items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
          role="tablist"
        >
          {sections.map((section, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                key={section.title}
                id={`intern-section-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(index)}
                className={cn(
                  'relative inline-flex h-full shrink-0 items-center whitespace-nowrap px-3 text-[13.5px] font-medium transition-colors',
                  selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {section.complete ? (
                    <Check className="h-3 w-3 shrink-0 text-success" aria-hidden />
                  ) : null}
                  {section.title}
                </span>
                {selected ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        {overflow.overflowing ? (
          <div className="flex w-9 shrink-0 items-center justify-center border-l border-border/60">
            <button
              type="button"
              className={arrowClass}
              aria-label="Scroll sections right"
              disabled={!overflow.canScrollRight}
              onClick={() => scrollTabs(1)}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
