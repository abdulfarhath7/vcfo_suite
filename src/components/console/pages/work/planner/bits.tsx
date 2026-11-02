'use client';

/**
 * Small planner pieces: links built from the seat's base (`useConsole().base`),
 * the item actions (open, remind the client, email the manager again, mark a
 * team task done), the client dot and the status pill.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { stepSlugForItemId } from '@/lib/slug';
import { internLeadManagerRequestPatch } from '@/lib/checklist/checklist-item-review';
import { companyShortName } from '@/lib/client-portal/company';
import { useConsole } from '../../../runtime';
import { hueOf } from '../../../ui';
import { T_LABEL, T_PILL, type PlanItem } from './model';

export const shortName = (name: string): string => companyShortName(name) || name;

export function projectHref(base: string, e: Pick<Engagement, 'id' | 'slug'>): string {
  return `${base}/projects/${encodeURIComponent(e.slug ?? e.id)}`;
}
export function stepHref(base: string, e: Pick<Engagement, 'id' | 'slug'>, stepId: string): string {
  return `${projectHref(base, e)}/step/${stepSlugForItemId(stepId)}`;
}

/** A drafted reminder in Email (nothing is sent until Send is pressed). */
export function mailDraft(base: string, e: Pick<Engagement, 'clientEmail' | 'companyName'> | undefined, what: string): string {
  const q = new URLSearchParams();
  if (e?.clientEmail) q.set('to', e.clientEmail);
  const name = e ? shortName(e.companyName) : '';
  q.set('subject', `Reminder: ${what}${name ? ` · ${name}` : ''}`);
  q.set(
    'body',
    `Hello,\n\nA quick reminder that we are waiting on you for ${what}${e ? ` for ${e.companyName}` : ''}. You can complete it in your VCFO Suite portal; once it is in, we move to the next step the same day.\n\nRegards`,
  );
  return `${base}/mail?${q.toString()}`;
}

export function CDot({ id, name }: { id: string; name?: string }) {
  return <span className="mx-dot" title={name} style={{ background: hueOf(id) }} />;
}

export function StPill({ i, sm }: { i: PlanItem; sm?: boolean }) {
  const text = i.st === 'done' ? 'Done' : i.st === 'wait' || i.st === 'run' || i.st === 'none' ? (i.due ? `${T_LABEL[i.st]} · ${i.dueLabel}` : T_LABEL[i.st]) : i.dueLabel;
  return (
    <span className={'pill ' + T_PILL[i.st] + (sm ? ' sm' : '')} title={`${T_LABEL[i.st]}${i.due ? ` · due ${i.due}` : ''}`}>
      {text}
    </span>
  );
}

/** Where an item opens, and its one-click action (the live CTA). */
export function useItemActions() {
  const { base, seat, go, toast } = useConsole();
  const { engagements, updateItem, getStateForEngagement, updateTask, user } = useApp();
  const qc = useQueryClient();

  const hrefOf = useCallback(
    (i: PlanItem): string => {
      const e = engagements.find((x) => x.id === i.clientId);
      if (i.kind === 'filing') return `${base}/compliances/${seat === 'lead' ? 'calendar' : 'filings'}`;
      if (!e) return `${base}/projects`;
      if (i.kind === 'step' && i.stepId) return stepHref(base, e, i.stepId);
      return projectHref(base, e);
    },
    [engagements, base, seat],
  );

  const setTaskDone = useCallback(
    (i: PlanItem, done: boolean) => {
      if (!i.task) return;
      const prev = i.task.status;
      updateTask(i.task.id, { status: done ? 'completed' : 'in-progress' });
      toast(done ? `${i.title} · done everywhere` : `${i.title} reopened`, () => {
        updateTask(i.task!.id, { status: prev });
        void qc.invalidateQueries({ queryKey: ['tasks', user?.id] });
      });
    },
    [updateTask, toast, qc, user?.id],
  );

  const run = useCallback(
    async (i: PlanItem) => {
      const e = engagements.find((x) => x.id === i.clientId);
      if (i.cta.action === 'done') return setTaskDone(i, i.st !== 'done');
      if (i.cta.action === 'remind') return go(mailDraft(base, e, i.title));
      if (i.cta.action === 'nudge-manager') {
        if (!i.stepId || !e) return;
        try {
          const slice = getStateForEngagement(e)[i.stepId];
          await updateItem(i.clientId, i.stepId, { ...internLeadManagerRequestPatch(slice), resendManagerEmail: true });
          toast('Emailed manager again · watch for the send confirmation');
        } catch (err) {
          toast(err instanceof Error ? `Could not email manager · ${err.message}` : 'Could not email manager · try again');
        }
        return;
      }
      go(hrefOf(i));
    },
    [engagements, setTaskDone, go, base, getStateForEngagement, updateItem, toast, hrefOf],
  );

  return { hrefOf, run, setTaskDone };
}

export function saveFile(name: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Session memory for small view choices (prototype MS). */
export function readSession<T>(key: string, fallback: T, ok: (v: unknown) => v is T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    const v: unknown = JSON.parse(raw);
    return ok(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
export function writeSession(key: string, v: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}
