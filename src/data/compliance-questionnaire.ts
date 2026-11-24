/**
 * Compliance questionnaire asked while creating a project.
 *
 * Source: "Project Compliance Questionnaire — KP". Section letters follow that
 * document. Two deliberate departures from it:
 *   - GST-02 (annual turnover bracket) is dropped.
 *   - GST-08 (e-invoicing) was "Auto from GST-02"; with GST-02 gone it is a
 *     plain Yes/No.
 *
 * Pure data + pure logic — no React, no DB. The visibility rules live here so
 * the form, any validation, and any later compliance-trigger mapping all read
 * the same table.
 */

type QuestionKind = 'boolean' | 'number' | 'picklist';

export type QuestionAnswer = boolean | number | string | null;

export type QuestionnaireAnswers = Record<string, QuestionAnswer>;

export type QuestionnaireQuestion = {
  id: string;
  label: string;
  kind: QuestionKind;
  /** picklist only. */
  options?: readonly string[];
  /** Shown only when this other question equals this value. Absent = always. */
  showIf?: { id: string; equals: QuestionAnswer };
};

export type QuestionnaireSection = {
  id: string;
  /** Letter from the source document — A … G. */
  letter: string;
  title: string;
  questions: readonly QuestionnaireQuestion[];
};

const yesNo = (id: string, label: string, showIf?: QuestionnaireQuestion['showIf']): QuestionnaireQuestion => ({
  id,
  label,
  kind: 'boolean',
  ...(showIf ? { showIf } : {}),
});

export const QUESTIONNAIRE_SECTIONS: readonly QuestionnaireSection[] = [
  {
    id: 'foreign-investment',
    letter: 'A',
    title: 'Foreign investments',
    questions: [
      yesNo('FI-01', 'Will the entity receive any foreign investment (FDI)?'),
      yesNo('FI-02', 'Will FDI be received during the current financial year?', {
        id: 'FI-01',
        equals: true,
      }),
      yesNo('FI-03', 'Will shares be transferred between resident & non-resident?', {
        id: 'FI-01',
        equals: true,
      }),
      yesNo('FI-04', 'Will the entity have foreign assets OR liabilities as on 31-Mar?'),
      yesNo('FI-05', 'Will the entity make any Overseas Investment (ODI)?'),
      yesNo('FI-06', 'Will there be any downstream / indirect foreign investment?', {
        id: 'FI-01',
        equals: true,
      }),
    ],
  },
  {
    id: 'foreign-trade',
    letter: 'B',
    title: 'Foreign trade',
    questions: [
      yesNo('FT-01', 'Will the entity import goods?'),
      yesNo('FT-02', 'Will the entity export goods?'),
      yesNo('FT-03', 'Will the entity import or export services?'),
      yesNo('FT-04', 'Will the entity make foreign remittances (payments abroad)?'),
      yesNo('FT-05', 'Will the entity take foreign currency borrowings (ECB)?'),
      {
        id: 'FT-06',
        label: 'Will the entity register / operate under STPI or Non-STPI?',
        kind: 'picklist',
        options: ['STPI', 'Non-STPI', 'Neither'],
      },
    ],
  },
  {
    id: 'gst',
    letter: 'C',
    title: 'GST',
    questions: [
      yesNo('GST-01', 'Will the entity register under GST?'),
      yesNo('GST-03', 'Will it opt into the QRMP scheme (quarterly return, monthly pay)?', {
        id: 'GST-01',
        equals: true,
      }),
      yesNo('GST-04', 'Will there be any interstate supplies?', { id: 'GST-01', equals: true }),
      yesNo('GST-05', 'Will there be any exports under GST?', { id: 'GST-01', equals: true }),
      yesNo('GST-06', 'Will there be any reverse-charge (RCM) transactions?', { id: 'GST-01', equals: true }),
      yesNo('GST-07', 'Will there be any supplies to / from SEZ?', { id: 'GST-01', equals: true }),
      yesNo('GST-08', 'Will e-invoicing apply?', { id: 'GST-01', equals: true }),
    ],
  },
  {
    id: 'employees',
    letter: 'D',
    title: 'Employees & payroll',
    questions: [
      { id: 'EMP-01', label: 'Expected number of employees', kind: 'number' },
      yesNo('EMP-02', 'Will employees be in more than one state?'),
      yesNo('EMP-03', 'Will PF (Provident Fund) apply? (>=20 employees)'),
      yesNo('EMP-04', 'Will ESI apply? (>=10 employees & wage threshold)'),
      yesNo('EMP-05', 'Will Professional Tax (PT) apply in the state?'),
      yesNo('EMP-06', 'Will the entity run monthly payroll?'),
      yesNo('EMP-07', 'Will Shops & Establishment registration be required?'),
      yesNo('EMP-08', 'Will Labour Welfare Fund (LWF) apply in the state?'),
      yesNo('EMP-09', 'Will gratuity apply? (>=10 employees)'),
    ],
  },
  {
    id: 'direct-tax',
    letter: 'E',
    title: 'Direct tax',
    questions: [
      yesNo('TAX-01', 'Will the entity deduct TDS?'),
      yesNo('TAX-02', 'Will the entity collect TCS?'),
      yesNo('TAX-03', 'Will a Tax Audit apply? (turnover threshold)'),
      yesNo('TAX-04', 'Will Advance Tax be payable?'),
    ],
  },
  {
    id: 'transfer-pricing',
    letter: 'F',
    title: 'Transfer pricing',
    questions: [
      yesNo('TP-01', 'Will there be international transactions with associated enterprises?'),
      yesNo('TP-02', 'Will it be part of a group with consolidated revenue > 3000 Cr?', {
        id: 'TP-01',
        equals: true,
      }),
      yesNo('TP-03', 'Will there be any specified domestic transactions?'),
    ],
  },
  {
    id: 'msme',
    letter: 'G',
    title: 'MSME & vendors',
    questions: [
      yesNo('MSME-01', 'Will the entity register as an MSME (Udyam)?'),
      yesNo('MSME-02', 'Will the entity buy from MSME vendors?'),
    ],
  },
] as const;

export const ALL_QUESTIONS: readonly QuestionnaireQuestion[] = QUESTIONNAIRE_SECTIONS.flatMap(
  (s) => s.questions,
);

/** A question is visible when it has no condition, or its parent matches. */
export function isQuestionVisible(
  question: QuestionnaireQuestion,
  answers: QuestionnaireAnswers,
): boolean {
  if (!question.showIf) return true;
  return answers[question.showIf.id] === question.showIf.equals;
}

export function visibleQuestions(
  section: QuestionnaireSection,
  answers: QuestionnaireAnswers,
): QuestionnaireQuestion[] {
  return section.questions.filter((q) => isQuestionVisible(q, answers));
}

function isAnswered(question: QuestionnaireQuestion, answers: QuestionnaireAnswers): boolean {
  const value = answers[question.id];
  if (value === null || value === undefined) return false;
  if (question.kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (question.kind === 'picklist') return typeof value === 'string' && value.length > 0;
  return typeof value === 'boolean';
}

export function sectionProgress(
  section: QuestionnaireSection,
  answers: QuestionnaireAnswers,
): { answered: number; total: number; complete: boolean } {
  const visible = visibleQuestions(section, answers);
  const answered = visible.filter((q) => isAnswered(q, answers)).length;
  return { answered, total: visible.length, complete: answered === visible.length };
}

export function questionnaireProgress(answers: QuestionnaireAnswers): {
  answered: number;
  total: number;
  complete: boolean;
} {
  let answered = 0;
  let total = 0;
  for (const section of QUESTIONNAIRE_SECTIONS) {
    const p = sectionProgress(section, answers);
    answered += p.answered;
    total += p.total;
  }
  return { answered, total, complete: total > 0 && answered === total };
}

/**
 * Setting an answer can hide dependants — drop their answers so a stale "Yes"
 * behind a collapsed branch never reaches the server.
 */
export function setAnswer(
  answers: QuestionnaireAnswers,
  id: string,
  value: QuestionAnswer,
): QuestionnaireAnswers {
  const next: QuestionnaireAnswers = { ...answers, [id]: value };
  let changed = true;
  while (changed) {
    changed = false;
    for (const question of ALL_QUESTIONS) {
      if (question.showIf && next[question.id] != null && !isQuestionVisible(question, next)) {
        delete next[question.id];
        changed = true;
      }
    }
  }
  return next;
}

/** Strip anything not currently visible — what actually gets submitted. */
export function prunedAnswers(answers: QuestionnaireAnswers): QuestionnaireAnswers {
  const out: QuestionnaireAnswers = {};
  for (const question of ALL_QUESTIONS) {
    if (!isQuestionVisible(question, answers)) continue;
    const value = answers[question.id];
    if (value === null || value === undefined) continue;
    out[question.id] = value;
  }
  return out;
}
