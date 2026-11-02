'use client';

/**
 * Compliances · one non-statutory task, client view (COMPLIANCE-MODEL.md 4.3, K-1, K-2, D-4).
 * The header card shows Start, End, Urgency and the status; its main action is Upload. The left
 * column shows the Checklist (read only for the client), Attachments (the client uploads),
 * Comments (the client comments; no internal comments reach this page), Reminders (no
 * escalations) and Activity. The right column shows the progress steps, the stage and the owner.
 * Data: GET /api/compliances/tasks/:id. A firm-only task, or a task of another client, answers
 * 404 and the page says it is not shared with the client.
 */
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileBadge, fileType } from '@/components/ui/file-badge';
import { StepMark } from '@/components/ui/step-track';
import { SkeletonRows } from '@/components/ui/empty-state';
import { Tag } from '@/components/ui/spectrum-chip';
import { fmtDM, todayIso } from '@/lib/client-portal/compliances';
import { usePortal, usePortalCrumbs } from '../../PortalProvider';
import { Avatar } from '../incorporation/spectrum';
import { Empty, GoLink, Island, SCard } from './spectrum';
import { OBLIGATIONS_BASE } from './ObligationsPage';
import { ActivityCard, DetailCols, DetailHeader, ProgressCard, RemindersCard, dueText, whenText } from './detail-parts';
import { UrgencyPill } from './task-marks';
import { STAGE_LABEL, taskWord } from './tasks';
import { attachmentUrl, useClientTask, useTaskComment, useTaskUpload, type TaskDetail } from './task-api';
import '../../css/compliances-board.css';

export function CompliancesTask({ id }: { id: string }) {
  const { after } = usePortal();
  const q = useClientTask(id, after);
  usePortalCrumbs(['Compliances', 'Obligations', q.data?.task.name ?? 'Task']);
  const back = (
    <GoLink href={OBLIGATIONS_BASE} className="text-[13px] font-medium text-brand-text hover:underline">
      All obligations
    </GoLink>
  );
  const notFound = (q.error as { status?: number } | null)?.status === 404;

  let body: React.ReactNode;
  if (!after)
    body = (
      <SCard title="Task">
        <Empty action={back}>Starts after incorporation</Empty>
      </SCard>
    );
  else if (q.isLoading)
    body = (
      <div aria-busy="true" aria-label="Loading the task">
        <SkeletonRows rows={6} />
      </div>
    );
  else if (notFound)
    body = (
      <SCard title="Task">
        <Empty action={back}>This task is not shared with you</Empty>
      </SCard>
    );
  else if (q.isError || !q.data)
    body = (
      <SCard title="Task">
        <Empty
          action={
            <Button size="sm" variant="secondary" onClick={() => void q.refetch()}>
              Try again
            </Button>
          }
        >
          Could not load the task
        </Empty>
      </SCard>
    );
  else body = <TaskRecord d={q.data} />;

  return (
    <div className="cp-compliances">
      <div className="cp-comp-root page">
        <Island className="grid gap-5">{body}</Island>
      </div>
    </div>
  );
}

function TaskRecord({ d }: { d: TaskDetail }) {
  const { toast } = usePortal();
  const today = todayIso();
  const t = d.task;
  const done = t.stage === 'completed';
  const word = taskWord(t, today);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useTaskUpload(t.id);
  const comment = useTaskComment(t.id);
  const [draft, setDraft] = useState('');
  const canUpload = d.can.upload && !done;

  const pick = () => fileRef.current?.click();
  const onFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    upload.mutate(files, {
      onSuccess: ({ done: n, failed }) => {
        if (n) toast(`${n === 1 ? '1 file' : `${n} files`} uploaded · SBC reviews it next`);
        if (failed.length) toast(`Could not upload ${failed.join(', ')}`);
      },
      onError: () => toast('Could not upload. Try again.'),
    });
  };
  const open = (fileId: string) => {
    attachmentUrl(t.id, fileId)
      .then((url) => window.open(url, '_blank', 'noopener'))
      .catch(() => toast('Could not open the file'));
  };

  const uploadButton = (
    <Button disabled={!canUpload || upload.isPending} onClick={pick}>
      <Upload size={16} strokeWidth={1.6} aria-hidden />
      {upload.isPending ? 'Uploading' : 'Upload'}
    </Button>
  );

  return (
    <>
      <input ref={fileRef} type="file" multiple className="hidden" aria-hidden tabIndex={-1} onChange={(e) => onFiles(e.target.files)} />
      <DetailHeader
        date={t.endDate}
        today={today}
        done={done}
        title={t.name}
        marks={
          <>
            <UrgencyPill urgency={t.urgency} />
            <Tag>Non-statutory</Tag>
          </>
        }
        word={word}
        due={
          <>
            Start {fmtDM(t.startDate)} · End {fmtDM(t.endDate)}
            {done ? '' : ` · ${dueText(t.endDate, today, false)}`}
          </>
        }
        late={word === 'Overdue'}
        action={uploadButton}
      />
      <DetailCols
        left={
          <>
            <SCard title="Checklist" meta={d.checklist.length ? `${d.checklist.filter((c) => c.done).length} of ${d.checklist.length}` : undefined} flush>
              {d.checklist.length ? (
                <ul>
                  {d.checklist.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5 first:border-t-0 md:px-5">
                      <StepMark state={c.done ? 'done' : 'next'} size={18} label={c.done ? 'Done' : 'Not done'} />
                      <span className={cn('min-w-0 flex-1 text-[14px]', c.done ? 'text-ink' : 'text-ink-2')}>{c.label}</span>
                      {c.done && c.at ? <span className="flex-none text-[12.5px] text-ink-muted">{fmtDM(c.at)}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty />
              )}
            </SCard>

            <SCard
              title="Attachments"
              meta={d.attachments.length || undefined}
              flush
              right={
                canUpload ? (
                  <Button size="sm" variant="secondary" disabled={upload.isPending} onClick={pick}>
                    <Upload size={14} strokeWidth={1.6} aria-hidden />
                    Upload
                  </Button>
                ) : undefined
              }
            >
              {d.attachments.length ? (
                <ul>
                  {d.attachments.map((f) => (
                    <li key={f.id} className="border-t border-line-soft first:border-t-0">
                      <button type="button" onClick={() => open(f.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken md:px-5" aria-label={`Open ${f.fileName}`}>
                        <FileBadge type={fileType(f.fileName)} />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-[14px] font-medium text-ink">{f.fileName}</b>
                          <span className="block truncate text-[12.5px] text-ink-muted">{[f.by, whenText(f.at)].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty />
              )}
            </SCard>

            <SCard title="Comments" meta={d.comments.length || undefined} flush>
              {d.comments.length ? (
                <ul>
                  {d.comments.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 border-b border-line-soft px-4 py-3 md:px-5">
                      <Avatar name={c.by} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
                          <b className="font-medium text-ink">{c.by}</b>
                          <span className="text-ink-muted">{whenText(c.at)}</span>
                        </span>
                        <span className="mt-0.5 block whitespace-pre-wrap text-[14px] text-ink-2">{c.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {d.can.comment ? (
                <form
                  className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = draft.trim();
                    if (!text || comment.isPending) return;
                    comment.mutate(text, {
                      onSuccess: () => {
                        setDraft('');
                        toast('Comment added · SBC is told');
                      },
                      onError: () => toast('Could not add the comment. Try again.'),
                    });
                  }}
                >
                  <Input aria-label="Comment" value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment" className="min-w-[200px] flex-1" />
                  <Button size="sm" type="submit" disabled={!draft.trim() || comment.isPending}>
                    Comment
                  </Button>
                </form>
              ) : null}
            </SCard>

            <RemindersCard rows={d.reminders} />
            <ActivityCard rows={d.history} />
          </>
        }
        right={<ProgressCard steps={d.steps} stage={d.stageLabel ?? STAGE_LABEL[t.stage]} owner={t.ownerName} />}
      />
    </>
  );
}
