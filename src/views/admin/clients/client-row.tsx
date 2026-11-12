import { cn } from '@/lib/utils';
import type { ClientHolder, ClientNow } from '@/lib/projects/client-row-facts';

/**
 * The staff Clients lists' shared cells. The facts behind them (stage, Now, next date, health)
 * live in `@/lib/projects/client-row-facts`, so the server's Excel export works them out the
 * same way; they are re-exported here so the pages keep one import.
 */
export * from '@/lib/projects/client-row-facts';

const HOLDER_DOT: Record<ClientHolder, string> = { client: 'bg-warning-mid', sbc: 'bg-info-mid', mca: 'bg-identity-mid' };
const HOLDER_LABEL: Record<ClientHolder, string> = { client: 'Waiting on the client', sbc: 'SBC step', mca: 'With MCA' };

/** 8px square before the step: amber for the client, blue for SBC, violet for MCA. */
export function HolderSquare({ holder, className }: { holder: ClientHolder; className?: string }) {
  return (
    <i
      className={cn('inline-block h-2 w-2 flex-none rounded-[2px]', HOLDER_DOT[holder], className)}
      title={HOLDER_LABEL[holder]}
      aria-label={HOLDER_LABEL[holder]}
      role="img"
    />
  );
}

/** The Now cell: holder square, mono step code in 12px muted, then the step name. */
export function NowCell({ now, className }: { now: ClientNow | null; className?: string }) {
  if (!now) return <span className={cn('text-ink-muted', className)}>—</span>;
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)} title={`${now.code} · ${now.title}`}>
      <HolderSquare holder={now.holder} />
      <span className="min-w-0 truncate">
        <span className="font-mono text-[12px] text-ink-muted">{now.code}</span> · <span className="text-ink-2">{now.title}</span>
      </span>
    </span>
  );
}

/**
 * Footer legend of the Clients lists (lg and up): the phase bar colours and the holder squares.
 */
export function ClientsLegend({ className }: { className?: string }) {
  const sw = 'inline-block h-2 w-2 flex-none rounded-[2px]';
  return (
    <div className={cn('hidden flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 text-[12.5px] text-ink-muted md:px-5 lg:flex', className)} aria-hidden>
      <span className="flex items-center gap-1.5">
        <i className={cn(sw, 'bg-positive-mid')} />
        Done
      </span>
      <span className="flex items-center gap-1.5">
        <i className={cn(sw, 'bg-brand')} />
        Current phase
      </span>
      <span className="flex items-center gap-1.5">
        <i className={cn(sw, 'bg-danger-mid')} />
        Stuck
      </span>
      <span className="flex items-center gap-1.5">
        <i className={cn(sw, 'bg-surface-sunken shadow-[inset_0_0_0_1px_oklch(var(--line))]')} />
        Not started
      </span>
      <span className="flex items-center gap-1.5">
        <HolderSquare holder="sbc" />
        SBC step
      </span>
      <span className="flex items-center gap-1.5">
        <HolderSquare holder="client" />
        Waiting on the client
      </span>
      <span className="flex items-center gap-1.5">
        <HolderSquare holder="mca" />
        With MCA
      </span>
    </div>
  );
}
