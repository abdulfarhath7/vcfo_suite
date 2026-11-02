'use client';

/**
 * NON-STATUTORY TASK — /app/<seat>/compliances/obligations/tasks/[id]. The
 * console's form of the live staff TaskDetailView (COMPLIANCE-MODEL.md 4.3):
 *
 *   head        end-date tile, title, client · activity, Non-statutory tag, the
 *               six-word status, urgency, visibility, Start · End · days to due,
 *               and the role's actions the route allows (`task.can`): Start, Submit
 *               for review (owner / lead), Approve and Send back (manager, admin or
 *               the named reviewer, from review), Edit (admin, manager)
 *   left        Checklist (tick, add, delete), Attachments (upload, deliverable,
 *               open by signed link, delete), Comments (internal for staff),
 *               Reminders (schedule, per-row overrides), Activity
 *   right       Progress (the five steps, stage, owner, reviewer, review note,
 *               Change stage with the stages the role may set), Details
 *
 * Every value and right comes from `GET /api/compliances/tasks/:id`, scoped in
 * its repository; writes go to the task routes through the live hooks.
 */
import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { isAdminOrManager } from '@/lib/auth';
import { STAGE_LABEL, type WorkflowStage } from '@/views/compliances/tasks/task-model';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, Icon, LeadAv, Panel, Select } from '../../ui';
import { dShort, initialsOf, plural } from '../today/model';
import { useTodayIso } from '../today/useToday';
import { ApiError, openTaskAttachment, useSetReminderDays, useTask, useTaskActions, type TaskDetailDto } from './obligations-data';
import { blockedLine, dueWords, hrefs, startWords, taskStageChoices, type StatusWord, type Urgency, type Visibility } from './obligations-model';
import { DTile, DetailHead, HistoryPanel, KV, KindTag, NotFound, PersonChip, RemindersPanel, SendBackForm, StepsPanel, UrgencyMark, VisMark, WordPill, stamp, useRun } from './obligations-shared';
import { EditTaskModal } from './task-modals';

export function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = decodeURIComponent(id ?? '');
  const { base } = useConsole();
  const q = useTask(taskId);
  useCrumbs(['Obligations', q.data?.title ?? 'Task']);
  if (q.isPending)
    return (
      <div className="glass panel mx-p">
        <div className="sec-load">Loading the task…</div>
      </div>
    );
  if (q.isError || !q.data) {
    const missing = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    return (
      <NotFound
        title={missing ? 'This task is not in your clients' : 'Could not load the task'}
        sub={missing ? 'It belongs to a client outside your book, or it was removed.' : 'Please try again in a moment.'}
        href={hrefs(base).list('cat=ns')}
        link="Open obligations"
      />
    );
  }
  return <TaskBody task={q.data} />;
}

function TaskBody({ task }: { task: TaskDetailDto }) {
  const { base, go, me, openModal } = useConsole();
  const today = useTodayIso();
  const H = hrefs(base);
  const isManager = isAdminOrManager(me?.role);
  const acts = useTaskActions(task.id);
  const setDays = useSetReminderDays();
  const run = useRun();
  const [sendingBack, setSendingBack] = useState(false);

  const done = task.stage === 'completed';
  const na = task.stage === 'not-applicable';
  const inReview = task.stage === 'review';
  const busy = acts.stage.isPending || acts.review.isPending;
  const closed = done || na;

  const acts_ = (
    <>
      {task.can.changeStage && (task.stage === 'not-started' || task.stage === 'ready') ? (
        <Btn cls="sm" ico="step" disabled={busy} title="Move the task to In progress" onClick={() => void run(acts.stage.mutateAsync('in-progress'), 'Started')}>
          Start
        </Btn>
      ) : null}
      {isManager ? (
        <Btn
          cls="sm pri"
          ico="check"
          disabled={closed || busy}
          title={inReview ? 'Approve the work and close the task' : 'Close the task as completed'}
          onClick={() => void run(inReview ? acts.review.mutateAsync({ decision: 'approve' }) : acts.stage.mutateAsync('completed'), `Approved · ${task.title} is closed`)}
        >
          {done ? 'Approved' : 'Approve'}
        </Btn>
      ) : task.can.submit || inReview ? (
        <Btn
          cls="sm pri"
          ico="send"
          disabled={closed || inReview || !task.can.submit || busy}
          title={task.reviewer ? `${task.reviewer.name} reviews it next` : 'Send it for review'}
          onClick={() => void run(acts.stage.mutateAsync('review'), `Submitted for review${task.reviewer ? ` · ${task.reviewer.name} reviews it next` : ''}`)}
        >
          {inReview ? 'Submitted' : 'Submit for review'}
        </Btn>
      ) : null}
      {inReview && task.can.review ? (
        <Btn cls="sm" ico="back" disabled={busy} onClick={() => setSendingBack((v) => !v)}>
          Send back
        </Btn>
      ) : null}
      {task.can.edit ? (
        <Btn cls="sm" ico="notes" title="Change the name, dates, urgency, visibility, people, repeat or reminder days" onClick={() => openModal(<EditTaskModal task={task} />, { label: 'Edit task' })}>
          Edit
        </Btn>
      ) : null}
    </>
  );

  const line = done
    ? `Start ${dShort(task.startDate, today)} · End ${dShort(task.dueDate, today)} · Completed ${stamp(task.completedAt, today)}`
    : na
      ? `Start ${dShort(task.startDate, today)} · End ${dShort(task.dueDate, today)} · Not applicable`
      : `Start ${dShort(task.startDate, today)} · End ${dShort(task.dueDate, today)} · ${task.daysToStart > 0 ? startWords(task.daysToStart) : dueWords(task.daysToDue)}`;

  return (
    <>
      <div className="sec-h">
        <button type="button" className="link" onClick={() => go(H.list('cat=ns'))}>
          <Icon name="back" size={14} />
          Obligations
        </button>
      </div>
      <DetailHead
        tile={<DTile iso={task.dueDate} red={task.word === 'Overdue'} big />}
        title={task.title}
        sub={`${task.companyName} · ${task.activityName ?? 'Other activity'}${task.repeats !== 'one-time' ? ` · repeats ${task.repeats.replace('-', ' ')}` : ''}`}
        chips={
          <>
            <KindTag>Non-statutory</KindTag>
            <WordPill word={task.word as StatusWord} />
            <UrgencyMark urgency={task.urgency as Urgency} />
            <VisMark visibility={task.visibility as Visibility} />
          </>
        }
        line={<span className={task.word === 'Overdue' ? 'red' : ''}>{line}</span>}
        acts={acts_}
      >
        {sendingBack ? (
          <SendBackForm
            busy={acts.review.isPending}
            who={task.owner?.name}
            onCancel={() => setSendingBack(false)}
            onSend={(note) => void run(acts.review.mutateAsync({ decision: 'send-back', note }), `Sent back · ${task.owner?.name ?? 'the owner'} reworks it`).then((ok) => ok && setSendingBack(false))}
          />
        ) : null}
      </DetailHead>

      <div className="mx-row21 cob-cols">
        <div className="mx-col">
          <Checklist task={task} today={today} />
          <Attachments task={task} today={today} />
          <Comments task={task} today={today} />
          <RemindersPanel
            rows={task.reminders}
            days={task.remindBefore}
            canEdit={task.can.edit}
            saving={setDays.isPending}
            blocked={blockedLine(task.remindersBlockedBy ?? [])}
            today={today}
            onDays={(n) => void run(setDays.mutateAsync({ kind: 'task', id: task.id, notifyDays: n }), `First reminder ${n} day${n === 1 ? '' : 's'} before the end date`)}
            onRow={(key, patch) => void run(setDays.mutateAsync({ kind: 'task', id: task.id, rows: [{ key, ...patch }] }), 'Reminder changed')}
            onReset={() => void run(setDays.mutateAsync({ kind: 'task', id: task.id, reset: true }), 'Reminders reset to the default schedule')}
          />
          <HistoryPanel rows={task.history} today={today} />
        </div>
        <div className="mx-col">
          <StepsPanel steps={task.steps} stage={task.stageLabel} owner={task.owner} reviewer={task.reviewer} note={inReview || task.stage === 'rework' ? task.reviewNote : null} today={today}>
            {task.can.changeStage && !done ? (
              <KV k="Change stage" title="Move the task by hand; closing and Not applicable are for admin and manager">
                <Select<WorkflowStage>
                  label="Change stage"
                  cls="full"
                  value={task.stage}
                  onChange={(s) => {
                    if (s !== task.stage) void run(acts.stage.mutateAsync(s), `Stage changed · ${STAGE_LABEL[s]}`);
                  }}
                  options={taskStageChoices(task.stage, isManager).map((s): [WorkflowStage, string] => [s, STAGE_LABEL[s]])}
                />
              </KV>
            ) : null}
          </StepsPanel>
          <Panel title="Details" sub="From the activity master and the task itself">
            <div className="cob-kvs">
              <KV k="Activity">{task.activity ? `${task.activity.name} · ${task.activity.kind}` : 'Other (named by hand)'}</KV>
              {task.activity?.area ? <KV k="Area">{task.activity.area}</KV> : null}
              {task.activity?.dueRule ? <KV k="Due rule">{task.activity.dueRule}</KV> : null}
              {task.activity?.ownerRole ? <KV k="Usual owner">{`${task.activity.ownerRole} · reviewed by ${task.activity.reviewerRole}`}</KV> : null}
              <KV k="Repeats">{task.repeats === 'one-time' ? 'One-time' : task.repeats.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase())}</KV>
              <KV k="Remind before">{`${task.remindBefore} day${task.remindBefore === 1 ? '' : 's'}`}</KV>
              {task.deliverable ? (
                <KV k="Deliverable">
                  <button type="button" className="link" onClick={() => void openTaskAttachment(task.id, task.deliverable!.id)}>
                    <Icon name="doc" size={14} />
                    <span className="cf-ell">{task.deliverable.fileName}</span>
                  </button>
                </KV>
              ) : null}
              <KV k="Created">{`${stamp(task.createdAt, today)}${task.createdBy ? ` by ${task.createdBy.name}` : ''}`}</KV>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ================================================================ checklist */

function Checklist({ task, today }: { task: TaskDetailDto; today: string }) {
  const acts = useTaskActions(task.id);
  const run = useRun();
  const [label, setLabel] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const done = task.checklistItems.filter((c) => c.done).length;
  return (
    <Panel title="Checklist" sub={task.checklistItems.length ? `${done} of ${task.checklistItems.length} ticked` : 'No items yet'}>
      {task.checklistItems.length ? (
        <div className="cob-lis">
          {task.checklistItems.map((c) => (
            <div key={c.id} className="cob-li">
              <label className={'mx-ck' + (task.can.tick ? '' : ' ro')}>
                <input type="checkbox" checked={c.done} disabled={!task.can.tick || acts.tick.isPending} aria-label={c.label} onChange={(e) => void run(acts.tick.mutateAsync({ itemId: c.id, done: e.target.checked }), e.target.checked ? `Ticked · ${c.label}` : `Unticked · ${c.label}`)} />
                <span>{c.label}</span>
              </label>
              <span className="sp" />
              {c.done ? <span className="small cob-by">{[c.doneBy?.name, c.doneAt ? stamp(c.doneAt, today) : null].filter(Boolean).join(' · ')}</span> : null}
              {task.can.edit ? (
                removing === c.id ? (
                  <span className="cob-confirm">
                    <span className="small">Delete it?</span>
                    <Btn cls="sm danger" disabled={acts.removeItem.isPending} onClick={() => void run(acts.removeItem.mutateAsync(c.id), `Item deleted · ${c.label}`).then(() => setRemoving(null))}>
                      Delete
                    </Btn>
                    <Btn cls="sm" onClick={() => setRemoving(null)}>
                      Cancel
                    </Btn>
                  </span>
                ) : (
                  <button type="button" className="ib sm x" aria-label={`Delete ${c.label}`} title="Delete this item" onClick={() => setRemoving(c.id)}>
                    <Icon name="x" />
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {task.can.tick ? (
        <form
          className="mx-addrow cob-add"
          onSubmit={(e) => {
            e.preventDefault();
            const l = label.trim();
            if (!l) return;
            void run(acts.addItem.mutateAsync(l), `Item added · ${l}`).then((ok) => ok && setLabel(''));
          }}
        >
          <input className="mx-in grow" aria-label="New checklist item" placeholder="Add an item" maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Btn cls="sm" ico="check" type="submit" disabled={!label.trim() || acts.addItem.isPending}>
            Add
          </Btn>
        </form>
      ) : null}
    </Panel>
  );
}

/* ================================================================ attachments */

function Attachments({ task, today }: { task: TaskDetailDto; today: string }) {
  const { me, toast } = useConsole();
  const acts = useTaskActions(task.id);
  const run = useRun();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deliverable, setDeliverable] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast('The file is larger than 15 MB');
      return;
    }
    await run(acts.upload.mutateAsync({ file, deliverable }), `Uploaded · ${file.name}${deliverable ? ' · marked as the deliverable' : ''}`, 'Could not upload the file');
    if (fileRef.current) fileRef.current.value = '';
    setDeliverable(false);
  };
  const open = (id: string) => void openTaskAttachment(task.id, id).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Could not open the file'));
  return (
    <Panel
      title="Attachments"
      sub={task.attachments.length ? `${plural(task.attachments.length, 'file')} · open in a new tab` : 'No files yet'}
      act={
        task.can.upload ? (
          <>
            <label className="mx-ck small" title="The file a done task delivers to the client (F-2)">
              <input type="checkbox" checked={deliverable} onChange={(e) => setDeliverable(e.target.checked)} />
              <span>Deliverable</span>
            </label>
            <input ref={fileRef} type="file" hidden aria-label="Choose a file" onChange={(e) => void upload(e.target.files?.[0])} />
            <Btn cls="sm" ico="up" disabled={acts.upload.isPending} onClick={() => fileRef.current?.click()}>
              {acts.upload.isPending ? 'Uploading…' : 'Upload'}
            </Btn>
          </>
        ) : undefined
      }
    >
      {task.attachments.length ? (
        <div className="mx-files">
          {task.attachments.map((f) => (
            <div key={f.id} className="mx-file cob-file">
              <button type="button" className="cob-fileb" title={`${f.fileName} · open`} onClick={() => open(f.id)}>
                <Icon name="doc" size={16} />
                <span className="mx-dt">
                  <b className="cf-ell">{f.fileName}</b>
                  <span className="cf-ell">{[f.uploadedBy?.name, stamp(f.uploadedAt, today), f.byClient ? 'From the client' : null, f.sizeBytes ? sizeOf(f.sizeBytes) : null].filter(Boolean).join(' · ')}</span>
                </span>
                {f.deliverable ? (
                  <span className="pill ok sm" title="The file this task delivers">
                    Deliverable
                  </span>
                ) : null}
                <Icon name="ext" size={14} />
              </button>
              {task.can.edit || (me?.id && f.uploadedBy?.id === me.id) ? (
                removing === f.id ? (
                  <span className="cob-confirm">
                    <Btn cls="sm danger" disabled={acts.removeFile.isPending} onClick={() => void run(acts.removeFile.mutateAsync(f.id), `File deleted · ${f.fileName}`).then(() => setRemoving(null))}>
                      Delete
                    </Btn>
                    <Btn cls="sm" onClick={() => setRemoving(null)}>
                      Cancel
                    </Btn>
                  </span>
                ) : (
                  <button type="button" className="ib sm x" aria-label={`Delete ${f.fileName}`} title="Delete this file" onClick={() => setRemoving(f.id)}>
                    <Icon name="x" />
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

const sizeOf = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/* ================================================================ comments */

function Comments({ task, today }: { task: TaskDetailDto; today: string }) {
  const acts = useTaskActions(task.id);
  const run = useRun();
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  return (
    <Panel title="Comments" sub={task.comments.length ? `${plural(task.comments.length, 'comment')}${task.visibility === 'firm' ? ' · the client cannot see this task' : ' · the client sees everything not marked internal'}` : 'No comments yet'}>
      {task.comments.length ? (
        <div className="cob-cmts">
          {task.comments.map((c) => (
            <div key={c.id} className="cob-cmt">
              <LeadAv id={c.author?.id ?? 'vcfo'} name={c.author?.name ?? 'VCFO'} initials={initialsOf(c.author?.name ?? 'VCFO')} sm />
              <span className="mx-dt">
                <b>
                  {c.author?.name ?? 'VCFO'} <span className="small">{`${c.authorRole} · ${stamp(c.at, today)}`}</span>
                  {c.internal ? (
                    <span className="cob-int" title="Only the firm sees this comment">
                      <Icon name="lock" size={10} />
                      internal
                    </span>
                  ) : null}
                </b>
                <span className="cob-cmtb">{c.body}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {task.can.comment ? (
        <form
          className="cob-form cob-cmtf"
          onSubmit={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            void run(acts.comment.mutateAsync({ body, internal }), internal ? 'Comment added · only the firm sees it' : task.visibility === 'firm' ? 'Comment added' : 'Comment added · the client sees it').then((ok) => ok && setDraft(''));
          }}
        >
          <textarea className="mx-in grow" rows={2} aria-label="Comment" placeholder="Add a comment" maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <label className="mx-ck small" title="An internal comment never reaches the client">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            <span>Internal</span>
          </label>
          <Btn cls="sm pri" ico="send" type="submit" disabled={!draft.trim() || acts.comment.isPending}>
            Post
          </Btn>
        </form>
      ) : null}
    </Panel>
  );
}

/** Where a reviewer or owner is named in a sentence. */
export const who = (p: { name: string } | null | undefined, fallback: string) => p?.name ?? fallback;
export { PersonChip as TaskPerson };
