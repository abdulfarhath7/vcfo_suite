import type { ReactNode } from 'react';
import { ScheduleWindowMeta } from '@/components/schedule/ScheduleWindowControl';
import { isIncorporationWindowPhase, type EngagementSchedule } from '@/lib/schedule-windows';

/** Phase-row metadata: the incorporation window on the two SPICe+ rows, nothing elsewhere. */
export function phaseWindowMeta(
  schedule: EngagementSchedule | null | undefined,
): (phaseId: string) => ReactNode {
  return (phaseId) =>
    isIncorporationWindowPhase(phaseId) && schedule?.incorporation ? (
      <ScheduleWindowMeta value={schedule.incorporation} className="mt-0.5" />
    ) : null;
}
