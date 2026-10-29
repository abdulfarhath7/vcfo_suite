import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementComplianceTriggers } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { QUESTIONNAIRE_SECTIONS } from '@/data/compliance-questionnaire';
import { RULED_REGISTRATIONS, registrationRule, type RegistrationTrigger } from '@/data/registration-rules';
import { COMPLIANCE_OBLIGATIONS, obligationApplies } from '@/lib/compliance/obligations-seed';
import type { EntityLegalForm } from '@/lib/compliance/types';
import { areaOf, authorityName, displayName, freqLabel, type AreaCode } from '@/lib/client-portal/compliances';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { scopeEngagement } from '@/db/repositories/compliance-subject-scope';

/**
 * REGISTRATION APPLICABILITY (C-395, C-426, C-500, S-813, S-814) — why each registration
 * applies, what it starts, and the obligations a client will have once incorporated.
 *
 * The rules are static (`src/data/registration-rules.ts`); the per-client part is stored:
 * the compliance questionnaire answers on the engagement (`engagements.compliance_questionnaire`)
 * say whether the registration applies, and `engagement_compliance_triggers` holds the date a
 * registration started its filings. The obligations come from the static obligation library
 * (`src/lib/compliance/obligations-seed.ts`), kept to the engagement's legal form.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   Staff on engagements `assertEngagementAccess` allows; a client on its own engagement
 *   (`scopeEngagement`). Anything else reads as null. Read only.
 */

export interface StartedObligation {
  id: string;
  name: string;
  particular: string;
  /** The library's compliance area ('GST', 'Income Tax'), for the field lists. */
  complianceArea: string;
  area: AreaCode;
  authority: string;
  authorityName: string;
  frequency: string;
  freqLabel: string;
  penaltyRisk: string;
  /** The registration step that starts it, when one does. */
  startedBy: { stepId: string; name: string } | null;
}

export interface RegistrationApplicability {
  /** true: the questionnaire says it applies; false: it says it does not; null: not answered. */
  applies: boolean | null;
  why: string;
  rule: string;
  notNeeded: string;
  answers: Array<{ question: string; label: string; value: string }>;
  /** The date stored on the compliance triggers for this registration, yyyy-mm-dd. */
  startsOn: string | null;
  starts: StartedObligation[];
}

export interface ComplianceStarts {
  engagementId: string;
  incorporated: boolean;
  byStep: Record<string, RegistrationApplicability>;
  /** Every obligation the engagement will carry once incorporated (before-COI tiles). */
  upcoming: StartedObligation[];
}

const QUESTION_LABEL = new Map(QUESTIONNAIRE_SECTIONS.flatMap((s) => s.questions.map((q) => [q.id, q.label] as const)));

function answerText(v: unknown): string | null {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

function toStarted(id: string, startedBy: StartedObligation['startedBy']): StartedObligation | null {
  const o = COMPLIANCE_OBLIGATIONS.find((x) => x.id === id);
  if (!o) return null;
  return {
    id: o.id,
    name: displayName(o.particular),
    particular: o.particular,
    complianceArea: o.complianceArea,
    area: areaOf(o.authority, o.complianceArea),
    authority: o.authority,
    authorityName: authorityName(o.authority),
    frequency: o.frequency,
    freqLabel: freqLabel(o.frequency),
    penaltyRisk: o.penaltyRisk,
    startedBy,
  };
}

export async function getComplianceStarts(ctx: AuthContext, engagementId?: string | null): Promise<ComplianceStarts | null> {
  const scope = await scopeEngagement(ctx, engagementId);
  if (!scope) return null;
  const { row, dbId } = scope;
  const form = ((row.entityLegalForm as EntityLegalForm | null) ?? 'company') as EntityLegalForm;
  const answers = (row.complianceQuestionnaire && typeof row.complianceQuestionnaire === 'object' ? row.complianceQuestionnaire : {}) as Record<string, unknown>;
  const [triggers] = await db.select().from(engagementComplianceTriggers).where(eq(engagementComplianceTriggers.engagementId, dbId)).limit(1);
  const dateOf = (t: RegistrationTrigger | undefined): string | null => {
    if (!t || !triggers) return null;
    const v = triggers[t];
    return typeof v === 'string' ? v.slice(0, 10) : null;
  };
  const applicable = new Set(COMPLIANCE_OBLIGATIONS.filter((o) => obligationApplies(o, form)).map((o) => o.id));

  const byStep: Record<string, RegistrationApplicability> = {};
  const startedBy = new Map<string, StartedObligation['startedBy']>();
  for (const stepId of RULED_REGISTRATIONS) {
    const rule = registrationRule(stepId)!;
    const stepName = getItem(stepId)?.title ?? stepId;
    const given = (rule.questions ?? [])
      .map((q) => ({ question: q, label: QUESTION_LABEL.get(q) ?? q, value: answerText(answers[q]) }))
      .filter((a): a is { question: string; label: string; value: string } => a.value !== null);
    const applies = given.some((a) => a.value === 'Yes') ? true : given.length && given.every((a) => a.value === 'No') ? false : null;
    const starts = rule.starts
      .filter((id) => applicable.has(id))
      .map((id) => toStarted(id, { stepId, name: stepName }))
      .filter((x): x is StartedObligation => Boolean(x));
    if (applies !== false) for (const o of starts) if (!startedBy.has(o.id)) startedBy.set(o.id, { stepId, name: stepName });
    byStep[stepId] = { applies, why: rule.why, rule: rule.rule, notNeeded: rule.notNeeded, answers: given, startsOn: dateOf(rule.trigger), starts };
  }

  // The obligations to come: every one for the legal form, except those whose registration the
  // questionnaire rules out, and the conditional foreign-investment ones without a Yes.
  const ruledOut = new Set(
    Object.entries(byStep)
      .filter(([, a]) => a.applies === false)
      .flatMap(([, a]) => a.starts.map((o) => o.id)),
  );
  const foreign = ['FI-01', 'FI-04'].some((q) => answers[q] === true);
  const upcoming = COMPLIANCE_OBLIGATIONS.filter((o) => applicable.has(o.id))
    .filter((o) => !ruledOut.has(o.id) || startedBy.has(o.id))
    .filter((o) => !o.isConditional || foreign)
    .map((o) => toStarted(o.id, startedBy.get(o.id) ?? null))
    .filter((x): x is StartedObligation => Boolean(x));

  return {
    engagementId: appEngagementId(dbId),
    incorporated: Boolean(row.incorporationDate),
    byStep,
    upcoming,
  };
}
