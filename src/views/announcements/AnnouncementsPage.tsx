'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Trash2, X } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { AccentButton, EmptyStateIllustrated, Surface } from '@/components/noir';
import { useApp } from '@/context/AppContext';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import {
  ANNOUNCEMENT_READ_EVENT,
  canManageAnnouncementSources,
  roleAnnouncementsPath,
  canWriteAnnouncements,
  readAnnouncementIds,
  requestAnnouncementPopup,
  writeAnnouncementReadIds,
  type Announcement,
} from '@/lib/announcements';
import { useAnnouncements } from '@/lib/use-announcements';
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
  return (
    <Surface flat className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">Latest</h2>
        </div>
        {!loading && items.length > 0 ? (
          <span className="tabular-nums text-[12px] text-muted-foreground">{items.length}</span>
        ) : null}
      </div>
      {loading ? (
        <div className="divide-y divide-border/80" aria-busy="true" aria-label="Loading announcements">
          {['a', 'b', 'c', 'd'].map((key) => (
            <div key={key} className="px-4 py-4 sm:px-5">
              <div className="h-3.5 w-16 animate-pulse rounded-full bg-raised" />
              <div className="mt-2.5 h-4 w-[88%] animate-pulse rounded-md bg-raised" />
              <div className="mt-2 h-3 w-40 animate-pulse rounded-md bg-raised" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyStateIllustrated
          icon={Megaphone}
          title="Nothing on the board yet"
          actionLabel={canWrite ? 'New announcement' : undefined}
          onAction={canWrite ? onCompose : undefined}
          className="rounded-none border-0 bg-transparent shadow-none"
        />
      ) : (
        <div className="divide-y divide-border/80">
          {items.map((item) => {
            const unread = !readIds.has(item.id);
            return (
              <article key={item.id} className="flex items-stretch hover:bg-raised/40">
                <div className="min-w-0 flex-1">
                  <AnnouncementRow
                    item={item}
                    unread={unread}
                    onActivate={() => onView(item)}
                  />
                </div>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label="Remove announcement"
                    className="inline-flex h-8 shrink-0 items-center gap-1 self-center rounded-md px-2 text-[12px] text-muted-foreground hover:bg-danger-light hover:text-danger-text"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">Remove</span>
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </Surface>
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
      <PageHeader
        title="Announcements"
        actions={
          canWrite ? (
            <AccentButton
              type="button"
              variant={composing ? 'outline' : 'solid'}
              onClick={() => setComposing((open) => !open)}
              aria-expanded={composing}
              className="rounded-xl"
            >
              {composing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {composing ? 'Close' : 'New announcement'}
            </AccentButton>
          ) : undefined
        }
        footer={
          showComposer ? (
            <AnnouncementComposeForm
              bare
              idPrefix="page-ann"
              onClose={() => setComposing(false)}
            />
          ) : null
        }
      />

      <div className="flex min-w-0 flex-col gap-5">
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
        <OfficialPortalsDirectory />
        {canSources && user ? (
          <WatchedSourcesPanel reviewPath={roleAnnouncementsPath(user.role).replace('/announcements', '/regulatory-updates')} />
        ) : null}
      </div>
    </PageTransition>
  );
}
