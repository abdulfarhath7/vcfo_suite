'use client';

import { useApp } from '@/context/AppContext';
import { useMemo } from 'react';
import { useComplianceFilings } from '@/hooks/use-compliance-filings';
import { AdminDashboardView } from '@/views/admin/DashboardSections';
import { checklist, type Bucket } from '@/data/checklist';
import type { TaskInstance } from '@/data/engagements';
import type { Phase } from '@/components/admin/PhaseTimeline';
import { isAwaitingReview } from '@/lib/checklist-item-review';
import { primaryPhaseItems } from '@/lib/project-stuck';

const PROCESS_KEYS = [
  { key: 'pre-inc', label: 'Pre-incorp', buckets: ['pre-inc'] as Bucket[] },
  { key: 'post-inc', label: 'Post', buckets: ['post-inc'] as Bucket[] },
  { key: 'registration', label: 'Registration', buckets: ['statutory', 'fema'] as Bucket[] },
] as const;

export default function AdminDashboard() {
  const { user, engagements, tasks, teamMembers, getStateForEngagement } = useApp();
  const allFilings = useComplianceFilings(engagements, getStateForEngagement);
  const blockers = engagements.filter((e) => e.health !== 'on-track').length;

  const pendingClientActions = useMemo(
    () => tasks.filter((t) => t.status === 'awaiting-client').length,
    [tasks],
  );

  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.status === 'overdue').length,
    [tasks],
  );

  const dueSoon = useMemo(() => {
    const now = Date.now();
    return allFilings.filter(
      (c) => new Date(c.nextDue).getTime() - now < 1000 * 60 * 60 * 24 * 14,
    );
  }, [allFilings]);

  const dueInTwoDays = useMemo(() => {
    const now = Date.now();
    const twoDays = 1000 * 60 * 60 * 24 * 2;
    return allFilings.filter((c) => {
      const delta = new Date(c.nextDue).getTime() - now;
      return delta >= 0 && delta <= twoDays && c.status !== 'filed';
    }).length;
  }, [allFilings]);

  const approvalsReceived = useMemo(() => {
    let n = 0;
    for (const eng of engagements) {
      const state = getStateForEngagement(eng);
      for (const item of primaryPhaseItems()) {
        if (isAwaitingReview(state[item.id])) n += 1;
      }
    }
    return n;
  }, [engagements, getStateForEngagement]);

  const approvalsToSend = pendingClientActions;

  const keysByBucket = useMemo(() => {
    const map = new Map<Bucket, string[]>();
    for (const c of checklist) {
      const list = map.get(c.bucket);
      if (list) list.push(c.id);
      else map.set(c.bucket, [c.id]);
    }
    return map;
  }, []);

  const portfolioPhases = useMemo((): Phase[] => {
    const setupPhases: Phase[] = PROCESS_KEYS.map(({ key, label, buckets }) => {
      const inBucket = buckets.flatMap((b) => keysByBucket.get(b) ?? []);
      const bucketTasks = tasks.filter((t) => inBucket.includes(t.checklistKey));
      const done = bucketTasks.filter((t) => t.status === 'completed').length;
      const percent = bucketTasks.length ? Math.round((done / bucketTasks.length) * 100) : 0;
      const hasActive = bucketTasks.some(
        (t) => t.status === 'in-progress' || t.status === 'awaiting-client',
      );
      const status: Phase['status'] =
        percent === 100 && bucketTasks.length > 0
          ? 'completed'
          : hasActive || percent > 0
            ? 'in-progress'
            : 'not-started';
      return { key, label, percent, status };
    });

    const filed = allFilings.filter((f) => f.status === 'filed').length;
    const compliancePct = allFilings.length
      ? Math.round((filed / allFilings.length) * 100)
      : 0;
    const complianceActive = allFilings.some(
      (f) => f.status === 'in-progress' || f.status === 'overdue' || f.status === 'upcoming',
    );
    setupPhases.push({
      key: 'compliance',
      label: 'Compliance',
      percent: compliancePct,
      status:
        compliancePct === 100 && allFilings.length > 0
          ? 'completed'
          : complianceActive
            ? 'in-progress'
            : 'not-started',
    });

    return setupPhases;
  }, [tasks, keysByBucket, allFilings]);

  const completionRate = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'completed').length;
    return tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  }, [tasks]);

  const tasksByEngagement = useMemo(() => {
    const map: Record<string, TaskInstance[]> = {};
    for (const t of tasks) {
      (map[t.engagementId] ??= []).push(t);
    }
    return map;
  }, [tasks]);

  return (
    <AdminDashboardView
      userId={user?.id ?? ''}
      engagements={engagements}
      tasks={tasks}
      teamMembers={teamMembers}
      blockers={blockers}
      pendingClientActions={pendingClientActions}
      overdueTasks={overdueTasks}
      dueInTwoDays={dueInTwoDays}
      approvalsToSend={approvalsToSend}
      approvalsReceived={approvalsReceived}
      dueSoon={dueSoon}
      portfolioPhases={portfolioPhases}
      completionRate={completionRate}
      tasksByEngagement={tasksByEngagement}
    />
  );
}
