'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronRight, X } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Chip, Tag } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { DashSection } from '@/components/dash/DashSection';
import { NotificationKindTile } from '@/components/notifications/notification-kind';
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_KIND_LOOK,
  type NotificationGroup,
} from '@/components/notifications/notification-kind-look';
import { useApp } from '@/context/AppContext';
import { useNotificationHistory } from '@/hooks/use-notification-history';
import {
  formatNotificationTimestampIst,
  formatNotificationWhen,
  groupNotificationsForHistory,
  isCreatedAtIstToday,
  isCreatedAtThisIstWeek,
  notificationHrefIsNavigable,
  type NotificationHistoryGroup,
} from '@/lib/notifications/notification-dismiss';
import { NOTIFICATION_KIND_LABEL } from '@/lib/notifications/notification-popup';
import {
  notificationsInDirection,
  type AppNotification,
  type NotificationDirection,
} from '@/lib/checklist/checklist-notifications';
import { cn } from '@/lib/utils';

/* VCFO Spectrum notifications (prototype src/screens/shared/NotificationsScreen.tsx, row C-0110).
   One card headed by the date switch, rows grouped by day with a type tile, the title, the
   second line, a status chip, the client and time, an unread dot and an open button. The side
   card counts this view by type, and a type row sets a filter chip. Data, read marks and
   filters are the real history query's. */

const RANGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'earlier', label: 'Earlier' },
] as const;

type RangeFilter = (typeof RANGE_FILTERS)[number]['id'];

const DIRECTION_FILTERS: Array<{ id: 'all' | NotificationDirection; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'received', label: 'Received' },
  { id: 'sent', label: 'Sent' },
];

const GROUP_LABEL: Record<NotificationHistoryGroup, string> = {
  today: 'Today',
  week: 'Earlier this week',
  earlier: 'Earlier',
};

/* Status colours only (R-25), one per type group. */
const BAR_TONE: Record<NotificationGroup, string> = {
  Steps: 'bg-brand',
  Documents: 'bg-warning-mid',
  Requests: 'bg-waiting-mid',
  Team: 'bg-upcoming-mid',
  Email: 'bg-positive-mid',
};

function groupOf(item: AppNotification): NotificationGroup {
  return NOTIFICATION_KIND_LOOK[item.kind]?.group ?? 'Steps';
}

function NotificationRow({
  item,
  unread,
  expanded,
  onOpen,
}: {
  item: AppNotification;
  unread: boolean;
  expanded: boolean;
  onOpen: () => void;
}) {
  const look = NOTIFICATION_KIND_LOOK[item.kind];
  const canOpen = notificationHrefIsNavigable(item.href);
  const when = formatNotificationWhen(item.createdAt);
  const who = [item.companyName || null, when].filter(Boolean).join(' · ');
  const dismissed = Boolean(item.dismissedAt);

  return (
    <li className="border-t border-line-soft first:border-t-0">
      <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-surface-sunken">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
        >
          <span className="flex-none self-start sm:self-center">
            <NotificationKindTile kind={item.kind} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn('min-w-0 truncate', unread ? 'font-medium text-ink' : 'text-ink-2')}>{item.title}</span>
              {dismissed ? <Tag className="h-5 flex-none px-1.5 text-[11px]">Cleared</Tag> : null}
            </span>
            {item.body ? (
              <span
                className={cn(
                  'mt-0.5 block text-[12.5px] text-ink-2',
                  expanded ? 'whitespace-pre-wrap break-words' : 'truncate',
                )}
              >
                {item.body}
              </span>
            ) : null}
            <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted sm:hidden">{who}</span>
          </span>
          <span className="hidden w-[104px] flex-none sm:block">
            <Chip fixed tone={look?.tone}>
              {NOTIFICATION_KIND_LABEL[item.kind]}
            </Chip>
          </span>
          <span className="hidden w-[170px] flex-none truncate text-right text-[12.5px] text-ink-muted sm:block" title={who}>
            {who}
          </span>
        </button>
        <span className="flex flex-none items-center gap-1.5">
          <span
            className={cn('h-2 w-2 rounded-[2px]', unread ? 'bg-brand' : 'bg-transparent')}
            role={unread ? 'img' : undefined}
            aria-label={unread ? 'Unread' : undefined}
          />
          {canOpen ? (
            <Link
              href={item.href}
              className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-[30px] w-[30px] min-w-0 text-ink-2')}
              aria-label={`Open ${item.title}`}
              title="Open"
            >
              <ArrowRight aria-hidden />
            </Link>
          ) : (
            <span className="w-[30px]" />
          )}
        </span>
      </div>
      {expanded ? (
        <p className="-mt-1 pb-2.5 pl-[58px] pr-4 text-[12px] tabular-nums text-ink-muted">
          {formatNotificationTimestampIst(item.createdAt)} IST
        </p>
      ) : null}
    </li>
  );
}

export default function NotificationHistoryPage() {
  const pathname = usePathname();
  const { markNotificationRead } = useApp();
  const query = useNotificationHistory();
  const [range, setRange] = useState<RangeFilter>('all');
  const [direction, setDirection] = useState<'all' | NotificationDirection>('all');
  const [type, setType] = useState<NotificationGroup | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readHere, setReadHere] = useState<Set<string>>(() => new Set());

  const now = useMemo(() => new Date(), [query.data]);

  /** The date and direction switches; the type filter applies after, so the side card can count types. */
  const inView = useMemo(() => {
    let items = query.data ?? [];
    if (direction !== 'all') {
      items = notificationsInDirection(items, direction);
    }
    if (range === 'today') {
      items = items.filter((n) => isCreatedAtIstToday(n.createdAt, now));
    } else if (range === 'week') {
      items = items.filter((n) => isCreatedAtThisIstWeek(n.createdAt, now));
    } else if (range === 'earlier') {
      items = items.filter((n) => !isCreatedAtThisIstWeek(n.createdAt, now));
    }
    return items;
  }, [query.data, direction, range, now]);

  const filtered = useMemo(
    () => (type ? inView.filter((n) => groupOf(n) === type) : inView),
    [inView, type],
  );

  const grouped = useMemo(
    () => (range === 'all' ? groupNotificationsForHistory(filtered, now) : null),
    [filtered, now, range],
  );

  const sections = grouped
    ? (['today', 'week', 'earlier'] as const)
        .map((id) => ({ id, label: GROUP_LABEL[id] as string | null, items: grouped[id] }))
        .filter((section) => section.items.length > 0)
    : [{ id: 'flat' as const, label: null, items: filtered }];

  const typeCount = (g: NotificationGroup) => inView.filter((n) => groupOf(n) === g).length;
  const total = inView.length;
  const isUnread = (n: AppNotification) => !n.read && !readHere.has(n.id);
  const filtersSet = range !== 'all' || direction !== 'all' || type !== null;

  function resetFilters() {
    setRange('all');
    setDirection('all');
    setType(null);
  }

  return (
    <PageTransition>
      <SEO
        title="Notification history — VCFO Suite"
        description="Every notification for your account, including items cleared from the inbox."
        path={pathname}
      />
      {/* The top bar names the page, so the heading is for screen readers only. */}
      <h1 className="sr-only">Notifications</h1>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_272px]">
        <section className="surface min-w-0 overflow-hidden" aria-label="Notification history">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
            <SpectrumTabs
              size="md"
              label="Filter by date"
              items={RANGE_FILTERS.map((tab) => ({ key: tab.id, label: tab.label }))}
              value={range}
              onChange={(key) => setRange(key as RangeFilter)}
            />
            {type ? (
              <button
                type="button"
                onClick={() => setType(null)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border-1.5 border-brand-line bg-brand-soft px-2.5 text-[13px] font-medium text-brand-text"
                aria-label={`Remove filter: ${type}`}
              >
                {type}
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            <span className="mr-auto" />
            <SpectrumTabs
              size="md"
              label="Filter by direction"
              items={DIRECTION_FILTERS.map((tab) => ({ key: tab.id, label: tab.label }))}
              value={direction}
              onChange={(key) => setDirection(key as 'all' | NotificationDirection)}
            />
          </div>

          {query.isLoading ? (
            <div className="p-4" aria-busy="true" aria-label="Loading history">
              <SkeletonRows rows={6} className="[&>span]:h-[52px]" />
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <EmptyState
                title="Could not load history"
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4" role="status">
              <EmptyState
                title="No notifications in this view"
                action={
                  filtersSet ? (
                    <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                      See all
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.id}>
                {section.label ? (
                  <h2 className="flex h-9 items-end border-t border-line-soft px-4 pb-2 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted first:border-t-0">
                    {section.label}
                  </h2>
                ) : null}
                <ul>
                  {section.items.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      unread={isUnread(item)}
                      expanded={selectedId === item.id}
                      onOpen={() => {
                        markNotificationRead(item.id);
                        setReadHere((prev) => new Set(prev).add(item.id));
                        setSelectedId((current) => (current === item.id ? null : item.id));
                      }}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <DashSection title="By type" bodyClassName="p-0">
          {query.isLoading ? (
            <div className="p-4">
              <SkeletonRows rows={3} />
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setType(null)}
                className="block w-full px-4 pt-4 text-left hover:bg-surface-sunken"
                aria-label={`Show all ${total} notifications in this view`}
              >
                <span className="text-[26px] font-medium leading-none tabular-nums text-ink">{total}</span>
                <span className="ml-2 text-[12.5px] text-ink-muted">in this view</span>
              </button>
              <div className="px-4 pb-2 pt-3">
                <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-bar bg-surface-sunken" aria-hidden>
                  {NOTIFICATION_GROUPS.map((g) => {
                    const n = typeCount(g);
                    return n > 0 ? (
                      <span key={g} className={cn('h-full', BAR_TONE[g])} style={{ flexGrow: n, flexBasis: 0 }} />
                    ) : null;
                  })}
                </div>
              </div>
              <ul>
                {NOTIFICATION_GROUPS.map((g) => {
                  const on = type === g;
                  return (
                    <li key={g} className="border-t border-line-soft first:border-t-0">
                      <button
                        type="button"
                        onClick={() => setType(on ? null : g)}
                        aria-pressed={on}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2.5 px-4 py-2 text-left text-[14px] hover:bg-surface-sunken',
                          on && 'bg-brand-soft text-brand-text',
                        )}
                      >
                        <i className={cn('h-2 w-2 flex-none rounded-[2px]', BAR_TONE[g])} aria-hidden />
                        <span className="min-w-0 flex-1">{g}</span>
                        <b className="font-medium tabular-nums">{typeCount(g)}</b>
                        <ChevronRight className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.6} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </DashSection>
      </div>
    </PageTransition>
  );
}
