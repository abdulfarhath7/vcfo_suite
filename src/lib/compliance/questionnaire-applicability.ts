import { registrationRule, RULED_REGISTRATIONS } from '@/data/registration-rules';

/**
 * Which statutory obligations the compliance questionnaire rules out for one engagement.
 *
 * The owner's rule: a new company carries every statutory compliance for its legal form, and the
 * questionnaire only takes obligations away once it is answered. An unanswered question never
 * removes anything, so an empty (or cleared) questionnaire means "all of them".
 *
 * Each obligation is linked to one or more groups of questions. A group rules the obligation out
 * when at least one of its questions is answered and every answered one is No. The obligation is
 * ruled out only when every group linked to it rules it out, so a single Yes keeps it.
 *
 * The groups come from the registration rules (`src/data/registration-rules.ts`: a registration's
 * `questions` decide the obligations it `starts`) plus the direct links below, for obligations a
 * question answers without a registration in between.
 *
 * Pure: shared by the generator job, the client-side calendar and the "obligations to come" list.
 */

type Answers = Record<string, unknown> | null | undefined;

const DIRECT_LINKS: Array<{ questions: string[]; obligations: string[] }> = [
  {
    questions: ['TAX-01'],
    obligations: ['it-tds-payment', 'it-tds-return-q1', 'it-tds-return-q2', 'it-tds-return-q3', 'it-tds-return-q4', 'it-form-16'],
  },
  {
    questions: ['TAX-04'],
    obligations: ['it-advance-tax-q1', 'it-advance-tax-q2', 'it-advance-tax-q3', 'it-advance-tax-q4'],
  },
  { questions: ['MSME-02'], obligations: ['mca-msme-1-apr', 'mca-msme-1-oct'] },
];

function buildGroups(): Map<string, string[][]> {
  const groups = new Map<string, string[][]>();
  const add = (obligationId: string, questions: string[]) => {
    const list = groups.get(obligationId) ?? [];
    list.push(questions);
    groups.set(obligationId, list);
  };
  for (const stepId of RULED_REGISTRATIONS) {
    const rule = registrationRule(stepId);
    if (!rule?.questions?.length) continue;
    for (const id of rule.starts) add(id, rule.questions);
  }
  for (const link of DIRECT_LINKS) for (const id of link.obligations) add(id, link.questions);
  return groups;
}

const GROUPS = buildGroups();

/** The question groups linked to an obligation; empty when no question decides it. */
export function obligationQuestionGroups(obligationId: string): readonly string[][] {
  return GROUPS.get(obligationId) ?? [];
}

function groupRulesOut(questions: string[], answers: Record<string, unknown>): boolean {
  const given = questions.map((q) => answers[q]).filter((v) => v === true || v === false);
  return given.length > 0 && given.every((v) => v === false);
}

/** True when the questionnaire answers say this obligation does not apply. */
export function obligationRuledOut(obligationId: string, answers: Answers): boolean {
  if (!answers || typeof answers !== 'object') return false;
  const groups = GROUPS.get(obligationId);
  if (!groups?.length) return false;
  return groups.every((g) => groupRulesOut(g, answers as Record<string, unknown>));
}

/** A predicate for `generateComplianceInstances`: which obligations to leave out. */
export function questionnaireExclusion(answers: Answers): (obligationId: string) => boolean {
  return (obligationId) => obligationRuledOut(obligationId, answers);
}

/** The obligations a question helps decide, for the "Decides" hint beside each question. */
export function questionObligationIds(questionId: string): string[] {
  const ids: string[] = [];
  for (const [obligationId, groups] of GROUPS) {
    if (groups.some((g) => g.includes(questionId))) ids.push(obligationId);
  }
  return ids;
}
