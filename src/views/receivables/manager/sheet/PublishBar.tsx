'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Copy, ListChecks, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { Input } from '@/components/ui/input';
import { PopoverCard } from '@/components/ui/popover';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { ManagerSheetDto } from '@/lib/receivables/wire';
import { usePendingChanges, type useReceivablesActions } from '@/hooks/use-receivables';
import { stamp } from '../../format';
import { ShareDialog } from '../ShareDialog';
import { changeDiff } from './change-text';

type Actions = ReturnType<typeof useReceivablesActions>;

/** A toolbar button as tall as the 12.5px text beside it (the base size is taller, so `!`). */
export const TOOL_BTN = '!h-7 !px-2.5 !text-[12.5px] [&_svg]:!size-3.5';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

/**
 * The publish state at the right end of the sheet's one toolbar row (17 Nov 2026; it began as the
 * Phase 10 publish bar): the draft count with a "What changes" list of exactly what the next
 * Update publishes, an optional Update note and the Update button (an "Up to date" mark otherwise),
 * and the last published stamp. Share and Copy link show only with `external` (the
 * RECEIVABLES_EXTERNAL flag). `leading` and `trailing` sit before and after it.
 */
export function PublishBar({
  data,
  actions,
  leading,
  trailing,
  external = false,
  onEmail,
}: {
  data: ManagerSheetDto;
  actions: Actions;
  leading?: ReactNode;
  trailing?: ReactNode;
  external?: boolean;
  /** Opens Send email (the Share dialog offers it too). */
  onEmail: () => void;
}) {
  const [open, setOpen] = useState<'share' | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [note, setNote] = useState('');
  const dirty = data.unpublishedChanges;
  const v = data.latestVersion;
  const changes = usePendingChanges(data.sheet.id, listOpen && dirty > 0, dirty);
  const partnerNames = useMemo(() => new Map(data.partners.map((p) => [p.id, p.name])), [data.partners]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.publicUrl);
      toastSuccess('Client link copied', data.publicUrl);
    } catch {
      toastError('Could not copy', data.publicUrl);
    }
  };
  const publish = () =>
    actions.publish.mutate(note.trim() || undefined, {
      onSuccess: () => {
        setNote('');
        setListOpen(false);
        toastSuccess('Published', 'The client page now shows this version.');
      },
      onError: (e) => toastError('Update failed', errorText(e)),
    });

  return (
    <span role="group" aria-label="Publish" className="inline-flex flex-wrap items-center gap-1.5 text-[12.5px]">
      {leading}
      {dirty ? (
        <>
          <PopoverCard
            open={listOpen}
            onOpenChange={setListOpen}
            width={440}
            label="What the next Update changes"
            title={`What Update changes · ${dirty}`}
            footer={<span className="mr-auto text-[12px] text-ink-muted">Pauses and notes are not listed.</span>}
            trigger={
              <Button size="sm" variant="quiet" className={TOOL_BTN} title="What the next Update changes">
                <ListChecks aria-hidden />
                {`Draft · ${dirty}`}
              </Button>
            }
          >
            {changes.isLoading ? <div className="m-4 h-16 animate-pulse rounded-md bg-surface-sunken" aria-busy="true" /> : null}
            {changes.isError ? (
              <p role="alert" className="m-0 px-4 py-3 text-[13px] text-danger">
                {errorText(changes.error)}
              </p>
            ) : null}
            {changes.data ? (
              <ol className="m-0 list-none p-0">
                {changes.data.changes.map((c) => {
                  const diff = changeDiff(c, partnerNames);
                  return (
                    <li key={c.id} className="border-t border-line-soft px-4 py-2 first:border-0">
                      <div className="text-[13px] text-ink">{c.summary}</div>
                      {diff ? <div className="text-[12px] tabular-nums text-ink-2">{diff}</div> : null}
                      <div className="text-[11.5px] text-ink-muted">{`${c.actorName ? `${c.actorName} · ` : ''}${stamp(c.createdAt)}`}</div>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </PopoverCard>
          <Input
            aria-label="Update note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !actions.publish.isPending && publish()}
            placeholder="Note (optional)"
            className="!h-7 w-[140px] text-[12.5px]"
          />
          <Button size="sm" className={TOOL_BTN} onClick={publish} disabled={actions.publish.isPending}>
            {actions.publish.isPending ? 'Updating…' : `Update · ${dirty}`}
          </Button>
        </>
      ) : (
        <Chip raw tone="ok" title="The latest version holds every change">
          Up to date
        </Chip>
      )}
      <span className="min-w-0 truncate text-[12px] text-ink-muted">
        {v ? `v${v.seq} · ${stamp(v.publishedAt)}${v.publishedByName ? ` · ${v.publishedByName}` : ''}` : 'Not published yet'}
      </span>
      {external ? (
        <>
          <Button size="sm" variant="quiet" className={TOOL_BTN} onClick={() => setOpen('share')}>
            <Share2 aria-hidden />
            Share
          </Button>
          <Button size="sm" variant="quiet" className={TOOL_BTN} onClick={copy}>
            <Copy aria-hidden />
            Copy link
          </Button>
        </>
      ) : null}
      {trailing}
      {open === 'share' ? <ShareDialog data={data} onClose={() => setOpen(null)} onEmail={onEmail} /> : null}
    </span>
  );
}
