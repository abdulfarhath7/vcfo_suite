import { getActiveCatalogItems, getIncorporationPhases } from '@/data/checklist';
import type { LegalForm, ProjectSnapshot } from '@/data/ask/schema';
import { projectSnapshotSchema } from '@/data/ask/schema';
import { gateActiveCatalog, getStepGate } from '@/lib/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { buildProgress } from '@/lib/client-overview';
import { PHASE_BY_ID } from '@/lib/ask/phase-progress';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { formatWindow, normalizeEngagementSchedule, windowForStep } from '@/lib/schedule-windows';

/** Only the engagement columns a snapshot may read — no ids, addresses or people. */
export interface SnapshotEngagement {
  companyName: string;
  entityLegalForm: string | null;
  companyType: string | null;
  ownershipType: string | null;
  stage: string;
  incorporationDate: string | null;
  schedule: unknown;
}

export interface SnapshotFiling {
  particular: string;
  dueDate: string;
  filedOn: string | null;
}

const LEGAL_FORMS: readonly LegalForm[] = ['company', 'llp', 'partnership', 'proprietorship'];

const UPCOMING_DAYS = 30;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pure snapshot builder (§6.3). Sequencing comes from the same client gate
 * the wizard enforces; the result is validated with a strict schema so an
 * extra field can never slip through to the model.
 */
export function buildSnapshot(input: {
  engagement: SnapshotEngagement;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  filings: readonly SnapshotFiling[];
  now: Date;
}): ProjectSnapshot {
  const { engagement, state, now } = input;
  const gates = gateActiveCatalog(state, 'client');
  const current = getActiveCatalogItems().find((item) => {
    const kind = getStepGate(gates, item.id).kind;
    return kind === 'active' || kind === 'waiting';
  });
  const phase = current
    ? getIncorporationPhases().find((group) => group.items.some((item) => item.id === current.id))
    : undefined;
  const progress = buildProgress(state);
  const incorporated = isIncorporated(
    { incorporationDate: engagement.incorporationDate, stage: engagement.stage },
    state,
  );
  const schedule = normalizeEngagementSchedule(engagement.schedule);

  let currentStep: ProjectSnapshot['currentStep'] = null;
  if (current) {
    const gate = getStepGate(gates, current.id);
    const window = windowForStep(schedule, current.id);
    currentStep = {
      id: current.id,
      title: current.title,
      owner: current.responsibleRole === 'client' ? 'client' : 'lead',
      status: gate.kind === 'active' ? 'waiting on you' : 'with the firm',
      ...(window ? { dueLabel: formatWindow(window) } : {}),
    };
  }

  const today = isoDay(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + UPCOMING_DAYS);
  const upcoming = input.filings
    .filter((f) => !f.filedOn && f.dueDate >= today && f.dueDate <= isoDay(horizon))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 10)
    .map((f) => ({ name: f.particular, dueDate: f.dueDate }));

  const legalForm = (LEGAL_FORMS as readonly string[]).includes(engagement.entityLegalForm ?? '')
    ? (engagement.entityLegalForm as LegalForm)
    : 'company';

  return projectSnapshotSchema.parse({
    companyName: engagement.companyName,
    legalForm,
    residency: engagement.companyType === 'foreign' ? 'foreign' : 'domestic',
    hasForeignParent: engagement.ownershipType !== 'independent' && engagement.companyType === 'foreign',
    currentPhase: phase ? (PHASE_BY_ID[phase.id] ?? 'Compliance') : 'Compliance',
    currentStep,
    completedStepCount: progress.done,
    totalActiveSteps: progress.total,
    incorporated,
    ...(upcoming.length > 0 ? { upcomingCompliances: upcoming } : {}),
  });
}
