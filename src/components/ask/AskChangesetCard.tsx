'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { decideChangeset, editChangesetRow, fetchChangeset, startFill, undoChangeset } from '@/hooks/ask/ask-api';
import type { ChangesetRowView, ChangesetView } from '@/lib/ask/changeset/view-types';
import { ChangesetGroup } from './changeset/ChangesetGroup';
import { ChangesetRow } from './changeset/ChangesetRow';
import { dispatchFillStart, serverFillMode, useFillMode, useFillSpeed } from './fill/fill-mode';

/**
 * The review card: step, field, old value, new value, source and check result on every row, with
 * Accept or Edit. Nothing is saved until "Save accepted". The server checks everything again at that
 * click and answers with the card as it now stands, so this component only ever shows masked values.
 *
 * A card with rows for more than one destination (a dropped folder, say) shows each destination as a
 * section that folds, with its counts and its own "Accept all clear". A card of more than
 * `FOLD_ABOVE` rows starts with every section folded.
 *
 * "Accept all and fill" (top and bottom) does the three clicks in one: it accepts every row the
 * person may accept, rows that need a look included (each keeps the value the card proposes), saves
 * them through the same decide call as "Save accepted" (so the server checks every rule again and
 * Undo still works), and then, when the step order still holds rows, starts "Fill into app" in the
 * composer's mode and speed. Rows it cannot accept stay on the card, and one line says how many were
 * accepted and why the rest were left. The fill saves drafts only; it never submits.
 */

const FOLD_ABOVE = 20;
/** Row statuses still to save; matches OPEN_ROW in src/lib/ask/changeset/apply.ts (server-only). */
const OPEN_ROWS: ReadonlySet<string> = new Set(['proposed', 'edited', 'accepted', 'held', 'failed']);

/** A row the step order holds back: "Fill into app" puts it in once the steps before it are done. */
const heldByStepOrder = (row: ChangesetRowView) => OPEN_ROWS.has(row.status) && row.checks.some((check) => check.rule === 'gate' && !check.ok);

/** Does the card still hold rows for "Fill into app"? */
const fillWaiting = (view: ChangesetView) =>
  (view.status === 'proposed' || view.status === 'partly_applied') && view.rows.some(heldByStepOrder);

/** "Accepted 38 · filling · 3 left for review (held by a rule, needs a manager)". */
function acceptAllLine(accepted: number, filling: boolean, left: ChangesetRowView[]): string {
  const parts = [`Accepted ${accepted}`, filling ? 'filling' : 'saved'];
  if (left.length > 0) {
    const reasons = [...new Set(left.map((row) => row.heldReason ?? row.error ?? (row.canDecide ? 'needs a look' : 'not yours to accept')))];
    parts.push(`${left.length} left for review (${reasons.join(', ')})`);
  }
  return parts.join(' · ');
}

export function AskChangesetCard({ changesetId }: { changesetId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['ask', 'changeset', changesetId];
  const { data: card, error: loadError } = useQuery({ queryKey, queryFn: () => fetchChangeset(changesetId), retry: false });
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [folded, setFolded] = useState<Readonly<Record<string, boolean>>>({});

  const change = useMutation({
    mutationFn: (run: () => Promise<ChangesetView>) => run(),
    onSuccess: (view) => {
      queryClient.setQueryData(queryKey, view);
      setEditing(null);
    },
  });
  const [fillMode] = useFillMode();
  const [fillSpeed] = useFillSpeed();
  // "Fill into app" puts the rows the step order holds into the steps one by one; the live player
  // (Manual) or the job (Auto) picks the run up from the start event.
  const fill = useMutation({
    mutationFn: () => startFill({ changesetId, mode: serverFillMode(fillMode), chip: fillMode }),
    onSuccess: (started) =>
      dispatchFillStart({ runId: started.runId, mode: started.mode, autoAccept: started.mode === 'manual' && fillMode === 'auto' }),
  });

  // "Accept all and fill": save every pickable row, then start the fill the step order still holds.
  const [acceptAllNote, setAcceptAllNote] = useState<string | null>(null);
  const acceptAll = useMutation({
    mutationFn: async ({ ids, contentHash }: { ids: string[]; contentHash: string }) => {
      const view = await decideChangeset(changesetId, { contentHash, accept: ids });
      queryClient.setQueryData(queryKey, view);
      setAccepted(new Set());
      setEditing(null);
      const filling = fillWaiting(view);
      if (filling) {
        const started = await startFill({ changesetId, mode: serverFillMode(fillMode), chip: fillMode });
        dispatchFillStart({ runId: started.runId, mode: started.mode, autoAccept: started.mode === 'manual' && fillMode === 'auto' });
      }
      const left = view.rows.filter((row) => OPEN_ROWS.has(row.status) && !heldByStepOrder(row));
      return acceptAllLine(ids.length, filling, left);
    },
    onSuccess: (line) => setAcceptAllNote(line),
  });

  if (loadError) return <p className="rounded-md bg-surface-sunken px-3 py-2 text-[13px] text-ink-muted">This card is not available.</p>;
  if (!card) return null;

  const open = card.status === 'proposed' || card.status === 'partly_applied';
  const canPick = (row: ChangesetRowView) => open && row.canDecide && row.canAccept && !row.heldReason;
  const chosen = card.rows.filter((row) => accepted.has(row.id) && canPick(row));
  const isClear = (row: ChangesetRowView) => canPick(row) && !row.needsLook;
  const easy = card.rows.filter(isClear);
  const heldByOrder = fillWaiting(card);
  const pickable = card.rows.filter(canPick);
  const working = acceptAll.isPending || change.isPending || fill.isPending;
  const acceptAllButton =
    pickable.length > 0 ? (
      <Button
        type="button"
        size="sm"
        disabled={working}
        onClick={() => acceptAll.mutate({ ids: pickable.map((row) => row.id), contentHash: card.contentHash })}
        title="Accept every row you may accept, save them, then fill them into the app as drafts"
      >
        {acceptAll.isPending ? 'Accepting and filling…' : `Accept all and fill (${pickable.length})`}
      </Button>
    ) : null;
  const acceptAllStatus = acceptAllNote ? (
    <p role="status" className="w-full text-[12px] text-ink-muted">
      {acceptAllNote}
    </p>
  ) : null;
  const acceptMore = (ids: string[]) => setAccepted((now) => new Set([...now, ...ids]));
  const byId = new Map(card.rows.map((row) => [row.id, row]));
  // An older server may send no groups; the whole card is then one plain list.
  const groups = card.groups?.length ? card.groups : [{ key: 'all', title: card.title, kind: 'values' as const, rowIds: card.rows.map((row) => row.id), counts: { ready: 0, held: 0, applied: 0 } }];
  const sectioned = groups.length > 1 || card.rows.length > FOLD_ABOVE;
  const foldedByDefault = card.rows.length > FOLD_ABOVE;
  const toggle = (id: string) =>
    setAccepted((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const renderRow = (row: ChangesetRowView) => (
    <ChangesetRow
      key={row.id}
      row={row}
      open={open}
      pickable={canPick(row)}
      accepted={accepted.has(row.id) && canPick(row)}
      editing={editing === row.id}
      pending={change.isPending}
      onToggle={() => toggle(row.id)}
      onEdit={() => setEditing(row.id)}
      onCancelEdit={() => setEditing(null)}
      onSaveEdit={(value) => change.mutate(() => editChangesetRow(card.id, row.id, value))}
    />
  );

  return (
    <section aria-label={card.title} className="rounded-md border border-line bg-surface-raised">
      <header className="border-b border-line px-3 py-2">
        <p className="text-[13px] font-semibold text-ink">{card.title}</p>
        {card.tier === 'T3' ? (
          <p className="mt-0.5 text-[12px] text-ink-muted" data-testid="changeset-recipients">
            {card.recipients.length > 0
              ? `Goes to ${card.recipients.map((r) => (r.email ? `${r.name} <${r.email}>` : r.name)).join(', ')} once you accept.`
              : 'Nobody is set up to receive this yet.'}
          </p>
        ) : null}
        {acceptAllButton ? <div className="mt-2">{acceptAllButton}</div> : null}
      </header>
      {sectioned ? (
        <div>
          {groups.map((group) => {
            const rows = group.rowIds.map((id) => byId.get(id)).filter((row): row is ChangesetRowView => Boolean(row));
            const clear = open ? rows.filter(isClear) : [];
            const isFolded = folded[group.key] ?? foldedByDefault;
            return (
              <ChangesetGroup
                key={group.key}
                group={group}
                rows={rows}
                expanded={!isFolded}
                onToggleExpanded={() => setFolded((now) => ({ ...now, [group.key]: !isFolded }))}
                clearCount={clear.length}
                onAcceptClear={() => acceptMore(clear.map((row) => row.id))}
                renderRow={renderRow}
              />
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-line">{groups.flatMap((group) => group.rowIds).map((id) => byId.get(id)).filter((row): row is ChangesetRowView => Boolean(row)).map(renderRow)}</ul>
      )}
      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        {acceptAllButton}
        {open && easy.length > 1 ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => acceptMore(easy.map((row) => row.id))}>
            Accept all clear rows
          </Button>
        ) : null}
        {open && card.rows.some((row) => row.canDecide) ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={chosen.length === 0 || change.isPending}
              onClick={() => change.mutate(() => decideChangeset(card.id, { contentHash: card.contentHash, accept: chosen.map((row) => row.id) }))}
            >
              Save accepted{chosen.length > 0 ? ` (${chosen.length})` : ''}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={change.isPending} onClick={() => change.mutate(() => decideChangeset(card.id, { reject: true }))}>
              Discard
            </Button>
          </>
        ) : null}
        {heldByOrder ? (
          <Button type="button" size="sm" variant="outline" disabled={fill.isPending || change.isPending} onClick={() => fill.mutate()} title="Save these values step by step, in checklist order">
            {fill.isPending ? 'Starting…' : `Fill into app (${fillMode === 'auto' ? 'Auto' : 'Manual'}, ${fillSpeed === 'watch' ? 'watch it fill' : 'instantly'})`}
          </Button>
        ) : null}
        {card.canUndo ? (
          <Button type="button" size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate(() => undoChangeset(card.id))}>
            Undo
          </Button>
        ) : null}
        {card.status === 'rejected' ? <p className="text-[12px] text-ink-muted">Discarded. Nothing was saved.</p> : null}
        {card.status === 'expired' ? <p className="text-[12px] text-ink-muted">This card expired. Please send the details again.</p> : null}
        {acceptAllStatus}
        {acceptAll.error ? (
          <p role="alert" className="w-full text-[12px] text-danger">
            {(acceptAll.error as Error).message}
          </p>
        ) : null}
        {fill.error ? (
          <p role="alert" className="w-full text-[12px] text-danger">
            {(fill.error as Error).message}
          </p>
        ) : null}
        {change.error ? (
          <p role="alert" className="w-full text-[12px] text-danger">
            {(change.error as Error).message}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
