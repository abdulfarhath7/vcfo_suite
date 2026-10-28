'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AnnouncementKindPicker } from '@/components/announcements/AnnouncementList';
import { useApp } from '@/context/AppContext';
import { addAnnouncementPopupIds, type AnnouncementKind } from '@/lib/notifications/announcements';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

export function AnnouncementComposeForm({
  compact = false,
  bare = false,
  onClose,
  onPosted,
  idPrefix = 'ann',
}: {
  compact?: boolean;
  /** Form only, for a host card that draws its own head; the heading stays for screen readers. */
  bare?: boolean;
  onClose: () => void;
  onPosted?: () => void;
  idPrefix?: string;
}) {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<AnnouncementKind>('general');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [posting, setPosting] = useState(false);
  const messageId = `${idPrefix}-message`;
  const linkId = `${idPrefix}-link`;
  const headingId = `${idPrefix}-compose-heading`;

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
      const data = (await res.json()) as { error?: string; announcement?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? 'create_failed');
      if (user?.id && data.announcement?.id) {
        addAnnouncementPopupIds(user.id, [data.announcement.id]);
      }
      setMessage('');
      setLink('');
      setKind('general');
      toastSuccess('Announcement posted');
      await queryClient.invalidateQueries({ queryKey: ['announcements'] });
      await queryClient.invalidateQueries({ queryKey: ['announcements-head'] });
      onPosted?.();
      onClose();
    } catch (err) {
      toastError(
        'Could not post',
        err instanceof Error ? err.message.replaceAll('_', ' ') : 'Try again.',
      );
    } finally {
      setPosting(false);
    }
  };

  const form = (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the handlers below are propagation guards, not interactions: they stop events reaching the popup host
    <form
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        void post();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
        {bare ? (
          <h2 id={headingId} className="sr-only">
            New announcement
          </h2>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <h2 id={headingId} className="text-[15px] font-medium text-ink">
              New announcement
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="grid h-[30px] w-[30px] place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
              aria-label="Close composer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      <div className={cn('grid gap-3', bare ? null : compact ? 'mt-2.5' : 'mt-3')}>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Type</p>
          <AnnouncementKindPicker value={kind} onChange={setKind} />
        </div>
        <div>
          <Label htmlFor={messageId}>
            Message
          </Label>
          <Textarea
            id={messageId}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What changed, who it affects, and what the team should do."
            maxLength={8000}
            className={cn('mt-1.5', compact ? 'min-h-[72px]' : 'min-h-[88px]')}
          />
        </div>
        <div>
          <Label htmlFor={linkId}>
            Source link <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Input
            id={linkId}
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://"
            className="mt-1.5"
          />
        </div>
        <div className="flex justify-end gap-2">
          {bare ? (
            <Button type="button" variant="outline" onClick={onClose} disabled={posting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={posting || !message.trim()}>
            <Plus aria-hidden />
            {posting ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </div>
    </form>
  );

  if (bare) return form;
  if (compact) {
    return <div className="border-b border-line bg-surface-sunken px-3.5 py-3">{form}</div>;
  }

  return (
    <div className="surface p-4 xl:sticky xl:top-20">{form}</div>
  );
}
