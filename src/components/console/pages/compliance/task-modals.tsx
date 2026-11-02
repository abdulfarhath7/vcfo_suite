'use client';

/**
 * The console's "New task" (S-4, S-5) and "Edit task" dialogs for non-statutory
 * tasks, on the live form's pure checks (`new-task-form.ts`) and routes:
 * activities from `GET /api/compliances/activities?group=non-statutory`, the
 * picked client's people and defaults from `GET /api/compliances/tasks/defaults`,
 * Save → `POST /api/compliances/tasks`; Edit → `PATCH … { action: 'edit' }` with
 * only the changed fields. The dialog checks the fields and shows errors after
 * the first save; Enter saves; Escape closes (the console modal host).
 */
import { useEffect, useMemo, useState } from 'react';
import { OTHER_ACTIVITY, newTaskErrors, type NewTaskErrors } from '@/components/compliances/new-task-form';
import { NOTIFY_BY_REPEATS, REPEATS, type TaskRepeats } from '@/views/compliances/tasks/task-model';
import { useConsole } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn } from '../../ui';
import { errText, useActivities, useCreateTask, useTaskActions, useTaskDefaults, type TaskDetailDto, type TaskEditBody } from './obligations-data';
import { URGENCIES, type Urgency, type Visibility } from './obligations-model';

/** The activity frequency word to the form's repeat value (live `REPEAT_OF`). */
const REPEAT_OF: Record<string, TaskRepeats> = { Weekly: 'weekly', 'Bi-weekly': 'bi-weekly', Monthly: 'monthly', Quarterly: 'quarterly', Yearly: 'yearly' };
const VIS_OPTIONS: Array<[Visibility, string]> = [
  ['firm', 'Firm only'],
  ['client', 'Client only'],
  ['both', 'Both'],
];

interface Form {
  act: string;
  name: string;
  client: string;
  start: string;
  end: string;
  urgency: Urgency;
  vis: Visibility;
  owner: string;
  reviewer: string;
  repeats: TaskRepeats;
  notify: string;
}

function F({ label, err, wide, children }: { label: string; err?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={'mx-f' + (err ? ' bad' : '') + (wide ? ' cob-wide' : '')}>
      <span className="mx-fl">{label}</span>
      {children}
      {err ? <span className="mx-fh red">{err}</span> : null}
    </label>
  );
}

const people = (xs: Array<{ id: string; name: string }>, cur?: { id: string; name: string } | null) => (cur && !xs.some((p) => p.id === cur.id) ? [cur, ...xs] : xs);

export function NewTaskModal({
  clients,
  defaultClient,
  today,
  onCreated,
}: {
  clients: Array<{ id: string; name: string }>;
  defaultClient?: string;
  today: string;
  onCreated: (task: TaskDetailDto) => void;
}) {
  const { closeModal, toast } = useConsole();
  const [f, setF] = useState<Form>({
    act: '',
    name: '',
    client: defaultClient && clients.some((c) => c.id === defaultClient) ? defaultClient : clients.length === 1 ? clients[0]!.id : '',
    start: today,
    end: '',
    urgency: 'Medium',
    vis: 'both',
    owner: '',
    reviewer: '',
    repeats: 'one-time',
    notify: '5',
  });
  const [tried, setTried] = useState(false);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const activities = useActivities('non-statutory');
  const defaults = useTaskDefaults(f.client || null, Boolean(f.client));
  const create = useCreateTask();

  // The picked client's lead and manager become the owner and reviewer once they load (unless already picked).
  useEffect(() => {
    const d = defaults.data;
    if (!d) return;
    setF((x) => ({ ...x, owner: x.owner || d.owner?.id || '', reviewer: x.reviewer || d.reviewer?.id || '' }));
  }, [defaults.data]);

  const options = useMemo(() => {
    const byId = new Map((defaults.data?.activities ?? []).map((a) => [a.id, a]));
    return (activities.data ?? [])
      .filter((a) => a.group === 'non-statutory')
      .map((a) => {
        const d = byId.get(a.id);
        return { id: a.id, name: a.name, kind: a.kind, repeats: d?.repeats ?? REPEAT_OF[a.frequency] ?? 'one-time', notifyDays: d?.notifyDays ?? a.notifyDays, visibility: d?.visibility ?? a.visibility };
      });
  }, [activities.data, defaults.data?.activities]);
  const plain = options.filter((a) => a.kind === 'Non-statutory');
  const other = options.filter((a) => a.kind !== 'Non-statutory');

  const pickAct = (id: string) => {
    const a = options.find((x) => x.id === id);
    if (!a) return set({ act: id, repeats: 'one-time' });
    set({ act: id, vis: a.visibility, repeats: a.repeats, notify: String(a.notifyDays ?? NOTIFY_BY_REPEATS[a.repeats]) });
  };
  const pickClient = (id: string) => set({ client: id, owner: '', reviewer: '' });

  const err: NewTaskErrors = newTaskErrors(f);
  const ok = !Object.values(err).some(Boolean);
  const e = (k: keyof NewTaskErrors) => (tried ? err[k] : undefined);

  const save = async () => {
    setTried(true);
    if (!ok || create.isPending) return;
    const a = options.find((x) => x.id === f.act);
    try {
      const task = await create.mutateAsync({
        engagementId: f.client,
        activityId: f.act === OTHER_ACTIVITY ? null : f.act,
        name: (f.act === OTHER_ACTIVITY ? f.name.trim() : f.name.trim() || a?.name || '') || undefined,
        startDate: f.start,
        dueDate: f.end,
        urgency: f.urgency,
        visibility: f.vis,
        ownerId: f.owner,
        reviewerId: f.reviewer || null,
        repeats: f.repeats,
        remindBefore: Number(f.notify),
      });
      toast(`Task created · ${task.title} · ${task.companyName}`);
      closeModal();
      onCreated(task);
    } catch (x) {
      toast(errText(x, 'Could not create the task'));
    }
  };

  const owners = people(defaults.data?.owners ?? []);
  const reviewers = people(defaults.data?.reviewers ?? []);
  return (
    <ModalBody
      eyebrow="Non-statutory"
      title="New task"
      sub="A piece of internal or client work with its own owner, dates and reminders. Statutory filings come from the register."
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <Btn cls="pri" ico="check" disabled={create.isPending} onClick={() => void save()}>
            {create.isPending ? 'Creating…' : 'Create task'}
          </Btn>
        </>
      }
    >
      <form
        className="mx-form2 cob-form2"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void save();
        }}
      >
        <F label="Activity" err={e('act')} wide>
          <select className="lsel full" aria-label="Activity" value={f.act} onChange={(ev) => pickAct(ev.target.value)}>
            <option value="">{activities.isPending ? 'Loading the activities…' : 'Pick an activity'}</option>
            {plain.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {other.length ? (
              <optgroup label="Configurable">
                {other.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value={OTHER_ACTIVITY}>Other…</option>
          </select>
        </F>
        <F label="Task name" err={e('name')} wide>
          <input className="mx-in" aria-label="Task name" value={f.name} maxLength={120} placeholder={f.act === OTHER_ACTIVITY ? 'Board pack for the Q3 meeting' : options.find((a) => a.id === f.act)?.name ?? 'Optional; the activity name otherwise'} onChange={(ev) => set({ name: ev.target.value })} />
        </F>
        <F label="Client" err={e('client')} wide>
          <select className="lsel full" aria-label="Client" value={f.client} onChange={(ev) => pickClient(ev.target.value)}>
            <option value="">Pick a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Start date" err={e('start')}>
          <input className="mx-in" type="date" aria-label="Start date" value={f.start} onChange={(ev) => set({ start: ev.target.value })} />
        </F>
        <F label="End date" err={e('end')}>
          <input className="mx-in" type="date" aria-label="End date" min={f.start || undefined} value={f.end} onChange={(ev) => set({ end: ev.target.value })} />
        </F>
        <F label="Urgency">
          <select className="lsel full" aria-label="Urgency" value={f.urgency} onChange={(ev) => set({ urgency: ev.target.value as Urgency })}>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </F>
        <F label="Visible to">
          <select className="lsel full" aria-label="Visible to" value={f.vis} onChange={(ev) => set({ vis: ev.target.value as Visibility })}>
            {VIS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </F>
        <F label="Owner" err={e('owner')}>
          <select className="lsel full" aria-label="Owner" value={f.owner} disabled={!f.client} onChange={(ev) => set({ owner: ev.target.value })}>
            <option value="">{!f.client ? 'Pick a client first' : defaults.isPending ? 'Loading the team…' : 'Pick an owner'}</option>
            {owners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Reviewer">
          <select className="lsel full" aria-label="Reviewer" value={f.reviewer} disabled={!f.client} onChange={(ev) => set({ reviewer: ev.target.value })}>
            <option value="">No reviewer</option>
            {reviewers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Repeats">
          <select className="lsel full" aria-label="Repeats" value={f.repeats} onChange={(ev) => set({ repeats: ev.target.value as TaskRepeats })}>
            {REPEATS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </F>
        <F label="Remind before (days)" err={e('notify')}>
          <input className="mx-in" type="number" min={0} max={90} inputMode="numeric" aria-label="Remind before (days)" value={f.notify} onChange={(ev) => set({ notify: ev.target.value })} />
        </F>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </ModalBody>
  );
}

/* ================================================================ edit */

/** Admin, super admin and manager change a task after creation; only the changed fields are sent. */
export function EditTaskModal({ task }: { task: TaskDetailDto }) {
  const { closeModal, toast } = useConsole();
  const acts = useTaskActions(task.id);
  const defaults = useTaskDefaults(task.engagementId);
  const [f, setF] = useState({
    name: task.name,
    start: task.startDate,
    end: task.dueDate,
    urgency: task.urgency as Urgency,
    vis: task.visibility as Visibility,
    owner: task.owner?.id ?? '',
    reviewer: task.reviewer?.id ?? '',
    repeats: task.repeats,
    notify: String(task.remindBefore),
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const n = Number(f.notify);
  const err = {
    name: !f.name.trim() ? 'Give the task a name' : undefined,
    end: !f.end ? 'Pick an end date' : f.start && f.end < f.start ? 'End on or after the start' : undefined,
    start: !f.start ? 'Pick a start date' : undefined,
    notify: f.notify.trim() === '' || !Number.isInteger(n) || n < 0 || n > 90 ? 'Use 0 to 90 days' : undefined,
  };
  const ok = !Object.values(err).some(Boolean);
  const body: TaskEditBody = {};
  if (f.name.trim() !== task.name) body.name = f.name.trim();
  if (f.start !== task.startDate) body.startDate = f.start;
  if (f.end !== task.dueDate) body.dueDate = f.end;
  if (f.urgency !== task.urgency) body.urgency = f.urgency;
  if (f.vis !== task.visibility) body.visibility = f.vis;
  if (f.owner !== (task.owner?.id ?? '')) body.ownerId = f.owner || null;
  if (f.reviewer !== (task.reviewer?.id ?? '')) body.reviewerId = f.reviewer || null;
  if (f.repeats !== task.repeats) body.repeats = f.repeats;
  if (n !== task.remindBefore) body.remindBefore = n;
  const changed = Object.keys(body).length > 0;
  const save = async () => {
    if (!ok || !changed || acts.edit.isPending) return;
    try {
      await acts.edit.mutateAsync(body);
      toast(`Task saved · ${task.title}`);
      closeModal();
    } catch (x) {
      toast(errText(x, 'Could not save the task'));
    }
  };
  const owners = people(defaults.data?.owners ?? [], task.owner);
  const reviewers = people(defaults.data?.reviewers ?? [], task.reviewer);
  return (
    <ModalBody
      eyebrow={task.companyName}
      title="Edit task"
      sub={task.activityName ? `${task.activityName}${task.periodLabel ? ` · ${task.periodLabel}` : ''}` : 'Other activity'}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <Btn cls="pri" ico="check" disabled={!ok || !changed || acts.edit.isPending} onClick={() => void save()}>
            {acts.edit.isPending ? 'Saving…' : 'Save changes'}
          </Btn>
        </>
      }
    >
      <form
        className="mx-form2 cob-form2"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void save();
        }}
      >
        <F label="Task name" err={err.name} wide>
          <input className="mx-in" aria-label="Task name" value={f.name} maxLength={120} onChange={(ev) => set({ name: ev.target.value })} />
        </F>
        <F label="Start date" err={err.start}>
          <input className="mx-in" type="date" aria-label="Start date" value={f.start} onChange={(ev) => set({ start: ev.target.value })} />
        </F>
        <F label="End date" err={err.end}>
          <input className="mx-in" type="date" aria-label="End date" min={f.start || undefined} value={f.end} onChange={(ev) => set({ end: ev.target.value })} />
        </F>
        <F label="Urgency">
          <select className="lsel full" aria-label="Urgency" value={f.urgency} onChange={(ev) => set({ urgency: ev.target.value as Urgency })}>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </F>
        <F label="Visible to">
          <select className="lsel full" aria-label="Visible to" value={f.vis} onChange={(ev) => set({ vis: ev.target.value as Visibility })}>
            {VIS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </F>
        <F label="Owner">
          <select className="lsel full" aria-label="Owner" value={f.owner} onChange={(ev) => set({ owner: ev.target.value })}>
            <option value="">No owner</option>
            {owners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Reviewer">
          <select className="lsel full" aria-label="Reviewer" value={f.reviewer} onChange={(ev) => set({ reviewer: ev.target.value })}>
            <option value="">No reviewer</option>
            {reviewers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Repeats">
          <select className="lsel full" aria-label="Repeats" value={f.repeats} onChange={(ev) => set({ repeats: ev.target.value as TaskRepeats })}>
            {REPEATS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </F>
        <F label="Remind before (days)" err={err.notify}>
          <input className="mx-in" type="number" min={0} max={90} inputMode="numeric" aria-label="Remind before (days)" value={f.notify} onChange={(ev) => set({ notify: ev.target.value })} />
        </F>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </ModalBody>
  );
}
