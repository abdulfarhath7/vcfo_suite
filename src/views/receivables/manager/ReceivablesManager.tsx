'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/native-select';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Chip } from '@/components/ui/spectrum-chip';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { todayIst } from '@/lib/receivables/dates';
import type { SheetListItem } from '@/lib/receivables/wire';
import { useManagerSheet, useOutlookStatus, useReceivablesActions } from '@/hooks/use-receivables';
import { OUTLOOK_CONNECT_HREF } from './ComposeSummary';
import { FxTab } from './FxTab';
import { LinksTab } from './LinksTab';
import { PeopleTab } from './PeopleTab';
import { ReportsTab } from './ReportsTab';
import { SheetTab } from './SheetTab';
import { paramsWithFilters } from './sheet/sheet-filters';
import { VersionsTab } from './VersionsTab';

/**
 * /receivables/manager (docs/specs/receivables/PLAN.md and V2.md): the staff workspace, outside
 * the staff shell. A light header with the Outlook link, and the tabs Sheet, People, Versions,
 * Reports and FX. Receivables v2 removed the From bank and Reminders tabs, replaced Partners with
 * People, and shows Links only when the server sets RECEIVABLES_EXTERNAL=on (`external`).
 */

const ALL_TABS = [
  { key: 'sheet', label: 'Sheet' },
  { key: 'people', label: 'People' },
  { key: 'versions', label: 'Versions' },
  { key: 'links', label: 'Links' },
  { key: 'reports', label: 'Reports' },
  { key: 'fx', label: 'FX' },
] as const;
type Tab = (typeof ALL_TABS)[number]['key'];

export function ReceivablesManager({
  sheets,
  sheetId,
  userName,
  homeHref,
  settingsHref,
  external,
}: {
  sheets: SheetListItem[];
  sheetId: string;
  userName: string;
  homeHref: string;
  /** The person's own Account settings, where their WhatsApp number is set. */
  settingsHref: string;
  /** RECEIVABLES_EXTERNAL=on: the partner-facing features (Links, Share this view) show. */
  external: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const TABS = ALL_TABS.filter((t) => external || t.key !== 'links');
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'sheet') as Tab;
  const { data, isLoading, error } = useManagerSheet(sheetId);
  const actions = useReceivablesActions(sheetId);
  const outlook = useOutlookStatus();
  const today = todayIst();

  // Back from the Outlook connect flow (?outlook=connected or ?outlook=error&reason=…).
  useEffect(() => {
    const result = params.get('outlook');
    if (!result) return;
    if (result === 'connected') toastSuccess('Outlook connected', 'Emails now send from your mailbox.');
    else toastError('Outlook did not connect', params.get('reason') || 'Try Connect Outlook again.');
    const q = new URLSearchParams(params.toString());
    q.delete('outlook');
    q.delete('reason');
    router.replace(`/receivables/manager${q.toString() ? `?${q}` : ''}`, { scroll: false });
  }, [params, router]);

  const go = (next: { tab?: string; sheet?: string }) => {
    // Another sheet has other partners and clients, so the Sheet tab's filters are dropped then.
    const q = new URLSearchParams(next.sheet ? paramsWithFilters(params.toString(), {}) : params.toString());
    if (next.tab) q.set('tab', next.tab);
    if (next.sheet) q.set('sheet', next.sheet);
    router.replace(`/receivables/manager?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="mx-auto max-w-[1320px] px-4 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href={homeHref} className="text-[13px] font-bold tracking-[.06em] text-ink">
              VCFO SUITE
            </Link>
            <span className="text-[13px] text-ink-muted">/ Receivables</span>
            {sheets.length > 1 ? (
              <FilterSelect aria-label="Sheet" value={sheetId} onChange={(e) => go({ sheet: e.target.value })} options={sheets.map((s) => ({ value: s.id, label: s.clientOrgName }))} />
            ) : (
              <span className="text-[13px] font-medium text-ink-2">· {data?.sheet.clientOrgName ?? sheets[0]?.clientOrgName}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {outlook.data?.connected ? (
              <Chip raw tone="ok" title="Receivables emails you approve or send go from this mailbox">
                {`Outlook: ${outlook.data.msEmail}`}
              </Chip>
            ) : outlook.data?.configured ? (
              <Button size="sm" variant="strong" asChild>
                <a href={OUTLOOK_CONNECT_HREF}>Connect Outlook</a>
              </Button>
            ) : null}
            <span className="font-medium text-ink-2">{userName}</span>
            <Button size="sm" variant="quiet" asChild>
              <Link href={homeHref}>Back to VCFO Suite</Link>
            </Button>
            <Button size="sm" variant="quiet" onClick={() => void signOut({ callbackUrl: '/login' })}>
              Log out
            </Button>
          </div>
        </header>

        <SpectrumTabs variant="underline" label="Receivables" className="mb-4" items={TABS.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={(k) => go({ tab: k })} />

        {isLoading ? <p className="py-10 text-center text-ink-muted">Loading the sheet…</p> : null}
        {error ? <p className="py-10 text-center text-danger">{error.message}</p> : null}
        {data ? (
          tab === 'sheet' ? (
            <SheetTab data={data} actions={actions} today={today} external={external} />
          ) : tab === 'people' ? (
            <PeopleTab data={data} actions={actions} outlook={outlook.data} settingsHref={settingsHref} />
          ) : tab === 'reports' ? (
            <ReportsTab sheetId={sheetId} />
          ) : tab === 'fx' ? (
            <FxTab sheetId={sheetId} />
          ) : tab === 'links' ? (
            <LinksTab data={data} />
          ) : (
            <VersionsTab sheetId={sheetId} />
          )
        ) : null}
      </div>
    </div>
  );
}
