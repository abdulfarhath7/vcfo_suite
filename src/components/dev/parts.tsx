'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import type { Reach } from '@/lib/dev/types';
import { words } from '@/lib/dev/format';


/**
 * Parts shared by the developer console screens (G-01). They compose the Spectrum parts
 * (Chip, EmptyState, SpectrumTabs, EFilingGrid, CardHeadTile) and add only what the console
 * needs: a card whose head bar holds the filters (R-08), the "not set up" and "could not
 * reach" states, a key and value list, and the console's fetch hook.
 */

// ---------- Card ----------

/** R-15, R-16: a card with the 52px head. Filters sit in the head bar (R-08); the body is flush. */
export function DevCard({
  title,
  meta,
  filters,
  right,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  meta?: ReactNode;
  filters?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('surface min-w-0 overflow-hidden', className)}>
      <div className="flex min-h-[52px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line-soft px-4 py-2">
        <CardHeadTile title={title} />
        <h2 className="min-w-0 truncate text-[15px] font-medium text-ink">{title}</h2>
        {meta ? <span className="min-w-0 text-[12.5px] text-ink-muted">{meta}</span> : null}
        <span className="flex-1" />
        {filters ? <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div> : null}
        {right}
      </div>
      <div className={cn('min-w-0', bodyClassName)}>{children}</div>
    </section>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-[30px] w-[30px]" onClick={onClick} aria-label="Close">
      <X strokeWidth={1.6} />
    </Button>
  );
}

/** "Load older" under a paged grid. */
export function LoadOlder({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <div className="flex justify-center border-t border-line-soft px-4 py-3">
      <Button size="sm" variant="secondary" onClick={onClick} disabled={busy}>
        {busy ? 'Loading' : 'Load older'}
      </Button>
    </div>
  );
}

// ---------- States ----------

/** Loading, error and empty states for a card body (R-48). */
export function Pending({ error, rows = 4 }: { error?: unknown; rows?: number }) {
  if (error) {
    return (
      <div className="p-4">
        <EmptyState title={error instanceof Error ? error.message : 'Could not load'} />
      </div>
    );
  }
  return <SkeletonRows rows={rows} className="p-4" />;
}

/** The body for a reader that is not set up or could not reach its service. */
export function ReachNotice({ reach, service }: { reach: Exclude<Reach<unknown>, { state: 'ok' }>; service: string }) {
  return (
    <div className="p-4">
      <EmptyState
        title={
          reach.state === 'not_set_up' ? (
            <span className="grid gap-1">
              <span className="font-medium text-ink">{service} is not set up</span>
              <span>
                Set{' '}
                {reach.missing.map((m, i) => (
                  <span key={m}>
                    {i > 0 ? ', ' : ''}
                    <code className="font-mono text-[13px] text-ink-2">{m}</code>
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span className="grid gap-1">
              <span className="font-medium text-ink">Could not reach {service}</span>
              <span className="break-words">{reach.error}</span>
            </span>
          )
        }
      />
    </div>
  );
}

/** A Chip for a reader's state, for card heads. */
export function ReachChip({ reach }: { reach: Reach<unknown> }) {
  if (reach.state === 'ok') return <Chip tone="ok">Working</Chip>;
  if (reach.state === 'not_set_up') return <Chip tone="idle">Not set up</Chip>;
  return <Chip tone="bad">Unreachable</Chip>;
}

// ---------- Status words ----------

const TONE: Record<string, ChipTone> = {
  configured: 'ok',
  working: 'ok',
  connected: 'ok',
  sent: 'ok',
  delivered: 'ok',
  read: 'ok',
  completed: 'ok',
  succeeded: 'ok',
  running: 'prog',
  in_progress: 'prog',
  operation_in_progress: 'prog',
  queued: 'teal',
  pending: 'teal',
  partial: 'warn',
  'due soon': 'warn',
  'needs re-auth': 'bad',
  failed: 'bad',
  create_failed: 'bad',
  denied: 'bad',
  error: 'bad',
  warn: 'warn',
  info: 'idle',
  ok: 'ok',
  skipped: 'idle',
  off: 'idle',
  cancelled: 'idle',
  paused: 'idle',
  rollback_succeeded: 'warn',
  rollback_failed: 'bad',
  rollback_in_progress: 'warn',
};

const WORD: Record<string, string> = {
  configured: 'Working',
  partial: 'Partly set',
  off: 'Not set up',
  ok: 'OK',
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  completed: 'Completed',
  succeeded: 'Succeeded',
};

/**
 * Status chip for a console grid (R-13). Machine words get a tone from the table above and a
 * readable label. The console keeps words such as "Sent" and "Completed", because the six
 * client words do not describe a job or a message.
 */
export function StatusChip({ status, label, className }: { status: string; label?: string; className?: string }) {
  const key = status.trim().toLowerCase();
  const tone = TONE[key] ?? 'idle';
  const word = label ?? WORD[key] ?? words(status);
  return (
    <Chip tone={tone} className={cn('w-[124px]', className)}>
      <span className="truncate">{word}</span>
    </Chip>
  );
}

// ---------- Key and value ----------

export function KeyValue({ rows, cols = 3 }: { rows: Array<{ k: string; v: ReactNode; mono?: boolean }>; cols?: 2 | 3 | 4 }) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-3 px-4 py-4',
        cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {rows.map((r) => (
        <div key={r.k} className="min-w-0">
          <dt className="text-[12px] text-ink-muted">{r.k}</dt>
          <dd className={cn('mt-0.5 break-words text-[14px] text-ink', r.mono && 'font-mono text-[13px]')}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A row in a card list (R-19): full width, hairline between rows. */
export function ListRow({ href, children }: { href?: string; children: ReactNode }) {
  const cls = 'flex min-h-[52px] items-center gap-3 border-b border-line-soft px-4 py-2 text-[14px] last:border-b-0';
  return href ? (
    <Link href={href} className={cn(cls, 'hover:bg-surface-sunken/60')}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/** Env var names in mono (R-28: identifiers only). */
export function EnvNames({ names, tone = 'muted' }: { names: string[]; tone?: 'muted' | 'danger' }) {
  if (!names.length) return <span className="text-ink-faint">-</span>;
  return (
    <span className={cn('flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[12.5px]', tone === 'danger' ? 'text-danger' : 'text-ink-muted')}>
      {names.map((n) => (
        <span key={n}>{n}</span>
      ))}
    </span>
  );
}
