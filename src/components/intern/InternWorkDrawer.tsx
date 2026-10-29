'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/ui/side-panel';
import { Button } from '@/components/ui/button';
import { Chip, OwnerChip, Tag } from '@/components/ui/spectrum-chip';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { LeadCompanyChip } from '@/components/intern/LeadCompanyChip';
import { internKindOwner, internKindStatus } from '@/components/intern/intern-tones';
import {
  DrawerActivity,
  DrawerChecklist,
  DrawerFiles,
  DrawerSection,
  DrawerSessions,
  DrawerWindow,
} from '@/components/work/DrawerWorkSections';
import { useWorkItemDetail, type WorkCompletionDto } from '@/components/work/use-work';
import { useApp } from '@/context/AppContext';
import { formatDueLabel, internWorkCta, type InternWorkItem } from '@/lib/intern/intern-work';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { toastSaved } from '@/components/ui/toast-saved';
import { toastUndo } from '@/components/ui/undo-toast';
import { cn } from '@/lib/utils';

const SOURCE_WORD: Record<string, string> = { step: 'Step', filing: 'Filing', request: 'Client request', task: 'Task' };
const OPEN_WORD: Record<string, string> = {
  step: 'Open step',
  filing: 'Open filing',
  request: 'Open company',
  task: 'Open company',
};

/** The real `compliance_instances.id` of a filing, from its stored item key (`filing:<id>`). */
function filingInstanceId(item: InternWorkItem, workKey: string | null | undefined): string | null {
  if (item.source !== 'filing' || !workKey?.startsWith('filing:')) return null;
  return workKey.slice('filing:'.length) || null;
}

/** Roles that may reopen a filing, so Mark filed can be undone. */
const MAY_REOPEN = new Set(['super_admin', 'admin', 'manager']);

async function setFilingStatus(id: string, action: 'file' | 'reopen'): Promise<void> {
  const res = await fetch(`/api/filings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'status_failed');
  }
}

/** "Mark done" is offered only where the item's own completion path allows it (G-16). */
function canMarkDone(item: InternWorkItem, completion: WorkCompletionDto | undefined, workKey?: string | null): boolean {
  if (item.kind === 'done') return false;
  // A filing with its register row files through PATCH /api/filings/:id/status.
  if (filingInstanceId(item, workKey)) return true;
  if (!completion) return false;
  if (completion.mode === 'request') return completion.canComplete && Boolean(item.requestId);
  if (completion.mode === 'direct') return completion.canComplete && Boolean(item.catalogId);
  return false;
}

/**
 * Task drawer (prototype `TaskDrawer` and `WorkDrawer`): a right-side panel with the work item's
 * facts, its manager window and "Request change", work sessions with a timer, the lead's own
 * checklist, the item's files and activity, and the actions the row already had. Every fact
 * comes from the work item or the work routes; nothing here is invented for the panel.
 *
 * "Mark done" uses only existing completion paths: a document request is approved
 * (`approveDoc`, PATCH /api/requests/:id); a pre-incorporation direct-flow step is submitted
 * (`submitDirectStep`, POST …/checklist/submit) when the checklist validator finds nothing
 * missing; a filing with its register row is marked filed (PATCH /api/filings/:id/status, Undo
 * reopens it for a manager or admin). Every other step links to its form. `workKey` is the stored item key
 * (`workItemKeyFor`); without one the per-item tools are hidden.
 */
export function InternWorkDrawer({
  item,
  workKey,
  now,
  onClose,
  ownerName,
  pendingWithMe,
}: {
  item: InternWorkItem | null;
  workKey?: string | null;
  now: Date;
  onClose: () => void;
  /** The project lead who holds the item (manager Work and the one-lead page). */
  ownerName?: string;
  /** The item waits on the viewer (a manager's approval): the head shows "Pending with me". */
  pendingWithMe?: boolean;
}) {
  const { user, approveDoc, submitDirectStep, tasks } = useApp();
  // "Assigned by" (tasks.assigned_by, migration 0028) for a task someone else gave the holder.
  const assignedBy = item?.taskId ? tasks.find((t) => t.id === item.taskId)?.assignedByName : undefined;
  const queryClient = useQueryClient();
  const key = item ? (workKey ?? null) : null;
  const detail = useWorkItemDetail(key);
  const [completing, setCompleting] = useState(false);

  const status = item ? internKindStatus(item) : null;
  const owner = item ? internKindOwner(item.kind) : undefined;
  const cta = item ? internWorkCta(item) : null;
  const completion = detail.data?.completion;
  const markDone = item ? canMarkDone(item, completion, key) : false;

  const facts: Array<{ k: string; v: ReactNode }> = item
    ? [
        { k: 'Company', v: item.companyName },
        ...(ownerName ? [{ k: 'Owner', v: ownerName }] : []),
        { k: 'Type', v: SOURCE_WORD[item.source] ?? 'Step' },
        ...(item.catalogLabel ? [{ k: 'Step', v: <span className="font-mono text-[13px]">{item.catalogLabel}</span> }] : []),
        {
          k: 'Due',
          v: <span className={cn(item.isOverdue && item.kind !== 'done' && 'font-medium text-danger')}>{formatDueLabel(item.dueAt, now)}</span>,
        },
        // The Window section below replaces this row once the item's own window has loaded.
        ...(item.windowLabel && !detail.data?.window
          ? [{ k: 'Window', v: <span className="tabular-nums">{item.windowLabel}</span> }]
          : []),
        ...(item.startedAt ? [{ k: 'Started', v: formatDueLabel(item.startedAt, now) }] : []),
        ...(item.completedAt ? [{ k: 'Done', v: formatDueLabel(item.completedAt, now) }] : []),
        ...(item.ageLabel ? [{ k: 'Waiting for', v: item.ageLabel }] : []),
        { k: 'State', v: item.why },
        ...(completion?.mode === 'direct' && !completion.canComplete && item.kind !== 'done'
          ? [{ k: 'To finish', v: `${completion.missing} ${completion.missing === 1 ? 'field' : 'fields'} in the step form` }]
          : []),
        ...(completion?.mode === 'locked' ? [{ k: 'Locked', v: completion.message }] : []),
      ]
    : [];

  const complete = async () => {
    if (!item) return;
    const instanceId = filingInstanceId(item, key);
    if (!instanceId && !completion) return;
    setCompleting(true);
    try {
      if (instanceId) {
        await setFilingStatus(instanceId, 'file');
        void queryClient.invalidateQueries();
        if (MAY_REOPEN.has(user?.role ?? '')) {
          toastUndo(`Marked filed · ${item.title}`, () => {
            void setFilingStatus(instanceId, 'reopen').then(() => queryClient.invalidateQueries());
          });
        } else {
          toastSaved('Marked filed', { kind: 'filed', sub: item.title });
        }
        onClose();
        return;
      }
      if (!completion) return;
      if (completion.mode === 'request' && item.requestId) {
        approveDoc(item.requestId);
        toastSuccess('Marked done', item.title);
        onClose();
        return;
      }
      if (completion.mode === 'direct' && item.catalogId) {
        const result = await submitDirectStep(item.engagementId, item.catalogId, {});
        if (result.outcome === 'invalid') {
          const n = Object.keys(result.fieldErrors ?? {}).length;
          toastError('Step not complete', `${n} ${n === 1 ? 'field' : 'fields'} to finish in the step form`);
          void queryClient.invalidateQueries({ queryKey: ['work', 'detail'] });
          return;
        }
        toastSuccess('Marked done', item.title);
        void queryClient.invalidateQueries({ queryKey: ['work', 'detail'] });
        onClose();
      }
    } catch (err) {
      toastError("Couldn't mark it done", errorMessage(err));
    } finally {
      setCompleting(false);
    }
  };

  const showOpen = Boolean(cta && (cta.action !== 'open' || item?.kind === 'done' || markDone));

  const notes = item?.taskId ? tasks.find((t) => t.id === item.taskId)?.notes?.trim() : undefined;

  return (
    <SidePanel
      open={!!item}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      width={480}
      eyebrow={
        item ? (
          <>
            <LeadCompanyChip name={item.companyName} compact />
            <span className="truncate">{item.companyName}</span>
            {item.catalogLabel ? <span className="flex-none font-mono">· {item.catalogLabel}</span> : null}
          </>
        ) : null
      }
      title={item?.title ?? 'Task'}
      sub={
        item && status ? (
          <>
            <Chip tone={status.tone} title={item.why}>
              {status.word}
            </Chip>
            {pendingWithMe ? (
              <Tag tone="prog">Pending with me</Tag>
            ) : owner ? (
              <OwnerChip owner={owner} label={owner === 'client' ? 'With client' : 'With manager'} />
            ) : null}
            {item.isCritical ? <Tag tone="bad">Critical</Tag> : null}
            {assignedBy ? <Tag tone="idle">Assigned by {assignedBy}</Tag> : null}
          </>
        ) : null
      }
      footer={
        item ? (
          <>
            {showOpen ? (
              <Button variant="secondary" asChild>
                <Link href={item.href}>{OPEN_WORD[item.source] ?? 'Open'}</Link>
              </Button>
            ) : null}
            {markDone ? (
              <>
                {cta && cta.action !== 'open' ? <InternWorkCtaButton item={item} /> : null}
                <Button onClick={() => void complete()} disabled={completing}>
                  Mark done
                </Button>
              </>
            ) : (
              <InternWorkCtaButton item={item} primary />
            )}
          </>
        ) : null
      }
    >
      {item ? (
        <>
          <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-5 py-4 text-[13.5px]">
            {facts.map((f) => (
              <div key={f.k} className="contents">
                <dt className="text-ink-muted">{f.k}</dt>
                <dd className="min-w-0 text-ink">{f.v}</dd>
              </div>
            ))}
          </dl>
          {notes ? (
            <DrawerSection title="Notes">
              <p className="whitespace-pre-wrap text-[13.5px] text-ink-2">{notes}</p>
            </DrawerSection>
          ) : null}
          {key ? (
            <>
              {detail.data?.window ? (
                <DrawerWindow
                  itemKey={key}
                  title={item.title}
                  companyName={item.companyName}
                  window={detail.data.window}
                  canRequest={user?.role === 'intern' && item.kind !== 'done'}
                />
              ) : null}
              {item.kind !== 'done' ? <DrawerSessions itemKey={key} title={item.title} /> : null}
              <DrawerChecklist itemKey={key} />
              {detail.data ? <DrawerFiles files={detail.data.files} /> : null}
              {detail.data ? <DrawerActivity entries={detail.data.activity} /> : null}
            </>
          ) : null}
        </>
      ) : null}
    </SidePanel>
  );
}
