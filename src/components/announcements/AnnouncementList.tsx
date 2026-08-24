'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  ANNOUNCEMENT_KIND_LABEL,
  ANNOUNCEMENT_KINDS,
  announcementAuthorName,
  parseAnnouncementKind,
  type Announcement,
  type AnnouncementKind,
} from '@/lib/announcements';
import { cn } from '@/lib/utils';

export function formatAnnouncementWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function AnnouncementKindChip({ kind }: { kind: string }) {
  const parsed = parseAnnouncementKind(kind);
  return <span className={cn('ann-kind', `ann-kind-${parsed}`)}>{ANNOUNCEMENT_KIND_LABEL[parsed]}</span>;
}

export function AnnouncementKindPicker({
  value,
  onChange,
}: {
  value: AnnouncementKind;
  onChange: (kind: AnnouncementKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {ANNOUNCEMENT_KINDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'ann-kind transition-opacity',
            `ann-kind-${id}`,
            value === id ? 'ring-1 ring-primary/40 ring-offset-1 ring-offset-panel' : 'opacity-70 hover:opacity-100',
          )}
        >
          {ANNOUNCEMENT_KIND_LABEL[id]}
        </button>
      ))}
    </div>
  );
}

export function AnnouncementRow({
  item,
  unread = false,
  compact,
  showSource,
  onActivate,
  trailing,
  className,
}: {
  item: Announcement;
  unread?: boolean;
  compact?: boolean;
  showSource?: boolean;
  onActivate?: () => void;
  trailing?: ReactNode;
  className?: string;
}) {
  const message = item.body.trim() || item.title;
  const sentBy = announcementAuthorName(item);
  const showExtraTitle = Boolean(item.title && item.body && item.title !== item.body && !compact);
  const includeSource = Boolean(showSource ?? !compact) && Boolean(item.sourceUrl);
  const meta = compact ? 'text-[11px]' : 'text-[12px]';
  const rowClass = cn(
    'unread-edge flex w-full min-w-0 items-center gap-2.5 text-left',
    compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5 sm:px-5',
    onActivate && 'cursor-pointer hover:bg-raised/30',
    className,
  );

  const inner = (
    <>
      <AnnouncementKindChip kind={item.kind} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-semibold text-ink',
            compact ? 'line-clamp-2 text-[13px] leading-snug' : 'text-[14px] leading-snug',
          )}
        >
          {message}
        </p>
        <p className={cn('mt-0.5 flex min-w-0 items-center gap-1.5 leading-snug', meta)}>
          {unread ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          ) : null}
          <span className={cn('truncate', unread ? 'text-ink' : 'text-muted-foreground')}>{sentBy}</span>
        </p>
        {showExtraTitle ? (
          <p className="mt-1 text-[12.5px] text-muted-foreground">{item.title}</p>
        ) : null}
        {includeSource && item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-[1] mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Source
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      <time
        dateTime={item.publishedAt}
        className={cn('shrink-0 self-center tabular-nums text-muted-foreground', compact ? 'text-[11px]' : 'text-[12px]')}
      >
        {formatAnnouncementWhen(item.publishedAt)}
      </time>
      {trailing}
    </>
  );

  return (
    <div
      className={rowClass}
      data-unread={unread ? 'true' : 'false'}
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      {inner}
    </div>
  );
}

export function AnnouncementBody({
  item,
  compact,
  unread,
}: {
  item: Announcement;
  compact?: boolean;
  unread?: boolean;
}) {
  return <AnnouncementRow item={item} compact={compact} unread={unread} showSource={!compact} className="px-0 py-1" />;
}

export function AnnouncementCompactList({
  items,
  href,
}: {
  items: Announcement[];
  href: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-muted-foreground">
        No announcements yet.{' '}
        <Link href={href} className="font-semibold text-primary hover:underline">
          Open the board
        </Link>
      </p>
    );
  }
  return (
    <div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <Link key={item.id} href={href} className="block min-w-0 hover:bg-raised/40">
            <AnnouncementRow item={item} compact className="px-0 py-2" />
          </Link>
        ))}
      </div>
      <Link href={href} className="mt-3 inline-block px-0.5 text-[12px] font-semibold text-primary hover:underline">
        View all announcements
      </Link>
    </div>
  );
}
