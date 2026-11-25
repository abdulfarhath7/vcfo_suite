'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { FilterSelect } from '@/components/ui/native-select';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { ZOHO_APP_LABEL, type ZohoLinkDto, type ZohoOrgDto, type ZohoStatusDto } from '@/lib/integrations/zoho/wire';
import type { LinkStatus, ZohoApp } from '@/db/schema-integrations';
import { useZohoActions, useZohoStatus, useZohoTargets, type ZohoTargetOption } from './use-zoho';

/**
 * Firm settings > Integrations > Zoho (docs/specs/integrations/ZOHO.md): one [Connect Zoho] button,
 * discovery progress, each app's status, the Match clients screen and the field check. Admins only
 * (the card sits inside IntegrationsSection, which only editors see).
 */

const APPS: ZohoApp[] = ['books', 'invoice', 'crm', 'payroll', 'people'];

const COUNT_LABEL: Record<string, string> = { customers: 'customers', accounts: 'accounts', employees: 'employees', payRuns: 'pay runs' };

function countText(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${v} ${COUNT_LABEL[k] ?? k}`)
    .join(' · ');
}

function stepText(step: string | null): string {
  if (!step || step === 'starting') return 'Starting…';
  if (step === 'matching') return 'Matching clients…';
  if (step === 'done') return 'Done';
  return `Reading ${ZOHO_APP_LABEL[step as ZohoApp] ?? step}…`;
}

export function ZohoIntegrationRow() {
  const status = useZohoStatus();
  const { rediscover, disconnect } = useZohoActions();
  const [askDisconnect, setAskDisconnect] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  // The callback comes back with ?zoho=connected or ?zoho=error&reason=…
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const z = q.get('zoho');
    if (!z) return;
    if (z === 'connected') toastSuccess('Zoho connected', 'Finding your organisations now.');
    else toastError('Zoho did not connect', q.get('reason') ?? undefined);
    q.delete('zoho');
    q.delete('reason');
    const rest = q.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }, []);

  const data = status.data;
  const conn = data?.connection ?? null;
  const job = data?.job ?? null;
  const running = job?.status === 'queued' || job?.status === 'running';
  const summary = useMemo(() => linkSummary(data?.links ?? []), [data?.links]);
  // Before the integrations tables exist (or when the read fails) the row stays out of the way.
  if (status.isError) return null;

  let chip: { word: string; tone: ChipTone };
  if (!data) chip = { word: '…', tone: 'idle' };
  else if (!conn) chip = { word: data.configured ? 'Not connected' : 'Not set up', tone: 'idle' };
  else if (conn.status === 'error') chip = { word: 'Needs sign-in', tone: 'warn' };
  else if (running) chip = { word: 'Discovering', tone: 'prog' };
  else chip = { word: 'Connected', tone: 'ok' };

  const sub = !conn
    ? 'Books, Invoice, CRM, Payroll, People · read only'
    : conn.status === 'error'
      ? (conn.lastError ?? 'Zoho refused the saved sign-in')
      : `Zoho ${conn.location.toUpperCase()} · connected ${new Date(conn.connectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  async function onDisconnect() {
    try {
      const r = await disconnect.mutateAsync();
      toastSuccess('Zoho disconnected', r.revokedAtZoho ? 'The sign-in was revoked at Zoho.' : 'Zoho could not be reached; remove the app under Connected Apps in Zoho.');
      setAskDisconnect(false);
    } catch (err) {
      toastError('Could not disconnect', errorMessage(err));
    }
  }

  async function onRediscover() {
    try {
      await rediscover.mutateAsync();
    } catch (err) {
      toastError('Could not start discovery', errorMessage(err));
    }
  }

  return (
    <li className="border-t border-line-soft first:border-t-0">
      <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 md:px-5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink">Zoho</span>
          <span className="block truncate text-[12.5px] text-ink-muted">{sub}</span>
        </span>
        <Chip raw fixed tone={chip.tone} className="hidden sm:inline-flex">
          {chip.word}
        </Chip>
        {!conn || conn.status === 'error' ? (
          data?.configured ? (
            <Button size="sm" variant="outline" asChild>
              <a href="/api/integrations/zoho/connect">{conn ? 'Reconnect' : 'Connect Zoho'}</a>
            </Button>
          ) : null
        ) : null}
      </div>

      {askDisconnect ? (
        <InlineConfirm
          question="Disconnect Zoho? The sign-in is revoked at Zoho and the matches are kept for a reconnect."
          confirm="Disconnect"
          busy={disconnect.isPending}
          onConfirm={() => void onDisconnect()}
          onCancel={() => setAskDisconnect(false)}
        />
      ) : null}

      {conn && conn.status !== 'revoked' ? (
        <div className="border-t border-line-soft bg-surface-sunken px-4 py-3 md:px-5">
          {running ? <p className="mb-2 text-[12.5px] text-ink-muted">{stepText(job?.step ?? null)}</p> : null}
          {job?.status === 'failed' ? <p className="mb-2 text-[12.5px] text-danger">Discovery stopped: {job.error}</p> : null}
          <AppTable data={data!} />
          {data!.links.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
              <span className="text-ink">
                <b className="font-semibold">{summary.mapped}</b> matched · <b className="font-semibold">{summary.suggested}</b> suggested · <b className="font-semibold">{summary.unmapped}</b> not mapped
                {summary.ignored ? ` · ${summary.ignored} ignored` : ''}
              </span>
              <Button size="sm" variant="outline" onClick={() => setMatchOpen(true)}>
                Match clients
              </Button>
            </div>
          ) : null}
          <FieldCheckTable orgs={data!.orgs} />
          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line-soft pt-2">
            <Button size="sm" variant="ghost" onClick={() => void onRediscover()} disabled={running || rediscover.isPending}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Check again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAskDisconnect(true)}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : null}

      <MatchClientsDialog open={matchOpen} onOpenChange={setMatchOpen} links={data?.links ?? []} />
    </li>
  );
}

function linkSummary(links: ZohoLinkDto[]) {
  const s = { mapped: 0, suggested: 0, unmapped: 0, ignored: 0 };
  for (const l of links) s[l.status] += 1;
  return s;
}

/** One line per app: used with counts, not used, or the error it gave. */
function AppTable({ data }: { data: ZohoStatusDto }) {
  const summaries = data.job?.apps ?? [];
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[12px] text-ink-muted">
          <th className="py-1 pr-3 font-medium">App</th>
          <th className="py-1 pr-3 font-medium">Status</th>
          <th className="py-1 font-medium">Found</th>
        </tr>
      </thead>
      <tbody>
        {APPS.map((app) => {
          const s = summaries.find((x) => x.app === app);
          const granted = data.connection?.apps.length ? data.connection.apps.includes(app) : true;
          const word = !granted ? 'Not asked' : !s ? (data.job && data.job.status !== 'done' && data.job.status !== 'failed' ? 'Waiting' : '—') : s.error ? 'Error' : s.used ? 'In use' : 'Not used';
          const tone: ChipTone = word === 'In use' ? 'ok' : word === 'Error' ? 'bad' : word === 'Waiting' ? 'prog' : 'idle';
          return (
            <tr key={app} className="border-t border-line-soft">
              <td className="py-1.5 pr-3 text-ink">{ZOHO_APP_LABEL[app]}</td>
              <td className="py-1.5 pr-3">
                <Chip raw tone={tone}>
                  {word}
                </Chip>
              </td>
              <td className="py-1.5 text-ink-muted">{s?.error ? s.error : s?.used ? `${s.orgs} org${s.orgs === 1 ? '' : 's'}${Object.keys(s.counts).length ? ` · ${countText(s.counts)}` : ''}` : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The field check: which needed fields each organisation's sample record carries. */
function FieldCheckTable({ orgs }: { orgs: ZohoOrgDto[] }) {
  const withCheck = orgs.filter((o) => o.fieldCheck?.items.length);
  if (!withCheck.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-1 text-[12px] font-medium text-ink-muted">Field check</p>
      <table className="w-full text-[13px]">
        <tbody>
          {withCheck.map((o) => (
            <tr key={o.id} className="border-t border-line-soft align-top">
              <td className="py-1.5 pr-3 text-ink">
                {o.name}
                <span className="block text-[12px] text-ink-muted">{ZOHO_APP_LABEL[o.app]}</span>
              </td>
              <td className="py-1.5">
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  {o.fieldCheck!.items.map((i) => (
                    <span key={i.key} title={i.note} className={i.present === true ? 'text-positive' : i.present === false ? 'text-ink-muted' : 'text-warning'}>
                      {i.present === true ? '✓' : i.present === false ? 'No' : '?'} {i.label}
                      {i.note && i.present !== true ? <span className="text-ink-muted"> ({i.note})</span> : null}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_OPTIONS: Array<{ value: LinkStatus; label: string }> = [
  { value: 'suggested', label: 'Suggested' },
  { value: 'unmapped', label: 'Not mapped' },
  { value: 'mapped', label: 'Matched' },
  { value: 'ignored', label: 'Ignored' },
];

const TYPE_LABEL: Record<ZohoLinkDto['externalType'], string> = { org: 'Organisation', customer: 'Customer', crm_account: 'CRM account' };

const MATCH_LABEL: Record<string, string> = { auto_gstin: 'GSTIN', auto_pan: 'PAN', auto_name: 'Name', suggested: 'Close name', manual: 'By hand' };

/** Which VCFO records a Zoho item may point at. */
function allowedTargets(link: ZohoLinkDto, targets: ZohoTargetOption[]): ZohoTargetOption[] {
  if (link.externalType === 'customer') return targets;
  return targets.filter((t) => t.vcfoType === 'engagement');
}

function MatchClientsDialog({ open, onOpenChange, links }: { open: boolean; onOpenChange: (v: boolean) => void; links: ZohoLinkDto[] }) {
  const { decide } = useZohoActions();
  const targets = useZohoTargets(open);
  const counts = linkSummary(links);
  const [show, setShow] = useState<LinkStatus>('suggested');
  // Each time the screen opens it starts on the first list that needs a decision.
  useEffect(() => {
    if (open) setShow(counts.suggested ? 'suggested' : counts.unmapped ? 'unmapped' : 'mapped');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);
  const rows = links.filter((l) => l.status === show);

  async function run(body: Parameters<typeof decide.mutateAsync>[0], done?: string) {
    try {
      await decide.mutateAsync(body);
      if (done) toastSuccess(done);
    } catch (err) {
      toastError('Could not save', errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Match clients</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            aria-label="Show"
            value={show}
            onChange={(e) => setShow(e.target.value as LinkStatus)}
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} (${counts[o.value]})` }))}
          />
          <span className="flex-1" />
          {counts.suggested ? (
            <Button size="sm" onClick={() => void run({ action: 'accept_all' }, 'Suggestions accepted')} disabled={decide.isPending}>
              Accept all {counts.suggested}
            </Button>
          ) : null}
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-[12px] text-ink-muted">
                <th className="py-1.5 pr-3 font-medium">In Zoho</th>
                <th className="py-1.5 pr-3 font-medium">In VCFO</th>
                <th className="py-1.5 pr-3 font-medium">How</th>
                <th className="py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-ink-muted">
                    Nothing here.
                  </td>
                </tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.id} className="border-t border-line-soft align-middle">
                    <td className="py-1.5 pr-3">
                      <span className="block text-ink">{l.externalName}</span>
                      <span className="block text-[12px] text-ink-muted">
                        {ZOHO_APP_LABEL[l.app]} {TYPE_LABEL[l.externalType].toLowerCase()}
                        {l.externalGstin ? <span className="font-mono"> · {l.externalGstin}</span> : null}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      {l.status === 'unmapped' || l.status === 'ignored' ? (
                        <TargetPicker link={l} options={allowedTargets(l, targets.data ?? [])} disabled={decide.isPending} onPick={(t) => void run({ linkId: l.id, action: 'set', ...t })} />
                      ) : (
                        <span className="text-ink">{l.vcfoType === 'firm' ? `${l.vcfoName ?? 'Firm'} (firm)` : l.vcfoName}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-ink-muted">{l.match ? MATCH_LABEL[l.match] : ''}</td>
                    <td className="whitespace-nowrap py-1.5 text-right">
                      {l.status === 'suggested' ? (
                        <Button size="sm" variant="outline" onClick={() => void run({ linkId: l.id, action: 'accept' })} disabled={decide.isPending}>
                          Accept
                        </Button>
                      ) : null}
                      {l.status !== 'ignored' ? (
                        <Button size="sm" variant="ghost" onClick={() => void run({ linkId: l.id, action: 'ignore' })} disabled={decide.isPending}>
                          Ignore
                        </Button>
                      ) : null}
                      {l.status === 'mapped' ? (
                        <Button size="sm" variant="ghost" onClick={() => void run({ linkId: l.id, action: 'clear' })} disabled={decide.isPending}>
                          Clear
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TargetPicker({
  link,
  options,
  disabled,
  onPick,
}: {
  link: ZohoLinkDto;
  options: ZohoTargetOption[];
  disabled?: boolean;
  onPick: (t: { vcfoType: 'engagement' | 'receivable_client' | 'firm'; vcfoId: string | null }) => void;
}) {
  const firmAllowed = link.externalType === 'org' && (link.app === 'books' || link.app === 'invoice');
  const opts = [
    { value: '', label: 'Pick a client…' },
    ...(firmAllowed ? [{ value: 'firm:', label: 'The firm (its own receivables)' }] : []),
    ...options.map((o) => ({ value: `${o.vcfoType}:${o.vcfoId}`, label: o.detail ? `${o.name} · ${o.detail}` : o.name })),
  ];
  return (
    <FilterSelect
      aria-label={`VCFO record for ${link.externalName}`}
      value=""
      disabled={disabled}
      className="max-w-[280px]"
      options={opts}
      onChange={(e) => {
        const [type, id] = e.target.value.split(':');
        if (!type) return;
        onPick({ vcfoType: type as 'engagement' | 'receivable_client' | 'firm', vcfoId: id || null });
      }}
    />
  );
}
