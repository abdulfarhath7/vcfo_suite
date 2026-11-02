'use client';

/**
 * Small marks and lists shared by the Obligations section, the task view and the
 * statutory extras card: the urgency bars, the six-word pill, an initials tile,
 * a titled block, and the Progress / Reminders / Activity lists of a detail
 * (COMPLIANCE-API.md `Step`, `ReminderRow`, `HistoryEntry`, client view).
 * Class names are the prototype's where one exists (`.nd`, `.rstep`, `.pill`);
 * the rest come from css-src/95-obligations.css.
 */
import type { ReactNode } from 'react';
import { URGENCY_BARS, urgencyLabel } from '@/components/client-portal/pages/compliances/tasks';
import type { DetailHistory, DetailReminder, DetailStep } from '@/components/client-portal/pages/compliances/task-api';
import { Icon, initials, Pill } from '../../ui';
import { isWord, REMINDER_STATE, STEP_ND, WORD_ICON, WORD_PILL, whenText } from './model';

/** Urgency as four signal bars and the word; only Critical colours its bars (red is for late work). */
export function UrgencyMark({ urgency }: { urgency: string }) {
  const word = urgencyLabel(urgency);
  const n = URGENCY_BARS[word] ?? 1;
  return (
    <span className={'urg' + (word === 'Critical' ? ' crit' : '')} title={`Urgency: ${word}`}>
      <i aria-hidden="true">
        {[1, 2, 3, 4].map((k) => (
          <b key={k} className={k <= n ? 'on' : ''} />
        ))}
      </i>
      {word}
    </span>
  );
}

/** One of the six status words as a pill. An unknown word reads as a plain grey pill. */
export function WordPill({ word }: { word: string | null | undefined }) {
  if (!isWord(word)) return <Pill kind="mut">{word || 'Not started'}</Pill>;
  return (
    <Pill kind={WORD_PILL[word]} icon={WORD_ICON[word]}>
      {word}
    </Pill>
  );
}

export function Av({ name }: { name: string }) {
  return (
    <span className="tv-av" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** A titled block of the task view or the extras card: `.tv-blk` with a `.tv-h` head. */
export function Block({ title, count, right, children }: { title: string; count?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="tv-blk">
      <div className="tv-h">
        <h3>{title}</h3>
        {count !== undefined && count !== null && count !== 0 && count !== '' ? <span className="n">{count}</span> : null}
        {right ? (
          <>
            <span className="sp" />
            {right}
          </>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="tv-empty">{children}</p>;
}

/** D-3 Progress: the steps with who, when and evidence. */
export function StepList({ steps }: { steps: DetailStep[] }) {
  if (!steps.length) return <EmptyLine>SBC has not started this one yet.</EmptyLine>;
  return (
    <div className="rproc">
      {steps.map((s, i) => {
        const meta = [s.who, s.when ? whenText(s.when) : s.state === 'now' ? 'Now' : null].filter(Boolean).join(' · ');
        return (
          <div key={`${s.label}-${i}`} className={'rstep ' + (s.state === 'now' ? 'now' : s.state === 'next' ? 'up' : 'done')}>
            <span className={'nd ' + STEP_ND[s.state]}>{s.state === 'done' ? <Icon name="check" /> : String(i + 1)}</span>
            <div style={{ minWidth: 0 }}>
              <b>{s.label}</b>
              {meta ? <span className="m">{meta}</span> : null}
              {s.evidence ? <span className="ev">{s.evidence}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** D-2.3 Reminders, client view: no escalations (the hook drops them) and nothing to edit. */
export function ReminderList({ rows }: { rows: DetailReminder[] }) {
  const shown = rows.filter((r) => !r.internal);
  if (!shown.length) return <EmptyLine>No reminders are set up for this one yet.</EmptyLine>;
  return (
    <div>
      {shown.map((r) => (
        <div key={r.key} className="tv-row">
          <Icon name="bell" />
          <div style={{ minWidth: 0 }}>
            <b>{r.label}</b>
            <span className="m">{[r.to ? `To ${r.to.toLowerCase()}` : '', r.date ? whenText(r.date) : ''].filter(Boolean).join(' · ')}</span>
          </div>
          <span className="r">{REMINDER_STATE[r.state]}</span>
        </div>
      ))}
    </div>
  );
}

/** D-2.5 Activity: who did what, newest first (as the route orders it). */
export function ActivityList({ rows }: { rows: DetailHistory[] }) {
  if (!rows.length) return <EmptyLine>Nothing has happened on this one yet.</EmptyLine>;
  return (
    <div>
      {rows.map((h, i) => (
        <div key={`${h.at}-${i}`} className="tv-row">
          <Av name={h.who} />
          <div style={{ minWidth: 0 }}>
            <b>
              {h.who} <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{h.what}</span>
            </b>
          </div>
          <span className="r">{whenText(h.at)}</span>
        </div>
      ))}
    </div>
  );
}
