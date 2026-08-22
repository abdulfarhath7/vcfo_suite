'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import {
  ANNOUNCEMENT_KIND_LABEL,
  ANNOUNCEMENT_KINDS,
  announcementAttribution,
  parseAnnouncementKind,
  type Announcement,
  type AnnouncementKind,
} from '@/lib/announcements';
import { cn } from '@/lib/utils';

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

export function AnnouncementBody({
  item,
  compact,
}: {
  item: Announcement;
  compact?: boolean;
}) {
  const message = item.body.trim() || item.title;
  const sentBy = announcementAttribution(item);
  const when = (
    <time dateTime={item.publishedAt}>
      {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
    </time>
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <AnnouncementKindChip kind={item.kind} />
        {!compact ? <span className="text-[11px] text-muted-foreground">{when}</span> : null}
      </div>
      <p
        className={cn(
          'font-medium text-ink',
          compact ? 'mt-1 line-clamp-3 text-[13px] leading-snug' : 'mt-1.5 text-[14px] leading-relaxed',
        )}
      >
        {message}
      </p>
      {item.title && item.body && item.title !== item.body && !compact ? (
        <p className="mt-1 text-[12.5px] text-muted-foreground">{item.title}</p>
      ) : null}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {sentBy}
        {compact ? (
          <>
            <span className="mx-1.5 text-border">·</span>
            {when}
          </>
        ) : null}
      </p>
      {item.sourceUrl && !compact ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-[1] mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
        >
          Source
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
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
        No firm announcements yet.{' '}
        <Link href={href} className="font-semibold text-primary hover:underline">
          Open the board
        </Link>
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link key={item.id} href={href} className="block min-w-0 hover:opacity-90">
          <AnnouncementBody item={item} compact />
        </Link>
      ))}
      <Link href={href} className="text-[12px] font-extrabold text-primary hover:underline">
        View all announcements
      </Link>
    </div>
  );
}
