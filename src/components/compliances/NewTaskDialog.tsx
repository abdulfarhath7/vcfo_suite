'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/ui/native-select';
import {
  NOTIFY_BY_REPEATS,
  REPEATS,
  URGENCIES,
  type TaskRepeats,
  type TaskUrgency,
  type TaskVisibility,
} from '@/views/compliances/tasks/task-model';
import { OTHER_ACTIVITY, newTaskErrors, parsePlain, plainFull, type NewTaskErrors } from '@/components/compliances/new-task-form';

/**
 * NEW TASK (prototype ns-parts `NewTaskDialog`, COMPLIANCE-MODEL.md S-4 and S-5): the M2 short
 * form an admin or a manager uses to add a non-statutory task. The dialog only checks the
 * fields and hands a clean payload to `onCreate`; the caller posts it and shows the toast.
 * Escape closes (Radix). Enter in a field, a select included, saves.
 */

/** A non-statutory activity of the master, as the activities route returns it. */
export interface TaskActivityOption {
  id: string;
  name: string;
  /** "Non-statutory" or "Configurable"; the second kind sits under a divider. */
  kind: string;
  /** Default repeat, already in the form's words when the route knows it. */
  repeats?: TaskRepeats;
  notifyDays?: number;
  visibility?: TaskVisibility;
}

export interface PersonOption {
  id: string;
  name: string;
}

export interface ClientOption {
  id: string;
  name: string;
  /** Default owner and reviewer of the client: its lead and its manager. */
  ownerId?: string | null;
  reviewerId?: string | null;
}

export interface NewTaskPayload {
  activityId: string | null;
  name: string;
  engagementId: string;
  startDate: string;
  endDate: string;
  urgency: TaskUrgency;
  visibility: TaskVisibility;
  ownerId: string;
  reviewerId: string | null;
  repeats: TaskRepeats;
  notifyDays: number;
}


const VIS_OPTIONS: Array<{ value: TaskVisibility; label: string }> = [
  { value: 'firm', label: 'Firm only' },
  { value: 'client', label: 'Client only' },
  { value: 'both', label: 'Both' },
];

/** R-29: the field shows "16 Oct 2026". Typing a date works; the button opens the browser's picker. */
function DateField({
  label,
  value,
  onChange,
  min,
  invalid,
  year,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  invalid?: boolean;
  year: number;
}) {
  const pick = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(plainFull(value));
  useEffect(() => setText(plainFull(value)), [value]);
  return (
    <span className="relative block">
      <Input
        aria-label={label}
        value={text}
        placeholder="16 Oct 2026"
        aria-invalid={invalid || undefined}
        className="pr-10"
        onChange={(ev) => {
          setText(ev.target.value);
          const v = parsePlain(ev.target.value, year);
          if (v) onChange(v);
          else if (!ev.target.value.trim()) onChange('');
        }}
        onBlur={() => setText(plainFull(value))}
      />
      <button
        type="button"
        aria-label={`Pick the ${label.toLowerCase()}`}
        onClick={() => {
          try {
            pick.current?.showPicker();
          } catch {
            pick.current?.focus();
          }
        }}
        className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
      >
        <CalendarDays size={16} strokeWidth={1.6} aria-hidden />
      </button>
      <input
        ref={pick}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        onChange={(ev) => onChange(ev.target.value)}
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
    </span>
  );
}

export interface NewTaskForm {
  act: string;
  name: string;
  client: string;
  start: string;
  end: string;
  urgency: TaskUrgency;
  vis: TaskVisibility;
  owner: string;
  reviewer: string;
  repeats: TaskRepeats;
  notify: string;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  now,
  activities,
  clients,
  owners,
  reviewers,
  defaultClient,
  saving = false,
  onClientChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  now: Date;
  activities: TaskActivityOption[];
  clients: ClientOption[];
  owners: PersonOption[];
  reviewers: PersonOption[];
  /** The client picked on the list, if any. */
  defaultClient?: string;
  saving?: boolean;
  /** Tells the caller which client is picked, so it can load that client's people. */
  onClientChange?: (id: string) => void;
  /** Post the task. Resolve true to close the dialog. */
  onCreate: (payload: NewTaskPayload) => Promise<boolean> | boolean;
}) {
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const peopleOf = useCallback(
    (id: string): [string, string] => {
      const c = clients.find((x) => x.id === id);
      return [c?.ownerId ?? '', c?.reviewerId ?? ''];
    },
    [clients],
  );
  const blank = useCallback((): NewTaskForm => {
    const client = defaultClient && clients.some((c) => c.id === defaultClient) ? defaultClient : '';
    const [owner, reviewer] = client ? peopleOf(client) : ['', ''];
    return {
      act: '',
      name: '',
      client,
      start: today,
      end: '',
      urgency: 'Medium',
      vis: 'both',
      owner,
      reviewer,
      repeats: 'one-time',
      notify: '5',
    };
  }, [defaultClient, clients, peopleOf, today]);
  const [f, setF] = useState<NewTaskForm>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) {
      setF(blank());
      setTried(false);
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (p: Partial<NewTaskForm>) => setF((x) => ({ ...x, ...p }));

  // The client's default owner and reviewer can arrive after the pick (they load per client).
  const picked = clients.find((c) => c.id === f.client);
  useEffect(() => {
    if (!picked) return;
    setF((x) => ({ ...x, owner: x.owner || picked.ownerId || '', reviewer: x.reviewer || picked.reviewerId || '' }));
  }, [picked?.id, picked?.ownerId, picked?.reviewerId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) onClientChange?.(f.client);
  }, [open, f.client]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickAct = (id: string) => {
    if (!id) return set({ act: '' });
    const a = activities.find((x) => x.id === id);
    if (!a) return set({ act: id, repeats: 'one-time' });
    const repeats = a.repeats ?? 'one-time';
    set({
      act: id,
      vis: a.visibility ?? f.vis,
      repeats,
      notify: String(a.notifyDays ?? NOTIFY_BY_REPEATS[repeats]),
    });
  };
  const pickClient = (id: string) => {
    const [owner, reviewer] = id ? peopleOf(id) : ['', ''];
    set({ client: id, owner: owner || f.owner, reviewer: reviewer || f.reviewer });
  };

  const err = newTaskErrors(f);
  const ok = !Object.values(err).some(Boolean);
  const e = (k: keyof NewTaskErrors) => (tried ? err[k] : undefined);

  const save = async () => {
    setTried(true);
    if (!ok || saving) return;
    const a = activities.find((x) => x.id === f.act);
    const name = f.act === OTHER_ACTIVITY ? f.name.trim() : f.name.trim() || a?.name || '';
    const done = await onCreate({
      activityId: f.act === OTHER_ACTIVITY ? null : f.act,
      name,
      engagementId: f.client,
      startDate: f.start,
      endDate: f.end,
      urgency: f.urgency,
      visibility: f.vis,
      ownerId: f.owner,
      reviewerId: f.reviewer || null,
      repeats: f.repeats,
      notifyDays: Number(f.notify),
    });
    if (done) onOpenChange(false);
  };

  // Enter in a select does not submit natively, so each select saves on Enter itself.
  const enterSaves = (ev: KeyboardEvent<HTMLSelectElement>) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      void save();
    }
  };

  const plainActs = activities.filter((a) => a.kind === 'Non-statutory');
  const otherActs = activities.filter((a) => a.kind !== 'Non-statutory');
  const wide = 'w-full [&>select]:w-full';
  const people = (xs: PersonOption[]) => xs.map((x) => ({ value: x.id, label: x.name }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New task"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-task" disabled={saving}>
            Create task
          </Button>
        </>
      }
    >
      <form
        id="new-task"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void save();
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field label="Activity" className="sm:col-span-2" error={e('act')}>
          <span className={`relative inline-flex ${wide}`}>
            <select
              aria-label="Activity"
              aria-invalid={e('act') ? true : undefined}
              value={f.act}
              onChange={(ev) => pickAct(ev.target.value)}
              onKeyDown={enterSaves}
              className="h-10 w-full appearance-none rounded-md border-1.5 border-line-strong bg-surface-raised pl-2.5 pr-7 text-[14px] font-medium text-ink shadow-control outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-focus-ring/25 aria-[invalid=true]:border-danger"
            >
              <option value="">Pick an activity</option>
              {plainActs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              {otherActs.length ? (
                <optgroup label="Configurable">
                  {otherActs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value={OTHER_ACTIVITY}>Other…</option>
            </select>
          </span>
        </Field>
        <Field label="Task name" className="sm:col-span-2" error={e('name')}>
          <Input
            aria-label="Task name"
            value={f.name}
            onChange={(ev) => set({ name: ev.target.value })}
            aria-invalid={e('name') ? true : undefined}
            placeholder={f.act === OTHER_ACTIVITY ? 'Board pack for the Q3 meeting' : activities.find((a) => a.id === f.act)?.name}
          />
        </Field>
        <Field label="Client" className="sm:col-span-2" error={e('client')}>
          <FilterSelect
            onKeyDown={enterSaves}
            aria-label="Client"
            size="md"
            className={wide}
            aria-invalid={e('client') ? true : undefined}
            value={f.client}
            onChange={(ev) => pickClient(ev.target.value)}
            options={[{ value: '', label: 'Pick a client' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </Field>
        <Field label="Start date" error={e('start')}>
          <DateField label="Start date" value={f.start} onChange={(v) => set({ start: v })} invalid={!!e('start')} year={year} />
        </Field>
        <Field label="End date" error={e('end')}>
          <DateField label="End date" value={f.end} min={f.start || undefined} onChange={(v) => set({ end: v })} invalid={!!e('end')} year={year} />
        </Field>
        <Field label="Urgency">
          <FilterSelect
            onKeyDown={enterSaves}
            aria-label="Urgency"
            size="md"
            className={wide}
            value={f.urgency}
            onChange={(ev) => set({ urgency: ev.target.value as TaskUrgency })}
            options={URGENCIES.map((u) => ({ value: u, label: u }))}
          />
        </Field>
        <Field label="Visible to">
          <FilterSelect
            onKeyDown={enterSaves}
            aria-label="Visible to"
            size="md"
            className={wide}
            value={f.vis}
            onChange={(ev) => set({ vis: ev.target.value as TaskVisibility })}
            options={VIS_OPTIONS}
          />
        </Field>
        <Field label="Owner" error={e('owner')}>
          <FilterSelect
            onKeyDown={enterSaves}
            aria-label="Owner"
            size="md"
            className={wide}
            aria-invalid={e('owner') ? true : undefined}
            value={f.owner}
            onChange={(ev) => set({ owner: ev.target.value })}
            options={[{ value: '', label: 'Pick an owner' }, ...people(owners)]}
          />
        </Field>
        <Field label="Reviewer">
          <FilterSelect
            onKeyDown={enterSaves}
            aria-label="Reviewer"
            size="md"
            className={wide}
            value={f.reviewer}
            onChange={(ev) => set({ reviewer: ev.target.value })}
            options={[{ value: '', label: 'No reviewer' }, ...people(reviewers)]}
          />
        </Field>
        <Field label="Repeats">
          <FilterSelect
            onKeyDown={enterSaves}
            aria-label="Repeats"
            size="md"
            className={wide}
            value={f.repeats}
            onChange={(ev) => set({ repeats: ev.target.value as TaskRepeats })}
            options={REPEATS.map((r) => ({ value: r.value, label: r.label }))}
          />
        </Field>
        <Field label="Remind before (days)" error={e('notify')}>
          <Input
            aria-label="Remind before (days)"
            type="number"
            min={0}
            max={60}
            inputMode="numeric"
            aria-invalid={e('notify') ? true : undefined}
            value={f.notify}
            onChange={(ev) => set({ notify: ev.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}
