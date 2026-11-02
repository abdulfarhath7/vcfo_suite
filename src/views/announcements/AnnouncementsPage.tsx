'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { DashSection } from '@/components/dash/DashSection';
import { useApp } from '@/context/AppContext';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import {
  ANNOUNCEMENT_READ_EVENT,
  announcementMatchesFilter,
  canManageAnnouncementSources,
  canWriteAnnouncements,
  readAnnouncementIds,
  writeAnnouncementReadIds,
  parseAnnouncementKind,
  type Announcement,
  type AnnouncementListFilter,
  requestAnnouncementPopup,
  roleAnnouncementsPath,
} from '@/lib/notifications/announcements';
import { useAnnouncements } from '@/hooks/use-announcements';
import { AnnouncementComposeForm } from '@/components/announcements/AnnouncementCompose';
import { AnnouncementRow } from '@/components/announcements/AnnouncementList';
import { OfficialPortalsDirectory } from '@/components/announcements/OfficialPortalsDirectory';
import { WatchedSourcesPanel } from '@/components/announcements/WatchedSourcesPanel';

function ComposeQueryOpener({ canWrite, onOpen }: { canWrite: boolean; onOpen: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (canWrite && searchParams.get('compose') === '1') onOpen();
  }, [canWrite, onOpen, searchParams]);
  return null;
}

const FILTERS: Array<{ key: AnnouncementListFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'important', label: 'Important' },
  { key: 'general', label: 'General' },
];

function LatestList({
  loading,
  items,
  canWrite,
  readIds,
  onCompose,
  onRemove,
  onView,
}: {
  loading: boolean;
  items: Announcement[];
  canWrite: boolean;
  readIds: Set<string>;
  onCompose: () => void;
  onRemove: (id: string) => void;
  onView: (item: Announcement) => void;
}) {
  const [filter, setFilter] = useState<AnnouncementListFilter>('all');
  /* Owner, 30 Oct 2026: a row opens the live popup that flies back to the bell (as before the
     port); the popup's Open page button leads to this page. */
  const open = (item: Announcement) => {
    onView(item);
  };
  const shown = items.filter((item) => announcementMatchesFilter(parseAnnouncementKind(item.kind), filter));
  const count = (key: AnnouncementListFilter) =>
    items.filter((item) => announcementMatchesFilter(parseAnnouncementKind(item.kind), key)).length;

  return (
    <DashSection
      title="Latest"
      bodyClassName="p-0"
      meta={
        <SpectrumTabs
          label="Filter announcements"
          items={FILTERS.map((f) => ({ ...f, count: loading ? undefined : count(f.key) }))}
          value={filter}
          onChange={(key) => setFilter(key as AnnouncementListFilter)}
        />
      }
    >
      {loading ? (
        // L1 loading shapes (R-48): the date tile, two lines and the 104px mark of a real row.
        <ul aria-busy="true" aria-label="Loading announcements">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex min-h-[72px] items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0" aria-hidden>
              <span className="h-11 w-11 flex-none animate-pulse rounded-md bg-surface-sunken" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex items-center gap-2">
                  <span className="h-5 w-[104px] animate-pulse rounded-md bg-surface-sunken" />
                  <span className="h-3 w-24 animate-pulse rounded bg-surface-sunken" />
                </span>
                <span className="h-3.5 w-3/4 animate-pulse rounded bg-surface-sunken" />
              </span>
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title={items.length === 0 ? 'Nothing on the board yet' : 'None'}
            action={
              items.length > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setFilter('all')}>
                  See all
                </Button>
              ) : canWrite ? (
                <Button type="button" variant="outline" size="sm" onClick={onCompose}>
                  New announcement
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul>
          {shown.map((item) => {
            const unread = !readIds.has(item.id);
            return (
              <li key={item.id} className="flex items-stretch border-t border-line-soft first:border-t-0">
                <div className="min-w-0 flex-1">
                  <AnnouncementRow item={item} unread={unread} onActivate={() => open(item)} />
                </div>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label="Remove announcement"
                    title="Remove"
                    className="mr-3 grid h-[30px] w-[30px] shrink-0 place-items-center self-center rounded-md text-ink-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-[15px] w-[15px]" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </DashSection>
  );
}

export default function AnnouncementsPage() {
  const { user } = useApp();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const canWrite = canWriteAnnouncements(user?.role);
  const canSources = canManageAnnouncementSources(user?.role);
  const list = useAnnouncements();

  const [composing, setComposing] = useState(false);
  const [readTick, setReadTick] = useState(0);

  const openCompose = useCallback(() => setComposing(true), []);

  useEffect(() => {
    const sync = () => setReadTick((n) => n + 1);
    window.addEventListener(ANNOUNCEMENT_READ_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ANNOUNCEMENT_READ_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const items = list.data?.announcements ?? [];
  const readIds = useMemo(
    () => (user?.id ? readAnnouncementIds(user.id) : new Set<string>()),
    [user?.id, items, readTick],
  );

  const markOne = (id: string) => {
    if (!user?.id) return;
    const next = new Set(readIds);
    next.add(id);
    writeAnnouncementReadIds(user.id, next);
    setReadTick((n) => n + 1);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['announcements'] });
    await queryClient.invalidateQueries({ queryKey: ['announcements-head'] });
    await queryClient.invalidateQueries({ queryKey: ['announcement-sources'] });
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'delete_failed');
      toastSuccess('Announcement removed');
      await refresh();
    } catch (err) {
      toastError('Could not remove', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const showComposer = canWrite && composing;

  return (
    <PageTransition>
      <Suspense fallback={null}>
        <ComposeQueryOpener canWrite={canWrite} onOpen={openCompose} />
      </Suspense>
      <SEO
        title="Announcements — VCFO Suite"
        description="Firm-wide news posted by managers and admins, plus official tax feeds."
        path={pathname}
      />
      {/* The top bar names the page; the page keeps a hidden heading and a plain toolbar. */}
      <h1 className="sr-only">Announcements</h1>
      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant={composing ? 'outline' : 'default'}
            onClick={() => setComposing((open) => !open)}
            aria-expanded={composing}
          >
            {composing ? <X aria-hidden /> : <Plus aria-hidden />}
            {composing ? 'Close' : 'New announcement'}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          {showComposer ? (
            <DashSection title="New announcement">
              <AnnouncementComposeForm bare idPrefix="page-ann" onClose={() => setComposing(false)} />
            </DashSection>
          ) : null}
          <LatestList
            loading={list.isLoading}
            items={items}
            canWrite={canWrite}
            readIds={readIds}
            onCompose={openCompose}
            onRemove={(id) => void remove(id)}
            onView={(item) => {
              markOne(item.id);
              requestAnnouncementPopup(item);
            }}
          />
        </div>
        <div className="grid min-w-0 gap-4">
          <OfficialPortalsDirectory />
          {/* One review road: the watched sources feed the regulatory-updates review queue. */}
          {canSources && user ? (
            <WatchedSourcesPanel
              reviewPath={roleAnnouncementsPath(user.role).replace('/announcements', '/regulatory-updates')}
            />
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
