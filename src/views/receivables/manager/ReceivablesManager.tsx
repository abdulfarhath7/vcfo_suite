'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/native-select';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePeople } from '@/hooks/use-receivables-v2';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { todayIst } from '@/lib/receivables/dates';
import type { SheetListItem } from '@/lib/receivables/wire';
import { useManagerSheet, useOutlookStatus, useReceivablesActions } from '@/hooks/use-receivables';
import { OUTLOOK_CONNECT_HREF } from './ComposeSummary';
import { FxTab } from './FxTab';
import { LinksTab } from './LinksTab';
import { CollectionsTab } from './CollectionsTab';
import { PeopleTab } from './PeopleTab';
import { ReportsTab } from './ReportsTab';
import { SheetTab } from './SheetTab';
import { TemplatesTab } from './TemplatesTab';
import { EmailLogTab } from './EmailLogTab';
import { paramsWithFilters } from './sheet/sheet-filters';
import { VersionsTab } from './VersionsTab';

/**
 * /receivables/manager (docs/specs/receivables/PLAN.md and V2.md): the staff workspace, outside
 * the staff shell. A light header with the Outlook link, and the tabs Sheet, People, Collections
 * (received on time against late), Templates (every email's words, owner 19 Nov 2026), Email log
 * (every email sent, automatic and manual, owner 19 Nov 2026), Versions, Reports and FX. Receivables v2 removed the From bank and Reminders tabs, replaced Partners with
 * People, and shows Links only when the server sets RECEIVABLES_EXTERNAL=on (`external`).
 */

const ALL_TABS = [
  { key: 'sheet', label: 'Sheet' },
  { key: 'people', label: 'People' },
  { key: 'collections', label: 'Collections' },
  { key: 'templates', label: 'Templates' },
  { key: 'emails', label: 'Email log' },
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
  // The WhatsApp (DoubleTick) dot: set up on the server, and this person's own number saved.
  const people = usePeople(sheetId);
  const w = people.data?.whatsapp;
  const wa = w
    ? {
        ok: w.configured && Boolean(w.myPhone),
        title: !w.configured ? 'WhatsApp is not set up on the server yet' : w.myPhone ? `WhatsApp messages about your emails go to ${w.myPhone}` : 'Add your WhatsApp number in Account settings',
      }
    : null;
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
      <div className="mx-auto max-w-[1440px] px-3 pb-10">
        {/* One slim bar (compact layout, 17 Nov 2026): the sheet, the tabs, Outlook and WhatsApp, the person. */}
        <header className="sticky top-0 z-20 -mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface/95 px-3 py-1 backdrop-blur">
          <Link href={homeHref} className="text-[12px] font-bold tracking-[.06em] text-ink">
            VCFO
          </Link>
          <span className="text-[12px] text-ink-muted">Receivables</span>
          {sheets.length > 1 ? (
            <FilterSelect aria-label="Sheet" value={sheetId} onChange={(e) => go({ sheet: e.target.value })} options={sheets.map((s) => ({ value: s.id, label: s.clientOrgName }))} />
          ) : (
            <span className="text-[12.5px] font-semibold text-ink">{data?.sheet.clientOrgName ?? sheets[0]?.clientOrgName}</span>
          )}
          <SpectrumTabs variant="underline" label="Receivables" className="min-w-0 flex-1 [&_[role=tab]]:h-9" items={TABS.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={(k) => go({ tab: k })} />
          <span className="flex items-center gap-3 text-[12px]">
            {outlook.data?.connected ? (
              <span className="inline-flex items-center gap-1.5" title={`Receivables emails you approve or send go from ${outlook.data.msEmail}`}>
                <span aria-hidden className="size-2 rounded-full bg-positive" />
                Outlook
              </span>
            ) : outlook.data?.configured ? (
              <a href={OUTLOOK_CONNECT_HREF} className="inline-flex items-center gap-1.5 font-medium text-brand-text hover:underline">
                <span aria-hidden className="size-2 rounded-full bg-danger" />
                Connect Outlook
              </a>
            ) : null}
            {wa ? (
              <span className="inline-flex items-center gap-1.5" title={wa.title}>
                <span aria-hidden className={`size-2 rounded-full ${wa.ok ? 'bg-positive' : 'bg-warning'}`} />
                WhatsApp
              </span>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="quiet" className="h-7 px-2 text-[12px]">
                  {userName}
                  <ChevronDown aria-hidden className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={homeHref}>Back to VCFO Suite</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={settingsHref}>Account settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: '/login' })}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </header>

        {isLoading ? <p className="py-10 text-center text-ink-muted">Loading the sheet…</p> : null}
        {error ? <p className="py-10 text-center text-danger">{error.message}</p> : null}
        {data ? (
          tab === 'sheet' ? (
            <SheetTab data={data} actions={actions} today={today} external={external} />
          ) : tab === 'collections' ? (
            <CollectionsTab data={data} today={today} actions={actions} />
          ) : tab === 'people' ? (
            <PeopleTab data={data} actions={actions} outlook={outlook.data} settingsHref={settingsHref} />
          ) : tab === 'reports' ? (
            <ReportsTab sheetId={sheetId} />
          ) : tab === 'fx' ? (
            <FxTab sheetId={sheetId} />
          ) : tab === 'templates' ? (
            <TemplatesTab sheetId={sheetId} sheetName={data.sheet.clientOrgName} today={today} />
          ) : tab === 'emails' ? (
            <EmailLogTab sheetId={sheetId} />
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
