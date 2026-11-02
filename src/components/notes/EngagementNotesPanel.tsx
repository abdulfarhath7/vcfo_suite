'use client';

import { useState } from 'react';
import { Loader2, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { errorMessage, toastError } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import type { EngagementNote } from '@/lib/notes/types';
import { useEngagementNotes, useNoteMutations } from './use-engagement-notes';

const NOTE_MAX = 4000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Oct", with the year only when it is not this year (R-06). */
function noteDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getDate()} ${MON[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/**
 * NOTES on a client record (G-19, prototype ClientRecordScreen "Notes"): staff-only notes
 * from `/api/engagements/<id>/notes`. Anyone on the engagement adds and pins a note; the
 * author edits it; the author or a firm-wide admin deletes it (soft, audited). Pinned
 * notes sit first. The client never sees this card or its data.
 */
export function EngagementNotesPanel({ engagementId }: { engagementId: string }) {
  const q = useEngagementNotes(engagementId);
  const { add } = useNoteMutations(engagementId);
  const [draft, setDraft] = useState('');
  const notes = q.data ?? [];

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await add.mutateAsync({ body });
      setDraft('');
    } catch (e) {
      toastError('Could not add the note', errorMessage(e));
    }
  };

  return (
    <DashSection title="Notes" meta={q.data ? String(notes.length) : undefined} bodyClassName="p-0" loading={q.isPending}>
      {q.isError ? (
        <div className="flex items-center gap-3 px-4 py-3 text-[13px] text-ink-muted">
          <span className="flex-1">Could not load the notes</span>
          <Button size="sm" variant="secondary" onClick={() => void q.refetch()}>
            Try again
          </Button>
        </div>
      ) : notes.length === 0 ? (
        <EmptyState title="No notes yet" className="m-4" />
      ) : (
        <ul>
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} engagementId={engagementId} />
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2 border-t border-line-soft px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea
          value={draft}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="Add a note"
          aria-label="New note"
          className="min-h-[40px] flex-1 resize-y"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button type="submit" disabled={!draft.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Add
        </Button>
      </form>
    </DashSection>
  );
}

function NoteRow({ note, engagementId }: { note: EngagementNote; engagementId: string }) {
  const { update, remove } = useNoteMutations(engagementId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [confirming, setConfirming] = useState(false);
  const edited = note.updatedAt !== note.createdAt && new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;

  const save = async () => {
    const body = text.trim();
    if (!body || body === note.body) {
      setEditing(false);
      setText(note.body);
      return;
    }
    try {
      await update.mutateAsync({ id: note.id, body });
      setEditing(false);
    } catch (e) {
      toastError('Could not save the note', errorMessage(e));
    }
  };

  return (
    <li className={cn('flex items-start gap-3 border-t border-line-soft px-4 py-3 first:border-t-0', note.pinned && 'bg-surface-sunken/60')}>
      <span className="w-[64px] flex-none pt-0.5 text-[12px] text-ink-muted">{noteDate(note.createdAt)}</span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="grid gap-2">
            <Textarea value={text} maxLength={NOTE_MAX} rows={3} aria-label="Edit note" onChange={(e) => setText(e.target.value)} />
            <span className="flex gap-2">
              <Button size="sm" onClick={() => void save()} disabled={update.isPending || !text.trim()}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setText(note.body);
                }}
              >
                Cancel
              </Button>
            </span>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-[14px] text-ink">{note.body}</p>
        )}
        <p className="mt-1 text-[12.5px] text-ink-muted">
          {note.authorName ?? 'Former staff member'}
          {note.pinned ? ' · Pinned' : ''}
          {edited ? ' · Edited' : ''}
        </p>
        {confirming ? (
          <span className="mt-2 flex items-center gap-2 text-[13px]">
            <span className="text-ink-2">Delete this note?</span>
            <Button
              size="sm"
              variant="destructive"
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(note.id);
                } catch (e) {
                  setConfirming(false);
                  toastError('Could not delete the note', errorMessage(e));
                }
              }}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </span>
        ) : null}
      </div>
      {!editing && !confirming ? (
        <span className="flex flex-none items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            title={note.pinned ? 'Unpin' : 'Pin'}
            disabled={update.isPending}
            onClick={async () => {
              try {
                await update.mutateAsync({ id: note.id, pinned: !note.pinned });
              } catch (e) {
                toastError('Could not pin the note', errorMessage(e));
              }
            }}
          >
            {note.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          </Button>
          {note.mine ? (
            <Button size="icon" variant="ghost" aria-label="Edit note" title="Edit" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
            </Button>
          ) : null}
          {note.canDelete ? (
            <Button size="icon" variant="ghost" aria-label="Delete note" title="Delete" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}
