'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { tallyJobKey, tallyKey, useTallyActions, useTallyJob, useTallyStatus } from '@/hooks/use-tally-sync';
import type { TallyJobDto, TallyJobType } from '@/lib/receivables/tally-live/wire';
import { cn } from '@/lib/utils';
import { TOOL_BTN } from './PublishBar';
import { SyncDialog, SyncFailedModal, useSyncFinish } from './sync-shared';

/**
 * "Sync from Tally" on the Sheet tab (docs/specs/receivables/TALLY-LIVE.md). The main half opens
 * the sync dialog (Invoices or Payments, a period that starts at the financial year); the caret
 * holds Invoices, Payments, Connect Tally and Disconnect. The dot is green while the Tally PC's
 * connector was seen in the last 2 minutes. While a sync runs the button says so and the job is
 * polled every 2 seconds; when it is done the approval panel refreshes and opens. A sync the PC did
 * not answer ends with the reason and "Import Excel instead".
 */

const TALLY_COPY: Record<TallyJobType, string> = {
  sales: 'Sales vouchers of the period come in as rows to approve, the same as an Excel import.',
  receipts: 'Receipts with a bill reference come in as payments to approve; approving marks the invoice received, or part-paid.',
};

/** `menuExtra` adds items under the caret (SourceSync's "Use Zoho Books…"). */
export function TallySync({ sheetId, today, onImportExcel, onReview, menuExtra }: { sheetId: string; today: string; onImportExcel: () => void; onReview: () => void; menuExtra?: ReactNode }) {
  const qc = useQueryClient();
  const [connectOpen, setConnectOpen] = useState(false);
  const status = useTallyStatus(sheetId, connectOpen);
  const actions = useTallyActions(sheetId);
  const [syncType, setSyncType] = useState<TallyJobType | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [failed, setFailed] = useState<TallyJobDto | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const connector = status.data?.connector ?? null;
  // A sync started elsewhere (another tab, another person) is followed too.
  const followId = jobId ?? status.data?.activeJob?.id ?? null;
  const job = useTallyJob(sheetId, followId);
  const live = job.data && (job.data.status === 'queued' || job.data.status === 'running') ? job.data : null;
  const settle = useCallback(() => setJobId(null), []);
  const rearm = useSyncFinish({ sheetId, job: job.data, statusKey: tallyKey(sheetId), sourceWord: 'Tally', onReview, onFailed: setFailed, onSettled: settle });

  const busy = Boolean(live) || actions.sync.isPending;
  const label = live ? (live.status === 'queued' ? 'Waiting for the Tally PC…' : 'Reading Tally…') : 'Sync from Tally';
  const dotTitle = connector ? (connector.online ? `Tally PC online${connector.name ? ` (${connector.name})` : ''}` : 'Tally PC offline') : 'Tally is not connected';

  const openSync = (type: TallyJobType) => (connector ? setSyncType(type) : setConnectOpen(true));

  return (
    <>
      <div className="inline-flex items-stretch">
        <Button size="sm" variant="secondary" className={cn(TOOL_BTN, 'rounded-r-none')} disabled={busy} onClick={() => openSync('sales')} title={dotTitle}>
          {busy ? <RefreshCw aria-hidden className="animate-spin" /> : <span aria-hidden className={cn('size-2 rounded-full', connector?.online ? 'bg-positive' : 'bg-ink-faint')} />}
          {label}
          <span className="sr-only">{`. ${dotTitle}`}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className={cn(TOOL_BTN, '-ml-px rounded-l-none !px-1.5')} aria-label="More Tally sync options">
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={busy} onSelect={() => openSync('sales')}>
              Invoices
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={() => openSync('receipts')}>
              Payments
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConnectOpen(true)}>{connector ? 'Connect again…' : 'Connect Tally…'}</DropdownMenuItem>
            {connector ? <DropdownMenuItem onSelect={() => setConfirmRevoke(true)}>Disconnect</DropdownMenuItem> : null}
            {menuExtra}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {syncType ? (
        <SyncDialog
          title="Sync from Tally"
          copy={TALLY_COPY}
          type={syncType}
          today={today}
          busy={actions.sync.isPending}
          sub={connector ? `${connector.online ? 'Online' : 'Offline'}${connector.tallyCompany ? ` · ${connector.tallyCompany}` : ''}${connector.name ? ` · ${connector.name}` : ''}` : ''}
          onType={setSyncType}
          onClose={() => setSyncType(null)}
          onSync={(input) =>
            actions.sync.mutate(input, {
              onSuccess: (j) => {
                rearm();
                // Seed the job so the button says "Waiting for the Tally PC…" at once, not after the first poll.
                qc.setQueryData(tallyJobKey(sheetId, j.id), j);
                setJobId(j.id);
                setSyncType(null);
              },
              onError: (e) => toastError('Sync not started', e instanceof Error ? e.message : undefined),
            })
          }
        />
      ) : null}

      {connectOpen ? <ConnectDialog sheetId={sheetId} onClose={() => setConnectOpen(false)} /> : null}

      {confirmRevoke ? (
        <Modal
          open
          onOpenChange={(o) => !o && setConfirmRevoke(false)}
          title="Disconnect Tally?"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmRevoke(false)}>
                Cancel
              </Button>
              <Button
                disabled={actions.revoke.isPending}
                onClick={() =>
                  actions.revoke.mutate(undefined, {
                    onSuccess: () => {
                      setConfirmRevoke(false);
                      toastSuccess('Tally disconnected', 'The connector on the Tally PC can no longer reach this sheet.');
                    },
                    onError: (e) => toastError('Not disconnected', e instanceof Error ? e.message : undefined),
                  })
                }
              >
                Disconnect
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-ink-2">The connector on the Tally PC stops working for this sheet at once. Connect again later with a new code.</p>
        </Modal>
      ) : null}

      {failed ? <SyncFailedModal job={failed} fallback="Tally did not answer." onClose={() => setFailed(null)} onImportExcel={onImportExcel} /> : null}
    </>
  );
}

function ConnectDialog({ sheetId, onClose }: { sheetId: string; onClose: () => void }) {
  const actions = useTallyActions(sheetId);
  const status = useTallyStatus(sheetId, true);
  const [code, setCode] = useState<{ code: string; expiresAt: string; at: number } | null>(null);
  const [codeFailed, setCodeFailed] = useState(false);
  const asked = useRef(false);
  const pair = actions.pair;

  // The code is asked for once, when the dialog opens. mutateAsync, not mutate with callbacks:
  // React's development double mount unsubscribes the mutation observer, and the callbacks given
  // to mutate() would then never run, leaving the dialog on "Making a code…".
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    pair.mutateAsync().then(
      (c) => setCode({ ...c, at: Date.now() }),
      (e) => {
        setCodeFailed(true);
        toastError('No code made', e instanceof Error ? e.message : undefined);
      },
    );
  }, [pair]);

  const connector = status.data?.connector;
  const paired = Boolean(code && connector?.pairedAt && Date.parse(connector.pairedAt) >= code.at - 5_000);
  const expires = code ? new Date(code.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Connect Tally"
      size="md"
      footer={<Button onClick={onClose}>{paired ? 'Done' : 'Close'}</Button>}
    >
      {paired ? (
        <p className="text-[13px] text-ink-2">{`Connected${connector?.name ? ` to ${connector.name}` : ''}${connector?.tallyCompany ? `, company ${connector.tallyCompany}` : ''}. Use Sync from Tally to fetch invoices or payments.`}</p>
      ) : (
        <div className="grid gap-4">
          <ol className="grid list-decimal gap-2 pl-5 text-[13px] text-ink-2">
            <li>On the PC that runs TallyPrime, open F1 Help, Settings, Connectivity, and set “TallyPrime acts as” to Server, port 9000.</li>
            <li>Install and start the VCFO Tally Connector on that PC.</li>
            <li>Type the code below into the connector. It works once, for 10 minutes.</li>
          </ol>
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken px-4 py-3">
            {code ? (
              <>
                <span className="font-mono text-[22px] font-semibold tracking-[.18em] text-ink">{`${code.code.slice(0, 4)} ${code.code.slice(4)}`}</span>
                <CopyButton value={code.code} label="Copy code" />
                <span className="ml-auto text-[12px] text-ink-muted">{`Valid until ${expires}`}</span>
              </>
            ) : (
              <span className="text-[13px] text-ink-muted">{codeFailed ? 'The code could not be made. Close and try again.' : 'Making a code…'}</span>
            )}
          </div>
          <p className="text-[12.5px] text-ink-muted">
            {connector ? 'The Tally PC connected now keeps working until the new code is used.' : 'This window notices when the connector is paired.'} The code is shown only here; it is not kept.
          </p>
        </div>
      )}
    </Modal>
  );
}
