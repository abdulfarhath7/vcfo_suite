'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Chip } from '@/components/ui/spectrum-chip';
import { FileBadge } from '@/components/ui/file-badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SessionButton } from '@/components/work/SessionButton';
import { WorkField } from '@/components/work/WorkField';
import {
  openSignedFile,
  useItemSessions,
  useSessionToggle,
  useWindowRequestActions,
  useWindowRequests,
  useWorkChecklist,
  useWorkChecklistActions,
  type WorkItemDetailDto,
} from '@/components/work/use-work';
import { moveInOrder } from '@/lib/work/checklist-order';
import { formatDuration, sessionMs } from '@/lib/work/sessions';
import { dayMonth, istTimeOf, istYmdOf } from '@/lib/work/planner';
import { formatWindow } from '@/lib/projects/schedule-windows';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/** One drawer section (prototype `PanelSection`): an 11.5px capitals head and its body. */
export function DrawerSection({
  title,
  meta,
  right,
  flush,
  children,
}: {
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn('border-t border-line-soft py-4', !flush && 'px-5')}>
      <h3 className={cn('mb-2 flex min-h-[30px] items-center gap-2 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted', flush && 'px-5')}>
        <span>{title}</span>
        {meta ? <span className="text-ink-faint tabular-nums">{meta}</span> : null}
        {right ? <span className="ml-auto flex items-center gap-2">{right}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function whenLabel(iso: string): string {
  return `${dayMonth(istYmdOf(iso))} · ${istTimeOf(iso)}`;
}

/* ---------------------------------------------------------------- sessions */

export function DrawerSessions({ itemKey, title }: { itemKey: string; title: string }) {
  const query = useItemSessions(itemKey);
  const toggle = useSessionToggle();
  const running = query.data?.running ?? null;
  const sessions = query.data?.sessions ?? [];
  const now = Date.now();
  const totalDone = (query.data?.totalMs ?? 0) - (running ? sessionMs(running, now) : 0);

  const onToggle = () =>
    toggle.mutate(
      { key: itemKey, running },
      { onError: (err) => toastError("Couldn't update the session", errorMessage(err)) },
    );

  return (
    <DrawerSection
      title="Work sessions"
      meta={query.data && query.data.totalMs > 0 ? formatDuration(query.data.totalMs) : undefined}
      right={<SessionButton running={running} baseMs={Math.max(0, totalDone)} label={title} busy={toggle.isPending} onToggle={onToggle} />}
      flush
    >
      {sessions.length === 0 ? (
        <p className="px-5 text-[13px] text-ink-muted">No session yet</p>
      ) : (
        <ul>
          {sessions.slice(0, 8).map((s) => (
            <li key={s.id} className="flex items-center gap-3 border-t border-line-soft px-5 py-2 text-[13px] first:border-t-0">
              <span className="w-[120px] flex-none text-[12px] text-ink-muted tabular-nums">{whenLabel(s.startedAt)}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{s.userName ?? 'Someone'}</span>
              {s.endedAt ? (
                <span className="text-[12px] text-ink-muted tabular-nums">{formatDuration(sessionMs(s, now))}</span>
              ) : (
                <Chip tone="prog">Running</Chip>
              )}
            </li>
          ))}
        </ul>
      )}
    </DrawerSection>
  );
}

/* --------------------------------------------------------------- checklist */

export function DrawerChecklist({ itemKey }: { itemKey: string }) {
  const query = useWorkChecklist(itemKey);
  const { add, update, remove, reorder } = useWorkChecklistActions(itemKey);
  const [draft, setDraft] = useState('');
  const items = [...(query.data ?? [])].sort((a, b) => a.position - b.position);
  const done = items.filter((i) => i.done).length;
  const ids = items.map((i) => i.id);
  const fail = (err: unknown) => toastError("Couldn't save the checklist", errorMessage(err));

  const submit = () => {
    const label = draft.trim();
    if (!label) return;
    add.mutate(label, { onSuccess: () => setDraft(''), onError: fail });
  };

  return (
    <DrawerSection title="Checklist" meta={items.length > 0 ? `${done} of ${items.length}` : undefined} flush>
      {items.length > 0 ? (
        <ul>
          {items.map((item, idx) => (
            <li key={item.id} className="group flex items-center gap-3 border-t border-line-soft px-5 py-2 text-[13.5px] first:border-t-0">
              <Checkbox
                checked={item.done}
                aria-label={item.label}
                onCheckedChange={(v) => update.mutate({ id: item.id, done: v === true }, { onError: fail })}
              />
              <span className={cn('min-w-0 flex-1 truncate', item.done ? 'text-ink-muted line-through' : 'text-ink')}>{item.label}</span>
              <span className="flex flex-none items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="quiet"
                  className="h-7 w-7"
                  aria-label={`Move up · ${item.label}`}
                  disabled={idx === 0}
                  onClick={() => reorder.mutate(moveInOrder(ids, item.id, -1), { onError: fail })}
                >
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
                <Button
                  size="icon"
                  variant="quiet"
                  className="h-7 w-7"
                  aria-label={`Move down · ${item.label}`}
                  disabled={idx === items.length - 1}
                  onClick={() => reorder.mutate(moveInOrder(ids, item.id, 1), { onError: fail })}
                >
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
                <Button
                  size="icon"
                  variant="quiet"
                  className="h-7 w-7"
                  aria-label={`Delete · ${item.label}`}
                  onClick={() => remove.mutate(item.id, { onError: fail })}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className={cn('flex items-center gap-2 px-5', items.length > 0 && 'pt-2')}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a checklist item"
          aria-label="New checklist item"
          maxLength={200}
          className="h-control-sm text-[13.5px]"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!draft.trim() || add.isPending}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.6} /> Add
        </Button>
      </form>
    </DrawerSection>
  );
}

/* ------------------------------------------------------------------- files */

export function DrawerFiles({ files }: { files: WorkItemDetailDto['files'] }) {
  if (files.length === 0) return null;
  return (
    <DrawerSection title="Files" meta={files.length}>
      <ul className="grid gap-2">
        {files.map((f) => (
          <li key={`${f.source}:${f.id}`} className="flex items-center gap-2.5 text-[13px]">
            <FileBadge name={f.fileName} />
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-ink hover:underline"
              title={f.fileName}
              onClick={() =>
                void openSignedFile(f.urlRoute).catch((err) => toastError("Couldn't open the file", errorMessage(err)))
              }
            >
              {f.fileName}
            </button>
            <span className="flex-none text-[12px] text-ink-muted tabular-nums">{dayMonth(istYmdOf(f.at))}</span>
          </li>
        ))}
      </ul>
    </DrawerSection>
  );
}

/* ---------------------------------------------------------------- activity */

export function DrawerActivity({ entries }: { entries: WorkItemDetailDto['activity'] }) {
  if (entries.length === 0) return null;
  return (
    <DrawerSection title="Activity">
      <ul className="grid gap-2 text-[13px]">
        {entries.map((a) => (
          <li key={a.id} className="leading-snug">
            <b className="font-medium text-ink">{a.who}</b> <span className="text-ink-2">{a.text}</span>{' '}
            <span className="text-[12px] text-ink-muted tabular-nums">· {whenLabel(a.at)}</span>
          </li>
        ))}
      </ul>
    </DrawerSection>
  );
}

/* ------------------------------------------------------------------ window */

/**
 * The manager-set window (prototype "Span"): the dates, "Request change" for a lead,
 * and the lead's pending or last request with Withdraw.
 */
export function DrawerWindow({
  itemKey,
  title,
  companyName,
  window,
  canRequest,
}: {
  itemKey: string;
  title: string;
  companyName: string;
  window: { from: string; to: string };
  canRequest: boolean;
}) {
  const requests = useWindowRequests('all', itemKey, canRequest);
  const { create, act } = useWindowRequestActions();
  const [open, setOpen] = useState(false);
  const pending = (requests.data ?? []).find((r) => r.status === 'pending') ?? null;
  const last = pending ?? (requests.data ?? [])[0] ?? null;

  return (
    <DrawerSection
      title="Window"
      right={
        canRequest && !pending ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Request change
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-medium text-ink tabular-nums">{formatWindow(window)}</span>
        <span className="text-[12.5px] text-ink-muted">manager dates</span>
        {pending ? <Chip tone="warn">Change requested</Chip> : null}
        {!pending && last?.status === 'rejected' ? <Chip tone="bad">Change refused</Chip> : null}
      </div>
      {last && (last.status === 'pending' || last.status === 'rejected') ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">
          <span className="min-w-0 flex-1">
            Asked for {formatWindow({ from: last.fromDate ?? last.toDate, to: last.toDate })} · {last.reason}
            {last.status === 'rejected' && last.decisionNote ? ` · ${last.decidedByName ?? 'Manager'}: ${last.decisionNote}` : ''}
          </span>
          {last.status === 'pending' ? (
            <Button
              size="sm"
              variant="link"
              disabled={act.isPending}
              onClick={() =>
                act.mutate(
                  { id: last.id, action: 'withdraw' },
                  {
                    onSuccess: () => toastSuccess('Request withdrawn'),
                    onError: (err) => toastError("Couldn't withdraw the request", errorMessage(err)),
                  },
                )
              }
            >
              Withdraw
            </Button>
          ) : null}
        </div>
      ) : null}
      <RequestChangeDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        companyName={companyName}
        window={window}
        busy={create.isPending}
        onSend={(input) =>
          create.mutate(
            { itemKey, ...input },
            {
              onSuccess: () => {
                setOpen(false);
                toastSuccess('Request sent to your manager', `${title} · ${companyName}`);
              },
              onError: (err) => toastError("Couldn't send the request", errorMessage(err)),
            },
          )
        }
      />
    </DrawerSection>
  );
}

function RequestChangeDialog({
  open,
  onOpenChange,
  title,
  companyName,
  window,
  busy,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  companyName: string;
  window: { from: string; to: string };
  busy: boolean;
  onSend: (input: { fromDate: string; toDate: string; reason: string }) => void;
}) {
  const [from, setFrom] = useState(window.from);
  const [to, setTo] = useState(window.to);
  const [reason, setReason] = useState('');
  const valid = Boolean(from && to && from <= to && reason.trim() && (from !== window.from || to !== window.to));
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setFrom(window.from);
          setTo(window.to);
          setReason('');
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-medium">Request change</DialogTitle>
          <p className="text-[13px] text-ink-muted">
            {title} · {companyName} · now {formatWindow(window)}
          </p>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <WorkField label="From">
              {(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}
            </WorkField>
            <WorkField label="To">
              {(id) => (
                <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={from > to || undefined} />
              )}
            </WorkField>
          </div>
          <WorkField label="Reason">
            {(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />}
          </WorkField>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} onClick={() => onSend({ fromDate: from, toDate: to, reason: reason.trim() })}>
            Send to manager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
