/**
 * LEAD DESK — the project lead's lists, cut from the same Today model the
 * manager reads (`../today/model.ts`, built with `seat: 'lead'`), so a lead's
 * overdue / waiting / filings numbers agree with their manager's.
 *
 *   items    the model's queue for the lead's clients (current steps, filings
 *            due within 14 days or overdue, document requests, approvals that
 *            wait on the manager) plus the team tasks assigned to the lead
 *   today    open items the lead holds that are due today, late or undated
 *            (live: undated open work lands on today)
 *   week     the same, due within seven days
 *   waiting  items a client, MCA or the manager holds
 *
 * Pure: no React, no fetch.
 */
import { addDays, daysBetween, dDay, dShort, istDay, type Holder, type QState, type TodayModel } from '../today/model';

export type DeskKind = 'step' | 'approval' | 'filing' | 'request' | 'task';
export const DESK_KIND_LABEL: Record<DeskKind, string> = { step: 'STEP', approval: 'APPROVAL', filing: 'FILING', request: 'REQUEST', task: 'TASK' };

export interface DeskItem {
  id: string;
  kind: DeskKind;
  title: string;
  code: string;
  why: string;
  clientId: string;
  due?: string;
  holder: Holder;
  state: QState | 'done';
  status: string;
  pill: string;
  done: boolean;
  /** what the row's button does */
  cta: { label: string; to: 'step' | 'filings' | 'client' | 'mail' | 'nudge' | 'task'; href: string };
  stepId?: string;
  taskId?: string;
  days?: number;
}

export interface Desk {
  items: DeskItem[];
  today: DeskItem[];
  week: DeskItem[];
  waiting: DeskItem[];
  kpi: { clients: number; dueToday: number; overdue: number; filingsWeek: number; waitingClients: number };
}

const RANK: Record<DeskItem['state'], number> = { over: 0, due: 1, you: 2, wait: 3, up: 4, done: 5 };

export function buildDesk(m: TodayModel): Desk {
  const items: DeskItem[] = m.queue.map((q) => ({
    id: q.id,
    kind: q.source,
    title: q.title,
    code: q.code,
    why: q.why,
    clientId: q.clientId,
    due: q.due,
    holder: q.holder,
    state: q.state,
    status: q.status,
    pill: q.pill,
    done: false,
    cta: q.cta,
    stepId: q.stepId,
    days: q.days,
  }));
  for (const t of m.team) {
    if (t.kind !== 'task' || t.leadKey !== '@me') continue;
    const st = t.st;
    items.push({
      id: t.id,
      kind: 'task',
      title: t.title,
      code: '',
      why: t.sub,
      clientId: t.clientId,
      due: t.due,
      holder: 'you',
      state: st === 'done' ? 'done' : st === 'over' ? 'over' : st === 'due' ? 'due' : 'you',
      status: t.dueLabel,
      pill: st === 'over' ? 'over' : st === 'due' ? 'due' : st === 'done' ? 'ok' : st === 'run' ? 'up' : 'na',
      done: st === 'done',
      cta: { label: st === 'done' ? 'Reopen' : 'Mark done', to: 'task', href: '' },
      taskId: t.taskId,
    });
  }
  items.sort((a, b) => RANK[a.state] - RANK[b.state] || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.title.localeCompare(b.title));

  const mine = items.filter((i) => !i.done && i.holder === 'you');
  const within = (i: DeskItem, days: number) => !i.due || i.due <= addDays(m.today, days);
  // Today: dated and due today or late (undated work sits under This week)
  const today = mine.filter((i) => !!i.due && i.due <= m.today);
  const week = mine.filter((i) => within(i, 6));
  const waiting = items.filter((i) => !i.done && i.holder !== 'you');
  const filingsWeek = m.filings.filter((f) => f.st === 'd' || (f.st !== 'f' && f.st !== 'l' && f.days >= 0 && f.days <= 6)).length;

  return {
    items,
    today,
    week,
    waiting,
    kpi: {
      clients: m.clients.length,
      dueToday: mine.filter((i) => i.due === m.today).length,
      overdue: mine.filter((i) => !!i.due && i.due < m.today).length,
      filingsWeek,
      waitingClients: waiting.filter((i) => i.holder === 'client').length,
    },
  };
}

/** "due today" in the prototype's words: today, late by N days, or a date. */
export function dueText(due: string | undefined, today: string): string {
  if (!due) return 'No date';
  const d = daysBetween(today, due);
  if (d < 0) return `${-d}d overdue`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return d <= 6 ? dDay(due, today) : dShort(due, today);
}

/* ---------------------------------------------------------------- reviews */

export interface ReviewItem {
  id: string;
  kind: 'upload' | 'file';
  title: string;
  /** who sent it and when */
  sub: string;
  clientId: string;
  at?: string;
  requestId?: string;
  stepId?: string;
}

export interface FileRequestDto {
  id: string;
  stepId: string;
  label: string;
  fulfilledAt?: string;
  fulfilledByName?: string;
  fileName?: string;
}

export function buildReviews(m: TodayModel, uploads: Array<{ id: string; engagementId: string; label: string; status: string; fileName?: string; uploadedAt?: string }>, files: Record<string, FileRequestDto[]>): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const r of uploads) {
    if (r.status !== 'uploaded' || !m.byId[r.engagementId]) continue;
    out.push({
      id: `u:${r.id}`,
      kind: 'upload',
      title: r.label,
      sub: ['Uploaded by the client', r.fileName, istDay(r.uploadedAt)].filter(Boolean).join(' · '),
      clientId: r.engagementId,
      at: istDay(r.uploadedAt),
      requestId: r.id,
    });
  }
  for (const [clientId, list] of Object.entries(files)) {
    const c = m.byId[clientId];
    if (!c) continue;
    for (const f of list) {
      if (!f.fulfilledAt) continue;
      const step = c.model.byId[f.stepId];
      if (!step || step.kind === 'done') continue;
      out.push({
        id: `f:${f.id}`,
        kind: 'file',
        title: f.label,
        sub: [`Uploaded by ${f.fulfilledByName ?? 'the client'}`, f.fileName, `for ${step.title}`].filter(Boolean).join(' · '),
        clientId,
        at: istDay(f.fulfilledAt),
        stepId: f.stepId,
      });
    }
  }
  return out.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

