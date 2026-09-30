import { getActiveCatalogItems } from '@/data/checklist';
import type { ProjectSnapshot } from '@/data/ask/schema';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { buildProgress } from '@/lib/client-overview';
import { indiaDay } from '@/lib/ask/nudge';

/**
 * C4 monthly status brief (§9A) — the data behind the PDF. Built only from
 * the snapshot and step statuses: company name, phase progress, step titles
 * and calendar dates. No identity numbers, addresses or people can reach it,
 * because no step response is ever read here.
 */
export interface StatusBrief {
  companyName: string;
  monthLabel: string;
  phases: Array<{ label: string; done: number; total: number }>;
  doneThisMonth: string[];
  next: { title: string; withWhom: 'you' | 'your project lead' } | null;
  upcoming: Array<{ name: string; dueDate: string }>;
}

export function buildStatusBrief(input: {
  snapshot: ProjectSnapshot;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  now: Date;
}): StatusBrief {
  const { snapshot, state, now } = input;
  const month = indiaDay(now).slice(0, 7);
  const doneThisMonth = getActiveCatalogItems()
    .filter((item) => (state[item.id]?.completedOn ?? '').slice(0, 7) === month)
    .map((item) => item.title);
  const step = snapshot.currentStep;
  return {
    companyName: snapshot.companyName,
    monthLabel: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now),
    phases: buildProgress(state).byPhase.map((p) => ({ label: p.label, done: p.done, total: p.total })),
    doneThisMonth,
    next: step ? { title: step.title, withWhom: step.status === 'waiting on you' ? 'you' : 'your project lead' } : null,
    upcoming: (snapshot.upcomingCompliances ?? []).slice(0, 10),
  };
}
