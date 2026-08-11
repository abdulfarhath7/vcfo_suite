import { addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns';

import {
  defaultAgmDateForFy,
  getFyPeriods,
  parseIso,
  toIso,
} from '@/lib/compliance/fy-periods';
import { COMPLIANCE_OBLIGATIONS, obligationApplies } from '@/lib/compliance/obligations-seed';
import type {
  ComplianceInstance,
  ComplianceObligation,
  ComplianceStatus,
  DueRule,
  EngagementComplianceTriggers,
  EntityLegalForm,
  FyPeriod,
} from '@/lib/compliance/types';

const HORIZON_MONTHS = 24;
// How far back to surface already-due filings. Prevents an engagement whose
// incorporation/registration dates are years in the past from generating a
// decade of "overdue" instances (UX noise + unbounded storage).
const PAST_HORIZON_MONTHS = 12;

function triggerDate(
  obligation: ComplianceObligation,
  triggers: EngagementComplianceTriggers,
): string | null {
  switch (obligation.triggerType) {
    case 'fy_end':
    case 'incorporation':
      return triggers.incorporationDate ?? null;
    case 'gst_registration':
      return triggers.gstRegistrationDate ?? null;
    case 'tds_liability':
      return triggers.tdsLiabilityStartDate ?? triggers.tanRegistrationDate ?? null;
    case 'pf_registration':
      return triggers.pfRegistrationDate ?? null;
    case 'esi_registration':
      return triggers.esiRegistrationDate ?? null;
    case 'pt_registration':
      return triggers.ptRegistrationDate ?? null;
    case 'fixed_annual':
      return triggers.incorporationDate ?? '2000-01-01';
    case 'event':
    case 'manual':
      return null;
    default:
      return null;
  }
}

function deriveStatus(dueDate: string, today = new Date()): ComplianceStatus {
  const due = parseIso(dueDate);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due < now ? 'overdue' : 'upcoming';
}

function fixedDateInYear(month: number, day: number, year: number): Date {
  return new Date(year, month, day);
}

function nthDayNextMonth(periodEnd: Date, nth: number): Date {
  const next = addMonths(startOfMonth(periodEnd), 1);
  return new Date(next.getFullYear(), next.getMonth(), nth);
}

function agmForPeriod(
  fy: FyPeriod,
  triggers: EngagementComplianceTriggers,
): Date {
  if (triggers.agmDate) return parseIso(triggers.agmDate);
  return defaultAgmDateForFy(fy.end);
}

function pushInstance(
  out: ComplianceInstance[],
  base: Omit<ComplianceInstance, 'id' | 'dueDate' | 'status'>,
  dueDate: Date,
  extra?: Partial<ComplianceInstance>,
): void {
  const iso = toIso(dueDate);
  out.push({
    ...base,
    ...extra,
    id: `${base.engagementId}:${base.obligationId}:${iso}:${extra?.periodLabel ?? ''}`,
    dueDate: iso,
    status: deriveStatus(iso),
  });
}

function generateFixedAnnual(
  obligation: ComplianceObligation,
  rule: Extract<DueRule, { kind: 'fixed-calendar-date' }>,
  input: GeneratorInput,
  out: ComplianceInstance[],
): void {
  const anchor = triggerDate(obligation, input.triggers);
  if (!anchor) return;

  const startYear = parseIso(anchor).getFullYear();
  const endYear = input.horizonEnd.getFullYear() + 1;

  for (let year = startYear; year <= endYear; year += 1) {
    const due = fixedDateInYear(rule.month, rule.day, year);
    if (due < parseIso(anchor) || due > input.horizonEnd) continue;
    pushInstance(out, input.base(obligation), due, {
      periodLabel: `${obligation.particular} ${year}`,
    });
  }
}

function generateMonthlyFromAnchor(
  obligation: ComplianceObligation,
  rule: Extract<DueRule, { kind: 'nth-day-next-month' }>,
  anchorIso: string,
  input: GeneratorInput,
  out: ComplianceInstance[],
): void {
  const anchor = parseIso(anchorIso);
  let periodStart = startOfMonth(anchor);

  while (periodStart <= input.horizonEnd) {
    const periodEnd = endOfMonth(periodStart);
    if (periodEnd >= anchor) {
      const due = nthDayNextMonth(periodEnd, rule.day);
      if (due <= input.horizonEnd) {
        pushInstance(out, input.base(obligation), due, {
          periodStart: toIso(periodStart),
          periodEnd: toIso(periodEnd),
          periodLabel: periodStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        });
      }
    }
    periodStart = addMonths(periodStart, 1);
  }
}

function generateFyEnd(
  obligation: ComplianceObligation,
  rule: DueRule,
  input: GeneratorInput,
  out: ComplianceInstance[],
): void {
  const inc = input.triggers.incorporationDate;
  if (!inc) return;

  const periods = getFyPeriods(inc, input.horizonEnd);

  for (const fy of periods) {
    const fyExtra = { fyLabel: fy.short ? `${fy.label} (Short)` : fy.label };

    if (rule.kind === 'days-after-fy-end') {
      const due = addDays(fy.end, rule.days);
      if (due <= input.horizonEnd) {
        pushInstance(out, input.base(obligation), due, {
          ...fyExtra,
          periodStart: toIso(fy.start),
          periodEnd: toIso(fy.end),
          periodLabel: `ITR ${fy.label}`,
        });
      }
    } else if (rule.kind === 'days-after-agm') {
      const agm = agmForPeriod(fy, input.triggers);
      const due = addDays(agm, rule.days);
      if (due <= input.horizonEnd) {
        pushInstance(out, input.base(obligation), due, {
          ...fyExtra,
          periodStart: toIso(fy.start),
          periodEnd: toIso(fy.end),
          periodLabel: `${obligation.particular} ${fy.label}`,
        });
      }
    } else if (rule.kind === 'fixed-calendar-date') {
      const due = fixedDateInYear(rule.month, rule.day, fy.end.getFullYear());
      if (due > fy.end && due <= input.horizonEnd) {
        pushInstance(out, input.base(obligation), due, {
          ...fyExtra,
          periodStart: toIso(fy.start),
          periodEnd: toIso(fy.end),
          periodLabel: `${obligation.particular} ${fy.label}`,
        });
      }
    }
  }
}

interface GeneratorInput {
  engagementId: string;
  entityLegalForm: EntityLegalForm;
  triggers: EngagementComplianceTriggers;
  ownerId: string;
  horizonEnd: Date;
  base: (obligation: ComplianceObligation) => Omit<ComplianceInstance, 'id' | 'dueDate' | 'status'>;
}

export interface GenerateInstancesInput {
  engagementId: string;
  entityLegalForm: EntityLegalForm;
  triggers: EngagementComplianceTriggers;
  ownerId: string;
  asOfDate?: Date;
  horizonMonths?: number;
}

export function generateComplianceInstances(input: GenerateInstancesInput): ComplianceInstance[] {
  const asOf = input.asOfDate ?? new Date();
  const horizonEnd = addMonths(asOf, input.horizonMonths ?? HORIZON_MONTHS);
  const horizonStart = toIso(startOfMonth(addMonths(asOf, -PAST_HORIZON_MONTHS)));
  const out: ComplianceInstance[] = [];

  const genInput: GeneratorInput = {
    engagementId: input.engagementId,
    entityLegalForm: input.entityLegalForm,
    triggers: input.triggers,
    ownerId: input.ownerId,
    horizonEnd,
    base: (obligation) => ({
      engagementId: input.engagementId,
      obligationId: obligation.id,
      filing: obligation.particular,
      authority: obligation.authority,
      frequency: obligation.frequency,
      ownerId: input.ownerId,
      penaltyRisk: obligation.penaltyRisk,
    }),
  };

  for (const obligation of COMPLIANCE_OBLIGATIONS) {
    if (!obligationApplies(obligation, input.entityLegalForm)) continue;
    if (obligation.triggerType === 'manual' || obligation.triggerType === 'event') continue;

    const anchor = triggerDate(obligation, input.triggers);
    if (!anchor && obligation.triggerType !== 'fixed_annual') continue;

    const { dueRule } = obligation;

    if (obligation.triggerType === 'fy_end') {
      generateFyEnd(obligation, dueRule, genInput, out);
      continue;
    }

    if (dueRule.kind === 'fixed-calendar-date') {
      generateFixedAnnual(obligation, dueRule, genInput, out);
      continue;
    }

    if (dueRule.kind === 'nth-day-next-month' && anchor) {
      generateMonthlyFromAnchor(obligation, dueRule, anchor, genInput, out);
    }
  }

  return out
    .filter((instance) => instance.dueDate >= horizonStart)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
