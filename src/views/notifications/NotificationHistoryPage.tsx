'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { EmptyStateIllustrated, Surface } from '@/components/noir';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useApp } from '@/context/AppContext';
import { useNotificationHistory } from '@/lib/use-notification-history';
import {
  formatNotificationTimestampIst,
  groupNotificationsForHistory,
  isCreatedAtIstToday,
  isCreatedAtThisIstWeek,
  type NotificationHistoryGroup,
} from '@/lib/notification-dismiss';
import {
  notificationsInDirection,
  type NotificationDirection,
} from '@/lib/checklist-notifications';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';

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

export default function NotificationHistoryPage() {
  const pathname = usePathname();
  const { markNotificationRead } = useApp();
  const query = useNotificationHistory();
  const [range, setRange] = useState<RangeFilter>('all');
  const [direction, setDirection] = useState<'all' | NotificationDirection>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), [query.data]);

  const filtered = useMemo(() => {
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

  const grouped = useMemo(
    () => (range === 'all' ? groupNotificationsForHistory(filtered, now) : null),
    [filtered, now, range],
  );

  const sections = grouped
    ? (['today', 'week', 'earlier'] as const)
        .map((id) => ({ id, label: GROUP_LABEL[id], items: grouped[id] }))
        .filter((section) => section.items.length > 0)
    : [{ id: 'flat' as const, label: null, items: filtered }];

  return (
    <PageTransition>
      <SEO
        title="Notification history — VCFO Suite"
        description="Every notification for your account, including items cleared from the inbox."
        path={pathname}
      />
      <PageHeader
        title="Notifications"
        accent="sky"
        icon={Bell}
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedPicker
          value={range}
          options={RANGE_FILTERS.map((tab) => ({ value: tab.id, label: tab.label }))}
          onChange={(next) => setRange(next)}
          ariaLabel="Filter by date"
          size="sm"
          className="inline-grid"
        />
        <SegmentedPicker
          value={direction}
          options={DIRECTION_FILTERS.map((tab) => ({ value: tab.id, label: tab.label }))}
          onChange={(next) => setDirection(next)}
          ariaLabel="Filter by direction"
          size="sm"
          className="inline-grid"
        />
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <HexgridLoader message="Loading history" />
        </div>
      ) : query.isError ? (
        <EmptyStateIllustrated
          icon={Bell}
          title="Could not load history"
          description="Refresh the page and try again."
          className="border-primary/25 bg-primary-light/30"
        />
      ) : filtered.length === 0 ? (
        <EmptyStateIllustrated
          icon={Bell}
          title="No notifications in this view"
          className="border-primary/25 bg-primary-light/30"
        />
      ) : (
        <div className="grid gap-4">
          {sections.map((section) => (
            <section key={section.id}>
              {section.label ? (
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </h2>
              ) : null}
              <Surface flat className="divide-y divide-border overflow-hidden p-0">
                {section.items.map((item) => (
                  <div key={item.id} className="px-1">
                    <NotificationItem
                      item={item}
                      expanded={selectedId === item.id}
                      showOpenLink
                      onOpen={() => {
                        markNotificationRead(item.id);
                        setSelectedId((current) => (current === item.id ? null : item.id));
                      }}
                    />
                    {selectedId === item.id ? (
                      <p className="px-2 pb-2 text-[10px] text-text-tertiary">
                        {formatNotificationTimestampIst(item.createdAt)} IST
                      </p>
                    ) : null}
                  </div>
                ))}
              </Surface>
            </section>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
