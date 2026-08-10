'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, m, useReducedMotion, type Variants } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, Loader2, Lock, Unlock, Upload } from 'lucide-react';
import { ease } from '@/lib/motion';
import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  fileNameFromStoragePath,
  getMilestoneDocumentSignedUrl,
} from '@/lib/milestone-document-storage';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MilestoneFileDisplay } from '@/components/incorporation/MilestoneFileDisplay';
import { type SectionPendingItem } from '@/lib/milestone-section-completion';
import {
  EMPTY_PENDING_ITEMS,
  isImageStoragePath,
} from '@/views/incorporation/milestone-response-form-utils';

export function PendingFieldsHint({
  items,
  className,
  variant = 'section',
}: {
  items: SectionPendingItem[];
  className?: string;
  variant?: 'section' | 'step';
}) {
  if (!items.length) return null;
  return (
    <div className={cn('text-warning-text', className)}>
      <p className="text-[11px] font-medium text-warning">
        {variant === 'step' ? 'Still needed in this step' : 'Still needed'}
      </p>
      <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-warning-text/90">
        {items.slice(0, 6).map((item) => (
          <li key={item.fieldId} className="flex gap-1.5">
            <span aria-hidden>·</span>
            <span>{item.label}</span>
          </li>
        ))}
        {items.length > 6 && (
          <li className="text-warning-text/75">+ {items.length - 6} more</li>
        )}
      </ul>
    </div>
  );
}

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
              {!complete && pendingItems.length > 0 && (
                <PendingFieldsHint items={pendingItems} className="mt-1.5 pr-2" />
              )}
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
      size="icon"
      className={className}
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
        className="h-7 w-7 cursor-pointer hover:opacity-80"
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
  const name = fileNameFromStoragePath(storagePath);
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
      <div className="flex items-center gap-3 rounded-lg border border-border bg-raised/50 px-3 py-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading preview…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border role-accent-border role-accent-bg/40 px-3 py-2.5">
      {isImage && href ? (
        <Image
          src={href}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-12 w-12 rounded-md object-cover border border-border shrink-0"
        />
      ) : (
        <div className="h-12 w-12 rounded-md border border-border bg-panel flex items-center justify-center shrink-0">
          <Upload className="h-5 w-5 text-role" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">{name || label}</div>
        <MilestoneFileDisplay storagePath={storagePath} label={label} variant="card" />
      </div>
    </div>
  );
}

export function UploadedFilePreview(props: { storagePath: string; label: string }) {
  if (!props.storagePath.trim()) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-raised/50 px-3 py-2.5">
        <span className="text-sm text-muted-foreground">No file uploaded</span>
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
