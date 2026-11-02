'use client';

/**
 * One non-statutory task, full screen (COMPLIANCE-MODEL.md 4.3, K-1, K-2, D-4), in
 * the portal's walkthrough frame (`.wiz`: bar, rail, card) — the pattern every
 * opened record uses. Data: GET /api/compliances/tasks/:id through Farhath's
 * `useClientTask`; the hook already drops internal comments, escalation
 * reminders and the reviewer. A 404 (a firm-only task, or another client's)
 * says the task is not shared with the client.
 *
 *  - bar: Back, the task name and its dates, Ask VCFO;
 *  - rail: Progress (steps with who, when and evidence), the stage, the owner;
 *  - card: header (end-date tile, name, urgency, "Non-statutory", status word,
 *    Start · End · Due in N days, Upload when `can.upload`), then Checklist (read
 *    only), Attachments (open the signed URL; Upload), Comments (post when
 *    `can.comment`), Reminders (no escalations) and Activity.
 */
import { useRef, useState } from 'react';
import { STAGE_LABEL, taskWord } from '@/components/client-portal/pages/compliances/tasks';
import { attachmentUrl, useClientTask, useTaskComment, useTaskUpload, type TaskDetail } from '@/components/client-portal/pages/compliances/task-api';
import { usePortal } from '../../runtime';
import { fmt, fmtY, todayIso } from '../../dates';
import { Btn, DateTile, Icon, Pill } from '../../ui';
import { dueWords, isNotFound, whenText } from './model';
import { ActivityList, Av, Block, EmptyLine, ReminderList, StepList, UrgencyMark, WordPill } from './bits';

export function TaskView({ id }: { id: string }) {
  const q = useClientTask(id);
  const d = q.data;
  const today = todayIso();
  const t = d?.task;
  const done = t?.stage === 'completed';
  const sub = t ? `Non-statutory · Start ${fmt(t.startDate)} · End ${fmt(t.endDate)}${done ? '' : ` · ${dueWords(t.endDate, today, false)}`}` : 'Non-statutory task';

  let body: React.ReactNode;
  if (q.isPending) body = <div className="sec-load">Loading the task…</div>;
  else if (isNotFound(q.error))
    body = (
      <>
        <div className="kick">
          <Pill kind="mut">Non-statutory</Pill>
        </div>
        <h2>This task is not shared with you</h2>
        <p className="sx">It belongs to SBC’s internal work, or to another company. Ask your project lead if you expected to see it here.</p>
      </>
    );
  else if (q.isError || !d)
    body = (
      <>
        <h2>Could not load the task</h2>
        <p className="sx">{q.error instanceof Error && q.error.message !== 'not_found' ? q.error.message : 'Something went wrong on the way.'}</p>
        <div className="wz-foot">
          <Btn cls="pri" onClick={() => void q.refetch()}>
            Try again
          </Btn>
        </div>
      </>
    );
  else body = <TaskCard d={d} today={today} />;

  return (
    <>
      <Bar title={t?.name ?? 'Task'} sub={sub} ask={t ? `What is the task “${t.name}” and what does SBC need from me?` : 'What are non-statutory tasks?'} />
      <div className="wz-in" style={d ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {d ? <Rail d={d} /> : null}
        <section className="glass wz-card tv-card fadein">{body}</section>
      </div>
    </>
  );
}

function Bar({ title, sub, ask }: { title: string; sub: string; ask: string }) {
  const { closeWizard, openChat } = usePortal();
  return (
    <div className="wz-bar">
      <button type="button" className="btn" onClick={closeWizard}>
        <Icon name="back" />
        Back
      </button>
      <div className="tt">
        <b id="wz-t">{title}</b>
        <span>{sub}</span>
      </div>
      <span className="sp" />
      <button type="button" className="btn" onClick={() => openChat(ask)}>
        <Icon name="chat" />
        Ask VCFO
      </button>
    </div>
  );
}

/** Progress with the stage and the owner (no reviewer, K-2). */
function Rail({ d }: { d: TaskDetail }) {
  const doneN = d.steps.filter((s) => s.state === 'done').length;
  const owner = d.task.ownerName;
  return (
    <nav className="glass wz-rail tv-rail" aria-label="Progress">
      <div className="eyebrow" style={{ padding: '4px 10px 4px' }}>
        Progress{d.steps.length ? ` · ${doneN} of ${d.steps.length}` : ''}
      </div>
      <StepList steps={d.steps} />
      <div className="tv-kv">
        <span className="k">Stage</span>
        <b>{d.stageLabel ?? STAGE_LABEL[d.task.stage]}</b>
      </div>
      <div className="tv-kv">
        <span className="k">With SBC</span>
        {owner ? (
          <b>
            <Av name={owner} />
            <span>{owner}</span>
          </b>
        ) : (
          <b>SBC</b>
        )}
      </div>
    </nav>
  );
}

function TaskCard({ d, today }: { d: TaskDetail; today: string }) {
  const { toast } = usePortal();
  const t = d.task;
  const done = t.stage === 'completed';
  const word = d.word ?? taskWord(t, today);
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
        if (n) toast(`${n === 1 ? '1 file' : `${n} files`} uploaded · SBC looks at it next`);
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
  const send = () => {
    const text = draft.trim();
    if (!text || comment.isPending) return;
    comment.mutate(text, {
      onSuccess: () => {
        setDraft('');
        toast('Comment added · SBC is told');
      },
      onError: () => toast('Could not add the comment. Try again.'),
    });
  };

  const ticked = d.checklist.filter((c) => c.done).length;
  const tileSt = done ? 'ok' : word === 'Overdue' ? 'over' : word === 'Due soon' || word === 'Waiting' ? 'due' : null;

  return (
    <>
      <input ref={fileRef} type="file" multiple style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} onChange={(e) => onFiles(e.target.files)} />
      <div className="tv-head">
        <DateTile iso={t.endDate} st={tileSt} />
        <div className="tt">
          <div className="kick">
            <UrgencyMark urgency={t.urgency} />
            <Pill kind="mut">Non-statutory</Pill>
            <WordPill word={word} />
          </div>
          <h2 id="wz-h">{t.name}</h2>
          {t.activityName && t.activityName !== t.name ? <div className="small">{t.activityName}</div> : null}
          <div className="fc-grid">
            <div>
              <span>START</span>
              <b>{fmtY(t.startDate)}</b>
            </div>
            <div>
              <span>END</span>
              <b style={word === 'Overdue' ? { color: 'var(--over-ink)' } : undefined}>{fmtY(t.endDate)}</b>
            </div>
            <div>
              <span>{done ? 'DONE ON' : 'WHEN'}</span>
              <b>{done ? (t.completedOn ? fmtY(t.completedOn) : 'Done') : dueWords(t.endDate, today, false)}</b>
            </div>
            <div>
              <span>WITH</span>
              <b>{t.ownerName ? `${t.ownerName} · SBC` : 'SBC'}</b>
            </div>
          </div>
        </div>
        {canUpload ? (
          <Btn cls="pri" ico="up" disabled={upload.isPending} onClick={pick}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Btn>
        ) : null}
      </div>

      <Block title="Checklist" count={d.checklist.length ? `${ticked} of ${d.checklist.length}` : undefined}>
        {d.checklist.length ? (
          d.checklist.map((c) => (
            <div key={c.id} className={'tv-row' + (c.done ? ' done' : '')}>
              <span className={'nd ' + (c.done ? 'done' : 'up')}>{c.done ? <Icon name="check" /> : ''}</span>
              <div style={{ minWidth: 0 }}>
                <b>{c.label}</b>
                {c.done && (c.by || c.at) ? <span className="m">{[c.by, c.at ? whenText(c.at) : ''].filter(Boolean).join(' · ')}</span> : null}
              </div>
              <span className="r">{c.done ? 'Done' : 'Not yet'}</span>
            </div>
          ))
        ) : (
          <EmptyLine>SBC has not broken this task into steps.</EmptyLine>
        )}
      </Block>

      <Block
        title="Attachments"
        count={d.attachments.length || undefined}
        right={
          canUpload ? (
            <Btn cls="sm" ico="up" disabled={upload.isPending} onClick={pick}>
              Upload
            </Btn>
          ) : undefined
        }
      >
        {d.attachments.length ? (
          d.attachments.map((f) => (
            <button key={f.id} type="button" className="tv-row" onClick={() => open(f.id)} aria-label={`Open ${f.fileName}`}>
              <Icon name="doc" />
              <div style={{ minWidth: 0 }}>
                <b>{f.fileName}</b>
                <span className="m">{[f.by, whenText(f.at)].filter(Boolean).join(' · ')}</span>
              </div>
              <Icon name="ext" />
            </button>
          ))
        ) : (
          <EmptyLine>{canUpload ? 'No files yet. Upload what SBC asked for and it shows here.' : 'No files on this task.'}</EmptyLine>
        )}
      </Block>

      <Block title="Comments" count={d.comments.length || undefined}>
        {d.comments.length ? (
          d.comments.map((c) => (
            <div key={c.id} className="tv-cm">
              <Av name={c.by} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="who">
                  <b>{c.by}</b>
                  <span>{whenText(c.at)}</span>
                </div>
                <p>{c.text}</p>
              </div>
            </div>
          ))
        ) : (
          <EmptyLine>No comments yet.</EmptyLine>
        )}
        {d.can.comment ? (
          <form
            className="tv-form"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="mf">
              <span className="mf-l" style={{ display: 'none' }}>
                Comment
              </span>
              <input aria-label="Comment" value={draft} maxLength={2000} placeholder="Add a comment for SBC" onChange={(e) => setDraft(e.target.value)} />
            </label>
            <Btn type="submit" cls="pri" ico="send" disabled={!draft.trim() || comment.isPending}>
              Comment
            </Btn>
          </form>
        ) : null}
      </Block>

      <Block title="Reminders" count={d.reminders.length || undefined}>
        <ReminderList rows={d.reminders} />
      </Block>

      <Block title="Activity" count={d.history.length || undefined}>
        <ActivityList rows={d.history} />
      </Block>
    </>
  );
}
