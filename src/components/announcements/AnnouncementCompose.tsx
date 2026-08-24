'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { AccentButton, Surface } from '@/components/noir';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AnnouncementKindPicker } from '@/components/announcements/AnnouncementList';
import { useApp } from '@/context/AppContext';
import { addAnnouncementPopupIds, type AnnouncementKind } from '@/lib/announcements';
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
  /** Form only — for inside PageHeader footer. */
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
    <form
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        void post();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={headingId} className="text-[13px] font-semibold tracking-tight text-ink">
              New announcement
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Posted under your name.</p>
          </div>
          {bare ? null : (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-raised hover:text-ink"
              aria-label="Close composer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      <div className={cn('grid gap-3', compact ? 'mt-2.5' : 'mt-3')}>
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Type</p>
          <AnnouncementKindPicker value={kind} onChange={setKind} />
        </div>
        <div>
          <Label htmlFor={messageId} className="text-[11px] text-muted-foreground">
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
          <Label htmlFor={linkId} className="text-[11px] text-muted-foreground">
            Source link <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id={linkId}
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
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
  );

  if (bare) return form;
  if (compact) {
    return <div className="border-b border-border bg-raised/25 px-3.5 py-3">{form}</div>;
  }

  return (
    <Surface flat className="p-4 xl:sticky xl:top-20">
      {form}
    </Surface>
  );
}
