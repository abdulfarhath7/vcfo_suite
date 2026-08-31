'use client';

import { useQuery } from '@tanstack/react-query';
import { Eyebrow, GoldDivider, StatusDot, Surface, type DotTone } from '@/components/noir';
import { EmptyStateIllustrated } from '@/components/noir/EmptyStateIllustrated';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Read-only delivery log for one project — what the app tried to send, on which
 * channel, and what happened. Admin and manager only.
 *
 * Colour lives on the status chip alone, never as a row or panel fill:
 *   delivered / read → teal (success)
 *   queued / sent    → coral (waiting)
 *   failed           → rose (danger)
 *   skipped          → muted
 *
 * Note on primitives: this reuses `StatusDot` rather than `StatusPill` because
 * StatusPill's labels are checklist-specific ("Completed", "Overdue") and would
 * misdescribe a message delivery. No new status component is introduced.
 */

type DeliveryRow = {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  toAddress: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  createdAt: string;
};

const STATUS_TONE: Record<string, DotTone> = {
  delivered: 'success',
  read: 'success',
  queued: 'warning',
  sent: 'warning',
  failed: 'danger',
  skipped: 'muted',
};

const STATUS_CHIP: Record<string, string> = {
  delivered: 'bg-success-light text-success-text',
  read: 'bg-success-light text-success-text',
  queued: 'bg-warning-light text-warning-text',
  sent: 'bg-warning-light text-warning-text',
  failed: 'bg-danger-light text-danger-text',
  skipped: 'bg-muted text-text-tertiary',
};

/** `compliance_due_monthly` → `Compliance due monthly` */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

/** Skip and failure reasons are the whole point of the row — show them. */
function detailFor(row: DeliveryRow): string | null {
  if (row.status === 'skipped' && row.skipReason) {
    return humanise(row.skipReason);
  }
  if (row.status === 'failed' && row.errorCode) {
    return `Error ${row.errorCode}`;
  }
  return null;
}

export function ProjectDetailNotificationsPanel({
  engagementId,
}: {
  engagementId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['notification-deliveries', engagementId],
    enabled: Boolean(engagementId),
    queryFn: async (): Promise<DeliveryRow[]> => {
      const res = await fetch(
        `/api/engagements/${encodeURIComponent(engagementId)}/notification-deliveries`,
      );
      if (!res.ok) return [];
      const body = (await res.json().catch(() => ({}))) as {
        deliveries?: DeliveryRow[];
      };
      return Array.isArray(body.deliveries) ? body.deliveries : [];
    },
  });

  const rows = data ?? [];

  return (
    <Surface className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Send className="h-3.5 w-3.5 text-gold" />
        <Eyebrow>Notifications sent</Eyebrow>
      </div>
      <GoldDivider className="mb-3" />

      {isLoading ? (
        <p className="text-[12px] text-paper-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyStateIllustrated
          art="inbox"
          title="Nothing sent yet"
          description="Emails and WhatsApp nudges for this project will be listed here."
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const tone = STATUS_TONE[row.status] ?? 'muted';
            const chip = STATUS_CHIP[row.status] ?? STATUS_CHIP.skipped;
            const detail = detailFor(row);
            return (
              <li key={row.id} className="text-[12px] leading-relaxed">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-paper">{humanise(row.eventType)}</span>
                    <span className="text-paper-subtle"> · {row.channel}</span>
                    <div className="truncate text-[11.5px] text-paper-muted">
                      {row.recipientName || row.recipientEmail || row.toAddress || '—'}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium',
                      chip,
                    )}
                  >
                    <StatusDot tone={tone} size={6} />
                    {humanise(row.status)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-paper-subtle mono">
                  <span>{formatWhen(row.createdAt)}</span>
                  {detail ? <span>· {detail}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}
