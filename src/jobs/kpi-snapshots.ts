import { inngest } from './client';
import { checklist } from '@/data/checklist';
import { listChecklistIndex } from '@/db/repositories/engagements';
import { getAnalyticsMetrics } from '@/db/repositories/metrics';
import { systemListKpiSubjects, systemSaveKpiSnapshot, type KpiValues } from '@/db/repositories/kpi-snapshots';
import type { AuthContext } from '@/auth/guards';
import { analyticsKpis, previousMonthEnd } from '@/lib/metrics/analytics-kpis';
import { withRunNow } from '@/jobs/dev-controls';

const ITEM_IDS = checklist.map((item) => item.id);

/**
 * Scheduled: store the month-end Analytics tile values (S-618), so the page can show the change
 * against last month. Runs just after midnight India time on the 1st and stores the values
 * under the last day of the month that just ended.
 *
 * Each scope is computed with its own person's role scope (the firm as a firm-wide admin,
 * each manager and lead as themselves), through the same repository reads and the same pure
 * rule (`analyticsKpis`) the Analytics page uses. A re-run for the same month overwrites.
 */
export const kpiSnapshots = inngest.createFunction(
  { id: 'kpi-snapshots' },
  withRunNow('kpi-snapshots', 'TZ=Asia/Kolkata 5 0 1 * *'),
  async ({ step }) => {
    const period = previousMonthEnd(new Date());
    const subjects = await step.run('list-subjects', () => systemListKpiSubjects());
    let saved = 0;
    for (const subject of subjects) {
      saved += await step.run(`snapshot-${subject.scope}`, async () => {
        // Step results come back as JSON; the context is rebuilt with its required fields.
        const ctx: AuthContext = {
          userId: subject.ctx.userId!,
          email: subject.ctx.email ?? '',
          name: subject.ctx.name ?? '',
          role: subject.ctx.role!,
          internId: subject.ctx.internId,
        };
        const index = await listChecklistIndex(ctx);
        const kpis = analyticsKpis(Object.values(index), ITEM_IDS);
        const metrics = await getAnalyticsMetrics(ctx, { months: 12 });
        const values: KpiValues = {
          projects: kpis.projects,
          steps_done: kpis.stepsDone,
          awaiting_client: kpis.awaitingClient,
          overdue_steps: kpis.overdue,
        };
        const pct = metrics?.onTime.pct;
        if (typeof pct === 'number') values.on_time_pct = pct;
        return systemSaveKpiSnapshot(period, subject.scope, values);
      });
    }
    return { period, scopes: subjects.length, saved };
  },
);
