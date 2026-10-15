'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Send } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { DashDataTable, type DashColumn } from '@/components/dash/DashDataTable';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { apiFetch } from '@/lib/engagements-db';
import { maskPhone } from '@/lib/notify/phone';
import { skipReasonText, whatsappErrorText } from '@/lib/notify/whatsapp-error-text';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/** One row of `GET /api/engagements/:id/notification-deliveries`. */
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
  retryOf: string | null;
  createdAt: string;
};

type ChannelFilter = 'all' | 'email' | 'whatsapp';
type StatusFilter = 'all' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'read', label: 'Read' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

const EVENT_LABEL: Record<string, string> = {
  welcome: 'Welcome',
  coi_issued: 'Certificate issued',
  document_delivered: 'Document delivered',
  compliance_due_monthly: 'Monthly filing due',
  compliance_due_quarterly: 'Quarterly filing due',
  compliance_overdue: 'Filing overdue',
  step_awaiting_approval: 'Ready for approval',
  phase_approved: 'Step approved',
  client_action_needed: 'Details needed',
  documents_shared: 'Documents shared',
  staff_client_submitted: 'Client submitted',
  staff_client_uploaded: 'Client uploaded',
  staff_change_requested: 'Change requested',
  process_notice: 'Process update',
};

const STATUS_TONE: Record<string, string> = {
  queued: 'bg-muted text-muted-foreground',
  sent: 'bg-primary-light text-primary-dark',
  delivered: 'bg-success-light text-success-text',
  read: 'bg-success-light text-success-text',
  failed: 'bg-danger-light text-danger-text',
  skipped: 'bg-warning-light text-warning-text',
};

const TIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function sendLogQueryKey(engagementId: string) {
  return ['notification-deliveries', engagementId] as const;
}

function reasonFor(row: DeliveryRow): string {
  if (row.status === 'skipped') return skipReasonText(row.skipReason) ?? '';
  if (row.status === 'failed') {
    return row.channel === 'whatsapp' ? whatsappErrorText(row.errorCode) : (row.errorCode ?? 'Failed');
  }
  return '';
}

function toFor(row: DeliveryRow): string {
  const who = row.recipientName?.trim() || row.recipientEmail || '—';
  if (row.channel === 'whatsapp') {
    const masked = maskPhone(row.toAddress);
    return masked ? `${who} · ${masked}` : who;
  }
  return row.toAddress && row.toAddress !== who ? `${who} · ${row.toAddress}` : who;
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm px-1.5 py-px text-[11px] font-semibold capitalize',
        STATUS_TONE[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  );
}

/**
 * SEND LOG — what the app sent for this project, on which channel, and what
 * happened. Admin and manager only; a failed WhatsApp row can be retried.
 */
export function SendLogPanel({ engagementId }: { engagementId: string }) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const query = useQuery({
    queryKey: sendLogQueryKey(engagementId),
    queryFn: async () =>
      (
        await apiFetch<{ deliveries: DeliveryRow[] }>(
          `/api/engagements/${encodeURIComponent(engagementId)}/notification-deliveries`,
          { fallbackError: 'Could not load the send log.' },
        )
      ).deliveries,
    staleTime: 15_000,
  });

  const retry = useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch<{ ok: true }>(
        `/api/engagements/${encodeURIComponent(engagementId)}/notification-deliveries/${deliveryId}/retry`,
        { method: 'POST', fallbackError: 'Could not retry this message.' },
      ),
    onSuccess: async () => {
      toastSuccess('Retry queued', 'The send log updates once WhatsApp answers.');
      await queryClient.invalidateQueries({ queryKey: sendLogQueryKey(engagementId) });
    },
    onError: (err) => toastError('Retry failed', errorMessage(err)),
  });

  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (row) => (channel === 'all' || row.channel === channel) && (status === 'all' || row.status === status),
      ),
    [query.data, channel, status],
  );

  const retryButton = (row: DeliveryRow) =>
    row.channel === 'whatsapp' && row.status === 'failed' ? (
      <button
        type="button"
        onClick={() => retry.mutate(row.id)}
        disabled={retry.isPending && retry.variables === row.id}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        aria-label={`Retry WhatsApp to ${row.recipientName ?? 'recipient'}`}
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        Retry
      </button>
    ) : null;

  const columns: DashColumn<DeliveryRow>[] = [
    {
      key: 'time',
      header: 'Time',
      width: 'minmax(0,0.8fr)',
      mono: true,
      render: (row) => TIME.format(new Date(row.createdAt)),
    },
    {
      key: 'channel',
      header: 'Channel',
      width: 'minmax(0,0.6fr)',
      render: (row) => (row.channel === 'whatsapp' ? 'WhatsApp' : 'Email'),
    },
    {
      key: 'event',
      header: 'Event',
      width: 'minmax(0,1fr)',
      render: (row) => (
        <span className="block truncate">
          {EVENT_LABEL[row.eventType] ?? row.eventType}
          {row.retryOf ? <span className="ml-1 font-normal text-muted-foreground">(retry)</span> : null}
        </span>
      ),
    },
    {
      key: 'to',
      header: 'To',
      width: 'minmax(0,1.4fr)',
      render: (row) => <span className="block truncate font-medium">{toFor(row)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 'minmax(0,0.6fr)',
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: 'reason',
      header: 'Reason',
      width: 'minmax(0,1.4fr)',
      render: (row) => (
        <span className="block truncate text-[12px] font-medium text-muted-foreground">{reasonFor(row) || '—'}</span>
      ),
    },
    { key: 'retry', header: '', width: '84px', align: 'right', render: retryButton },
  ];

  return (
    <DashSection
      icon={Send}
      tone="primary"
      title="Send log"
      meta={query.data ? `${rows.length} of ${query.data.length}` : undefined}
      bodyClassName="px-0 pb-0"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2.5">
        <SegmentedPicker<ChannelFilter>
          value={channel}
          options={[
            { value: 'all', label: 'All' },
            { value: 'email', label: 'Email' },
            { value: 'whatsapp', label: 'WhatsApp' },
          ]}
          onChange={setChannel}
          ariaLabel="Filter by channel"
          size="sm"
        />
        <SegmentedPicker<StatusFilter>
          value={status}
          options={STATUS_FILTERS}
          onChange={setStatus}
          ariaLabel="Filter by status"
          size="sm"
          className="ml-auto"
        />
      </div>
      {query.isPending ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">Loading the send log…</p>
      ) : query.isError ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          Could not load the send log. Please try again in a moment.
        </p>
      ) : (
        <DashDataTable
          bare
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={
            query.data.length === 0
              ? 'Nothing has been sent for this project yet.'
              : 'No messages match these filters.'
          }
          mobile={(row) => (
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {EVENT_LABEL[row.eventType] ?? row.eventType} ·{' '}
                  {row.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </p>
                <p className="truncate text-[12px] font-medium text-muted-foreground">{toFor(row)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                  <StatusChip status={row.status} />
                  <span className="font-mono">{TIME.format(new Date(row.createdAt))}</span>
                  {reasonFor(row) ? <span>{reasonFor(row)}</span> : null}
                </p>
              </div>
              {retryButton(row)}
            </div>
          )}
        />
      )}
    </DashSection>
  );
}
