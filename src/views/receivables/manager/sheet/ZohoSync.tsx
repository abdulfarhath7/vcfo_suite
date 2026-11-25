'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toastError } from '@/lib/toast-errors';
import { sheetSourceKey, useSheetSource, useSheetSourceActions, useZohoSheetJob, zohoJobKey } from '@/hooks/use-zoho-sheet-sync';
import type { TallyJobDto, TallyJobType } from '@/lib/receivables/tally-live/wire';
import { cn } from '@/lib/utils';
import { TOOL_BTN } from './PublishBar';
import { SyncDialog, SyncFailedModal, useSyncFinish } from './sync-shared';

/**
 * "Sync from Zoho" on the Sheet tab (docs/specs/integrations/ZOHO.md), for a sheet whose source is
 * Zoho Books. Same shape as Sync from Tally: the main half opens the period dialog, the caret holds
 * Invoices, Payments and the source menu. The sync reads Zoho in the background; the rows land in
 * the approval panel.
 */
const ZOHO_COPY: Record<TallyJobType, string> = {
  sales: 'Invoices of the period (not drafts or void) come in as rows to approve, the same as an Excel import.',
  receipts: 'Customer payments applied to invoices come in as payments to approve; approving marks the invoice received, or part-paid.',
};

export function ZohoSync({ sheetId, today, onImportExcel, onReview, menuExtra }: { sheetId: string; today: string; onImportExcel: () => void; onReview: () => void; menuExtra?: ReactNode }) {
  const qc = useQueryClient();
  const status = useSheetSource(sheetId);
  const actions = useSheetSourceActions(sheetId);
  const [syncType, setSyncType] = useState<TallyJobType | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [failed, setFailed] = useState<TallyJobDto | null>(null);

  const followId = jobId ?? status.data?.activeJob?.id ?? null;
  const job = useZohoSheetJob(sheetId, followId);
  const live = job.data && (job.data.status === 'queued' || job.data.status === 'running') ? job.data : null;
  const settle = useCallback(() => setJobId(null), []);
  const rearm = useSyncFinish({ sheetId, job: job.data, statusKey: sheetSourceKey(sheetId), sourceWord: 'Zoho Books', onReview, onFailed: setFailed, onSettled: settle });

  const ready = Boolean(status.data?.connected && status.data.zohoOrgId);
  const busy = Boolean(live) || actions.sync.isPending;
  const label = live ? 'Reading Zoho…' : 'Sync from Zoho';
  const title = !status.data?.connected ? 'Zoho is not connected (Firm settings > Integrations)' : status.data.zohoOrgName ? `Zoho ${status.data.zohoApp === 'invoice' ? 'Invoice' : 'Books'} · ${status.data.zohoOrgName}` : 'Zoho Books';

  return (
    <>
      <div className="inline-flex items-stretch">
        <Button size="sm" variant="secondary" className={cn(TOOL_BTN, 'rounded-r-none')} disabled={busy || !ready} onClick={() => setSyncType('sales')} title={title}>
          {busy ? <RefreshCw aria-hidden className="animate-spin" /> : <span aria-hidden className={cn('size-2 rounded-full', ready ? 'bg-positive' : 'bg-ink-faint')} />}
          {label}
          <span className="sr-only">{`. ${title}`}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className={cn(TOOL_BTN, '-ml-px rounded-l-none !px-1.5')} aria-label="More Zoho sync options">
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={busy || !ready} onSelect={() => setSyncType('sales')}>
              Invoices
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy || !ready} onSelect={() => setSyncType('receipts')}>
              Payments
            </DropdownMenuItem>
            {menuExtra ? <DropdownMenuSeparator /> : null}
            {menuExtra}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {syncType ? (
        <SyncDialog
          title="Sync from Zoho"
          copy={ZOHO_COPY}
          type={syncType}
          today={today}
          busy={actions.sync.isPending}
          sub={title}
          onType={setSyncType}
          onClose={() => setSyncType(null)}
          onSync={(input) =>
            actions.sync.mutate(input, {
              onSuccess: (j) => {
                rearm();
                qc.setQueryData(zohoJobKey(sheetId, j.id), j);
                setJobId(j.id);
                setSyncType(null);
              },
              onError: (e) => toastError('Sync not started', e instanceof Error ? e.message : undefined),
            })
          }
        />
      ) : null}

      {failed ? <SyncFailedModal job={failed} fallback="Zoho did not answer." onClose={() => setFailed(null)} onImportExcel={onImportExcel} /> : null}
    </>
  );
}
