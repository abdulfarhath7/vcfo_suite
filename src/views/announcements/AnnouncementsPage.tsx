'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, RefreshCw, Rss, Trash2, X } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { AccentButton, EmptyStateIllustrated, Surface } from '@/components/noir';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/context/AppContext';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import {
  OFFICIAL_FEED_HOSTS,
  canManageAnnouncementSources,
  canWriteAnnouncements,
  type Announcement,
  type AnnouncementKind,
  type AnnouncementSource,
} from '@/lib/announcements';
import { useAnnouncementSources, useAnnouncements } from '@/lib/use-announcements';
import { AnnouncementBody, AnnouncementKindPicker } from '@/components/announcements/AnnouncementList';
import { OfficialPortalsDirectory } from '@/components/announcements/OfficialPortalsDirectory';
import { cn } from '@/lib/utils';

function feedErrorMessage(code: string): string {
  if (code === 'feed_host_not_allowed') {
    return 'That site is not on the official allow-list. Use an HTTPS RSS/Atom URL from an allowlisted host (MCA, GST, RBI, Income Tax, and others listed on this page).';
  }
  if (code === 'feed_must_be_https' || code === 'invalid_feed_url') {
    return 'Use a full https:// RSS or Atom URL — not the homepage.';
  }
  if (code === 'feed_already_added') return 'That feed is already on the board.';
  if (code === 'feed_not_xml' || code.startsWith('feed_http_')) {
    return 'That URL did not return a feed. Paste the RSS/Atom link, not the news homepage.';
  }
  return code.replaceAll('_', ' ');
}

function ComposePanel({
  kind,
  setKind,
  message,
  setMessage,
  link,
  setLink,
  posting,
  onPost,
  onClose,
}: {
  kind: AnnouncementKind;
  setKind: (kind: AnnouncementKind) => void;
  message: string;
  setMessage: (value: string) => void;
  link: string;
  setLink: (value: string) => void;
  posting: boolean;
  onPost: () => void;
  onClose: () => void;
}) {
  return (
    <Surface flat className="p-4 xl:sticky xl:top-20">
      <form
        aria-labelledby="compose-heading"
        onSubmit={(e) => {
          e.preventDefault();
          onPost();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="compose-heading" className="text-[13px] font-semibold tracking-tight text-ink">
              New announcement
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Posted under your name.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-raised hover:text-ink"
            aria-label="Close composer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid gap-3">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Type</p>
            <AnnouncementKindPicker value={kind} onChange={setKind} />
          </div>
          <div>
            <Label htmlFor="ann-message" className="text-[11px] text-muted-foreground">
              Message
            </Label>
            <Textarea
              id="ann-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What changed, who it affects, and what the team should do."
              maxLength={8000}
              className="mt-1.5 min-h-[88px]"
            />
          </div>
          <div>
            <Label htmlFor="ann-link" className="text-[11px] text-muted-foreground">
              Source link <span className="font-normal">(optional)</span>
            </Label>
            <Input
              id="ann-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
              className="mt-1.5 h-9"
            />
          </div>
          <AccentButton type="submit" disabled={posting || !message.trim()}>
            <Plus className="h-4 w-4" />
            {posting ? 'Posting…' : 'Post'}
          </AccentButton>
        </div>
      </form>
    </Surface>
  );
}

function LatestList({
  loading,
  items,
  canWrite,
  onCompose,
  onRemove,
}: {
  loading: boolean;
  items: Announcement[];
  canWrite: boolean;
  onCompose: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Surface flat className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">Latest</h2>
          <p className="text-[12px] text-muted-foreground">Visible to every role.</p>
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
          description="When a manager or admin posts — or a feed lands — it shows here for every role."
          actionLabel={canWrite ? 'New announcement' : undefined}
          onAction={canWrite ? onCompose : undefined}
          className="rounded-none border-0 bg-transparent shadow-none"
        />
      ) : (
        <div className="divide-y divide-border/80">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-raised/50 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <AnnouncementBody item={item} />
              </div>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label="Remove announcement"
                  className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-md px-2 text-[12px] text-muted-foreground hover:bg-danger-light hover:text-danger-text"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only">Remove</span>
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Surface>
  );
}

function FeedsSection({
  sources,
  sourceName,
  setSourceName,
  feedUrl,
  setFeedUrl,
  addingFeed,
  fetchingId,
  onAdd,
  onPull,
  onRemove,
}: {
  sources: AnnouncementSource[];
  sourceName: string;
  setSourceName: (value: string) => void;
  feedUrl: string;
  setFeedUrl: (value: string) => void;
  addingFeed: boolean;
  fetchingId: string | null;
  onAdd: () => void;
  onPull: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const hosts = OFFICIAL_FEED_HOSTS.slice(0, 8).join(', ');
  return (
    <Surface flat className="p-4 sm:p-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-primary-light text-primary">
          <Rss className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">Official RSS feeds</h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            HTTPS RSS or Atom only — pulled each morning (06:00 IST). Allowed hosts include {hosts}, and other listed
            MCA / GST / RBI / EPFO hosts.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <div>
          <Label htmlFor="feed-name" className="text-[11px] text-muted-foreground">
            Feed name
          </Label>
          <Input
            id="feed-name"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Income Tax press releases"
            className="mt-1.5 h-9"
          />
        </div>
        <div>
          <Label htmlFor="feed-url" className="text-[11px] text-muted-foreground">
            RSS / Atom URL
          </Label>
          <Input
            id="feed-url"
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://pib.gov.in/RssMain.aspx?…"
            className="mt-1.5 h-9"
          />
        </div>
        <div className="flex items-end">
          <AccentButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            disabled={addingFeed || !sourceName.trim() || !feedUrl.trim()}
          >
            {addingFeed ? 'Adding…' : 'Add feed'}
          </AccentButton>
        </div>
      </div>
      <div className="mt-3 divide-y divide-border/80 border-t border-border/80">
        {sources.length === 0 ? (
          <p className="py-3 text-[12.5px] text-muted-foreground">No feeds yet. Add an RSS URL when you have one.</p>
        ) : (
          sources.map((source) => (
            <div key={source.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{source.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">{source.feedUrl}</div>
                {source.lastError ? (
                  <div className="mt-0.5 text-[12px] text-danger-text">{feedErrorMessage(source.lastError)}</div>
                ) : source.lastFetchedAt ? (
                  <div className="mt-0.5 text-[12px] text-muted-foreground">Last pulled successfully</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onPull(source.id)}
                disabled={fetchingId === source.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-primary hover:bg-primary-light disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', fetchingId === source.id && 'animate-spin')} />
                {fetchingId === source.id ? 'Pulling…' : 'Pull'}
              </button>
              <button
                type="button"
                onClick={() => onRemove(source.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground hover:bg-danger-light hover:text-danger-text"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          ))
        )}
      </div>
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
  const sources = useAnnouncementSources(canSources);

  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [kind, setKind] = useState<AnnouncementKind>('general');
  const [sourceName, setSourceName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [addingFeed, setAddingFeed] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['announcements'] });
    await queryClient.invalidateQueries({ queryKey: ['announcement-sources'] });
  };

  const post = async () => {
    const body = message.trim();
    if (!body) return;
    setPosting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: body.split('\n')[0].slice(0, 200),
          body,
          kind,
          sourceUrl: link.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'create_failed');
      setMessage('');
      setLink('');
      setKind('general');
      setComposing(false);
      toastSuccess('Announcement posted', 'Everyone in the firm can see it.');
      await refresh();
    } catch (err) {
      toastError('Could not post', err instanceof Error ? feedErrorMessage(err.message) : 'Try again.');
    } finally {
      setPosting(false);
    }
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

  const addFeed = async () => {
    setAddingFeed(true);
    try {
      const res = await fetch('/api/announcements/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sourceName, feedUrl }),
      });
      const data = (await res.json()) as { error?: string; ingest?: { inserted: number; error?: string } };
      if (!res.ok) throw new Error(data.error ?? 'create_failed');
      setSourceName('');
      setFeedUrl('');
      const extra = data.ingest?.error
        ? ` Feed error: ${feedErrorMessage(data.ingest.error)}`
        : data.ingest?.inserted
          ? ` Pulled ${data.ingest.inserted} item${data.ingest.inserted === 1 ? '' : 's'}.`
          : '';
      toastSuccess('Feed added', extra.trim() || 'We will check it every few hours.');
      await refresh();
    } catch (err) {
      toastError('Could not add feed', err instanceof Error ? feedErrorMessage(err.message) : 'Try again.');
    } finally {
      setAddingFeed(false);
    }
  };

  const pullFeed = async (id: string) => {
    setFetchingId(id);
    try {
      const res = await fetch(`/api/announcements/sources/${id}/fetch`, { method: 'POST' });
      const data = (await res.json()) as { error?: string; ingest?: { inserted: number; error?: string } };
      if (!res.ok) throw new Error(data.error ?? 'fetch_failed');
      if (data.ingest?.error) {
        toastError('Feed did not update', feedErrorMessage(data.ingest.error));
      } else {
        toastSuccess(
          'Feed updated',
          data.ingest?.inserted ? `${data.ingest.inserted} new item(s).` : 'No new items.',
        );
      }
      await refresh();
    } catch (err) {
      toastError('Could not fetch', err instanceof Error ? feedErrorMessage(err.message) : 'Try again.');
    } finally {
      setFetchingId(null);
    }
  };

  const removeFeed = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/sources/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'delete_failed');
      toastSuccess('Feed removed');
      await refresh();
    } catch (err) {
      toastError('Could not remove feed', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const items = list.data?.announcements ?? [];
  const showComposer = canWrite && composing;

  return (
    <PageTransition>
      <SEO
        title="Announcements — VCFO Suite"
        description="Firm-wide news posted by managers and admins, plus official tax feeds."
        path={pathname}
      />
      <PageHeader
        title="Announcements"
        subtitle="Firm notes, circulars, and official filings."
        eyebrow="Firm board"
        accent="sky"
        icon={Megaphone}
        actions={
          canWrite ? (
            <AccentButton
              type="button"
              variant={composing ? 'outline' : 'solid'}
              onClick={() => setComposing((open) => !open)}
              aria-expanded={composing}
            >
              {composing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {composing ? 'Close' : 'New announcement'}
            </AccentButton>
          ) : undefined
        }
      />

      <div
        className={cn(
          'flex flex-col gap-5',
          showComposer && 'xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-5',
        )}
      >
        {showComposer ? (
          <div className="xl:order-2">
            <ComposePanel
              kind={kind}
              setKind={setKind}
              message={message}
              setMessage={setMessage}
              link={link}
              setLink={setLink}
              posting={posting}
              onPost={() => void post()}
              onClose={() => setComposing(false)}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-5 xl:order-1">
          <LatestList
            loading={list.isLoading}
            items={items}
            canWrite={canWrite}
            onCompose={() => setComposing(true)}
            onRemove={(id) => void remove(id)}
          />
          <OfficialPortalsDirectory />
          {canSources ? (
            <FeedsSection
              sources={sources.data?.sources ?? []}
              sourceName={sourceName}
              setSourceName={setSourceName}
              feedUrl={feedUrl}
              setFeedUrl={setFeedUrl}
              addingFeed={addingFeed}
              fetchingId={fetchingId}
              onAdd={() => void addFeed()}
              onPull={(id) => void pullFeed(id)}
              onRemove={(id) => void removeFeed(id)}
            />
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
