'use client';

/**
 * Pieces the console's Obligations pages share (prototype shared/detail-parts,
 * in the console's markup): the six-word pill, urgency bars, visibility mark,
 * the date tile, the detail head, the Progress steps, the Reminders schedule
 * (with the per-row overrides), the Activity trail, key–value rows, the
 * send-back reason form, and the toast-wrapped `run`.
 */
import { useState, type ReactNode } from 'react';
import { useConsole } from '../../runtime';
import { Btn, Empty, Icon, LeadAv, Panel, Select, type IconName } from '../../ui';
import { dShort, initialsOf, istDay, plural } from '../today/model';
import { MON } from '@/lib/client-portal/compliances';
import type { Person, ReminderKey, ReminderRowDto, StepDto, HistoryDto } from './obligations-data';
import { errText } from './obligations-data';
import {
  DAY_CHOICES,
  REMINDER_WORD,
  URGENCY_BARS,
  VIS_LABEL,
  VIS_TIP,
  WORD_PILL,
  WORD_TIP,
  type StatusWord,
  type Urgency,
  type Visibility,
} from './obligations-model';
import '../../css/96-compliance.css';

/* ---------------------------------------------------------------- marks */

export function WordPill({ word, sm }: { word: StatusWord; sm?: boolean }) {
  return (
    <span className={'pill ' + WORD_PILL[word] + (sm ? ' sm' : '')} title={WORD_TIP[word]}>
      {word}
    </span>
  );
}

/** S-6: a neutral pill with 1 to 4 signal bars; only Critical fills them amber (red is for late work). */
export function UrgencyMark({ urgency }: { urgency: Urgency }) {
  const n = URGENCY_BARS[urgency] ?? 1;
  return (
    <span className={'cob-urg' + (urgency === 'Critical' ? ' crit' : '')} title={`Urgency ${urgency}`}>
      <span className="cob-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className={i <= n ? 'on' : ''} />
        ))}
      </span>
      {urgency}
    </span>
  );
}

const VIS_ICON: Record<Visibility, IconName> = { firm: 'lock', client: 'eye', both: 'team' };
/** S-7: who sees the task. */
export function VisMark({ visibility }: { visibility: Visibility }) {
  return (
    <span className="cob-vis" title={VIS_TIP[visibility]}>
      <Icon name={VIS_ICON[visibility]} size={14} />
      {VIS_LABEL[visibility]}
    </span>
  );
}

/** "Statutory" / "Non-statutory" kind tag. */
export function KindTag({ children }: { children: ReactNode }) {
  return <span className="mx-tag cob-kind">{children}</span>;
}

/** The day-and-month tile the register rows use (`.mx-dtile`); red when late. */
export function DTile({ iso, red, big }: { iso: string; red?: boolean; big?: boolean }) {
  return (
    <span className={'mx-dtile' + (red ? ' red' : '') + (big ? ' cob-big' : '')} aria-hidden="true">
      <b>{Number(iso.slice(8, 10))}</b>
      <small>{MON[Number(iso.slice(5, 7)) - 1]}</small>
    </span>
  );
}

/** A person with the console's initials avatar; "—" when nobody. */
export function PersonChip({ p, role }: { p: Person | { id: string; name: string } | null | undefined; role?: string }) {
  if (!p) return <span className="small">—</span>;
  return (
    <span className="cob-person" title={role ? `${p.name} · ${role}` : p.name}>
      <LeadAv id={p.id} name={p.name} initials={initialsOf(p.name)} sm />
      <span className="cf-ell">{p.name}</span>
    </span>
  );
}

/** A timestamp or date as "16 Oct" / "16 Oct 2025" (India day). */
export const stamp = (v: string | null | undefined, today: string): string => {
  const d = istDay(v);
  return d ? dShort(d, today) : '';
};

/* ---------------------------------------------------------------- head */

/**
 * D-1 / 4.3 head: the date tile, the title, the client line, the marks, the due
 * line and the role's actions. A `glass panel mx-p` so it lines up with the body.
 */
export function DetailHead({
  tile,
  title,
  sub,
  chips,
  line,
  acts,
  children,
}: {
  tile: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  chips?: ReactNode;
  line?: ReactNode;
  acts?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="glass panel mx-p cob-head">
      <div className="cob-headr">
        {tile}
        <div className="cob-headt">
          <h3 className="cob-title">{title}</h3>
          {sub ? <span className="small cob-sub">{sub}</span> : null}
          {chips || line ? (
            <div className="mx-chips cob-chips">
              {chips}
              {line ? <span className="small">{line}</span> : null}
            </div>
          ) : null}
        </div>
        {acts ? <div className="mx-moves cob-acts">{acts}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** The reason box that opens under the head for "Send back" (note required by the route). */
export function SendBackForm({ busy, onSend, onCancel, who }: { busy: boolean; onSend: (note: string) => void; onCancel: () => void; who?: string | null }) {
  const [note, setNote] = useState('');
  return (
    <form
      className="cob-form cob-sendback"
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim()) onSend(note.trim());
      }}
    >
      <input className="mx-in grow" autoFocus aria-label="What should change" placeholder={`What should change? ${who ? `${who} reworks it.` : ''}`.trim()} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <Btn cls="sm pri" ico="back" type="submit" disabled={!note.trim() || busy}>
        Send back
      </Btn>
      <Btn cls="sm" onClick={onCancel}>
        Cancel
      </Btn>
    </form>
  );
}

/* ---------------------------------------------------------------- progress */

/** D-3 Progress: the steps with who, when and evidence, then stage, owner, reviewer and the review note. */
export function StepsPanel({
  steps,
  stage,
  owner,
  reviewer,
  note,
  today,
  children,
}: {
  steps: StepDto[];
  stage: string;
  owner: Person;
  reviewer: Person;
  note?: string | null;
  today: string;
  children?: ReactNode;
}) {
  const done = steps.filter((s) => s.state === 'done').length;
  return (
    <Panel title="Progress" sub={`${done} of ${plural(steps.length, 'step')} done`}>
      <ol className="cob-steps" aria-label="Steps">
        {steps.map((s) => (
          <li key={s.key} className={'cob-step ' + s.state}>
            <i className={'mx-si2 ' + (s.state === 'done' ? 'done' : s.state === 'now' ? 'cur' : '')} title={s.state === 'done' ? 'Done' : s.state === 'now' ? 'Current step' : 'Next'}>
              {s.state === 'done' ? <Icon name="check" size={11} /> : null}
            </i>
            <span className="mx-dt">
              <b>{s.label}</b>
              {s.who || s.when || s.state === 'now' ? <span>{[s.who, s.when ? stamp(s.when, today) : s.state === 'now' ? 'Now' : null].filter(Boolean).join(' · ')}</span> : null}
              {s.evidence ? (
                <span className="cf-ell cob-ev" title={s.evidence}>
                  {s.evidence}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="cob-kvs">
        <KV k="Stage">
          <b>{stage}</b>
        </KV>
        <KV k="Owner">
          <PersonChip p={owner} role="owner" />
        </KV>
        <KV k="Reviewer">
          <PersonChip p={reviewer} role="reviewer" />
        </KV>
        {note ? (
          <div className="cob-note" role="note">
            <Icon name="back" size={14} />
            <span>{note}</span>
          </div>
        ) : null}
        {children}
      </div>
      <div className="mx-phleg cf-leg" aria-label="What the marks mean">
        <span>
          <i className="mx-si2 done" />
          Done
        </span>
        <span>
          <i className="mx-si2 cur" />
          Current step
        </span>
        <span>
          <i className="mx-si2" />
          Next
        </span>
      </div>
    </Panel>
  );
}

/** Label and value row. */
export function KV({ k, children, title }: { k: string; children: ReactNode; title?: string }) {
  return (
    <div className="cob-kv" title={title}>
      <span className="small">{k}</span>
      <span className="cob-kvv">{children}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- reminders */

export interface ReminderPatch {
  offsetDays?: number;
  enabled?: boolean;
}

/**
 * D-2.3 Reminders (section 3.4): the six rows with their date and state. Admin
 * and manager open "Edit schedule": the first-reminder days, an on/off box and
 * the days from the due date per row (-120 to 60, saved on Enter or blur), and
 * Reset when a row is overridden. Off rows hide outside edit mode.
 */
export function RemindersPanel({
  rows,
  days,
  canEdit,
  saving,
  blocked,
  today,
  onDays,
  onRow,
  onReset,
}: {
  rows: ReminderRowDto[];
  days: number;
  canEdit: boolean;
  saving: boolean;
  blocked: string | null;
  today: string;
  onDays: (n: number) => void;
  onRow: (key: ReminderKey, patch: ReminderPatch) => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const shown = editing ? rows : rows.filter((r) => r.enabled !== false);
  const choices = DAY_CHOICES.includes(days) ? DAY_CHOICES : [...DAY_CHOICES, days].sort((a, b) => a - b);
  return (
    <Panel
      title="Reminders"
      sub={`First reminder ${days} day${days === 1 ? '' : 's'} before the due date · ${plural(rows.filter((r) => r.enabled !== false).length, 'reminder')} on`}
      act={
        canEdit ? (
          editing ? (
            <>
              <Select<string> label="First reminder" value={String(days)} onChange={(v) => onDays(Number(v))} options={choices.map((n): [string, string] => [String(n), `${n} day${n === 1 ? '' : 's'} before`])} />
              {rows.some((r) => r.overridden) ? (
                <Btn cls="sm" ico="back" disabled={saving} title="Drop every override and go back to the default schedule" onClick={onReset}>
                  Reset
                </Btn>
              ) : null}
              <Btn cls="sm" ico="check" onClick={() => setEditing(false)}>
                Done
              </Btn>
            </>
          ) : (
            <Btn cls="sm" ico="bell" onClick={() => setEditing(true)}>
              Edit schedule
            </Btn>
          )
        ) : undefined
      }
    >
      {blocked ? (
        <div className="cob-hold" role="status">
          <Icon name="alert" size={14} />
          <span>{blocked}</span>
        </div>
      ) : null}
      {shown.length ? (
        <div className="cob-rems">
          {shown.map((r) => {
            const off = r.enabled === false;
            return (
              <div key={r.key} className={'cob-rem' + (off ? ' off' : '') + (editing ? ' edit' : '')}>
                {editing ? (
                  <input
                    type="checkbox"
                    className="cob-chk"
                    checked={!off}
                    disabled={saving}
                    aria-label={`Send ${r.label.toLowerCase()} to ${r.to.toLowerCase()}`}
                    onChange={(e) => onRow(r.key, { enabled: e.target.checked })}
                  />
                ) : null}
                <span className="mx-dt">
                  <b>
                    {r.label}
                    {r.internal ? <span className="cob-int" title="Internal escalation; the client never sees it">internal</span> : null}
                  </b>
                  <span>{`To ${r.to.toLowerCase()}${r.overridden ? ' · changed from the default' : ''}`}</span>
                </span>
                {editing ? <OffsetInput key={`${r.key}-${r.offsetDays}`} value={r.offsetDays} disabled={saving || off} label={`${r.label} to ${r.to.toLowerCase()}, days from the due date`} onCommit={(n) => onRow(r.key, { offsetDays: n })} /> : null}
                <span className="num cob-remd" title={`${r.offsetDays < 0 ? `${-r.offsetDays} days before` : r.offsetDays === 0 ? 'On' : `${r.offsetDays} days after`} the due date`}>
                  {dShort(r.date, today)}
                </span>
                <span className={'small cob-rems-st' + (r.state === 'sent' || r.state === 'acknowledged' ? ' on' : '')} title={r.sentAt ? `Sent ${stamp(r.sentAt, today)}` : undefined}>
                  {REMINDER_WORD[r.state] ?? r.state}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="small">No reminders are scheduled.</span>
      )}
    </Panel>
  );
}

function OffsetInput({ value, disabled, label, onCommit }: { value: number; disabled: boolean; label: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isInteger(n) || n < -120 || n > 60) {
      setText(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };
  return (
    <span className="cob-off small">
      <input
        className="mx-in cob-offin"
        type="number"
        min={-120}
        max={60}
        inputMode="numeric"
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      days
    </span>
  );
}

/* ---------------------------------------------------------------- activity */

/** D-2.5 Activity: the audit trail, newest first. A row without a person reads "VCFO". */
export function HistoryPanel({ rows, today, title = 'Activity' }: { rows: HistoryDto[]; today: string; title?: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 8);
  return (
    <Panel title={title} sub={rows.length ? `${plural(rows.length, 'entry', 'entries')} · newest first` : 'Nothing has happened yet'}>
      {rows.length ? (
        <div className="mx-acts cob-acts-l">
          {shown.map((h, i) => (
            <div key={`${h.at}-${i}`} className="mx-act">
              <i className={h.side === 'client' ? 'client' : ''} title={h.side === 'client' ? 'From the client' : 'From SBC'} />
              <span className="mx-dt">
                <b>
                  {h.who ?? 'VCFO'} <span className="cob-what">{h.what}</span>
                </b>
                <span>{stamp(h.at, today)}</span>
              </span>
            </div>
          ))}
          {rows.length > 8 ? (
            <button type="button" className="link" onClick={() => setAll((v) => !v)}>
              {all ? 'Show less' : `Show all ${rows.length}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

/* ---------------------------------------------------------------- states */

export function NotFound({ title, sub, href, link }: { title: string; sub?: string; href: string; link: string }) {
  const { go } = useConsole();
  return (
    <section className="glass panel mx-p">
      <Empty title={title} sub={sub} />
      <div className="mx-apa cf-acts">
        <Btn cls="sm" ico="back" onClick={() => go(href)}>
          {link}
        </Btn>
      </div>
    </section>
  );
}

/** Await a write, toast the result (the console's toast, Undo-less), and say whether it worked. */
export function useRun() {
  const { toast } = useConsole();
  return async (p: Promise<unknown>, ok: string, fail = 'Could not save the change'): Promise<boolean> => {
    try {
      await p;
      toast(ok);
      return true;
    } catch (e) {
      toast(errText(e, fail));
      return false;
    }
  };
}
