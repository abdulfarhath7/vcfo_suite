import { describe, expect, it } from 'vitest';
import {
  ALL_QUESTIONS,
  QUESTIONNAIRE_SECTIONS,
  isQuestionVisible,
  prunedAnswers,
  questionnaireProgress,
  sectionProgress,
  setAnswer,
  visibleQuestions,
} from './compliance-questionnaire';

const sectionById = (id: string) => {
  const section = QUESTIONNAIRE_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`no section ${id}`);
  return section;
};

describe('catalogue', () => {
  it('has the seven lettered sections in document order', () => {
    expect(QUESTIONNAIRE_SECTIONS.map((s) => s.letter)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
    ]);
  });

  it('gives every question a unique id', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('drops GST-02 and leaves GST-08 a plain yes/no', () => {
    const ids = sectionById('gst').questions.map((q) => q.id);
    expect(ids).not.toContain('GST-02');
    expect(ids).toEqual(['GST-01', 'GST-03', 'GST-04', 'GST-05', 'GST-06', 'GST-07', 'GST-08']);
    expect(ALL_QUESTIONS.find((q) => q.id === 'GST-08')?.kind).toBe('boolean');
  });

  it('points every condition at a question that exists', () => {
    const ids = new Set(ALL_QUESTIONS.map((q) => q.id));
    for (const q of ALL_QUESTIONS) {
      if (q.showIf) expect(ids.has(q.showIf.id)).toBe(true);
    }
  });

  it('gives the picklist its three options', () => {
    expect(ALL_QUESTIONS.find((q) => q.id === 'FT-06')?.options).toEqual([
      'STPI',
      'Non-STPI',
      'Neither',
    ]);
  });
});

describe('section A branching', () => {
  const sectionA = sectionById('foreign-investment');

  it('asks only 01, 04 and 05 before anything is answered', () => {
    expect(visibleQuestions(sectionA, {}).map((q) => q.id)).toEqual([
      'FI-01',
      'FI-04',
      'FI-05',
    ]);
  });

  it('opens 02, 03 and 06 once FDI is yes', () => {
    expect(visibleQuestions(sectionA, { 'FI-01': true }).map((q) => q.id)).toEqual([
      'FI-01',
      'FI-02',
      'FI-03',
      'FI-04',
      'FI-05',
      'FI-06',
    ]);
  });

  it('keeps them closed on no', () => {
    expect(visibleQuestions(sectionA, { 'FI-01': false }).map((q) => q.id)).toEqual([
      'FI-01',
      'FI-04',
      'FI-05',
    ]);
  });
});

describe('other branches', () => {
  it('gates the GST tail on GST-01', () => {
    const gst = sectionById('gst');
    expect(visibleQuestions(gst, {}).map((q) => q.id)).toEqual(['GST-01']);
    expect(visibleQuestions(gst, { 'GST-01': true })).toHaveLength(7);
    expect(visibleQuestions(gst, { 'GST-01': false })).toHaveLength(1);
  });

  it('gates TP-02 on TP-01 but never TP-03', () => {
    const tp = sectionById('transfer-pricing');
    expect(visibleQuestions(tp, { 'TP-01': false }).map((q) => q.id)).toEqual(['TP-01', 'TP-03']);
    expect(visibleQuestions(tp, { 'TP-01': true }).map((q) => q.id)).toEqual([
      'TP-01',
      'TP-02',
      'TP-03',
    ]);
  });

  it('asks every foreign-trade and employee question unconditionally', () => {
    for (const id of ['foreign-trade', 'employees', 'direct-tax', 'msme']) {
      const section = sectionById(id);
      expect(visibleQuestions(section, {})).toHaveLength(section.questions.length);
    }
  });
});

describe('isQuestionVisible', () => {
  it('treats a missing parent answer as not matching', () => {
    const q = ALL_QUESTIONS.find((x) => x.id === 'FI-02')!;
    expect(isQuestionVisible(q, {})).toBe(false);
    expect(isQuestionVisible(q, { 'FI-01': true })).toBe(true);
  });
});

describe('setAnswer', () => {
  it('clears dependants when the parent flips to no', () => {
    let answers = setAnswer({}, 'FI-01', true);
    answers = setAnswer(answers, 'FI-02', true);
    answers = setAnswer(answers, 'FI-06', false);
    expect(answers['FI-02']).toBe(true);

    answers = setAnswer(answers, 'FI-01', false);
    expect(answers['FI-02']).toBeUndefined();
    expect(answers['FI-06']).toBeUndefined();
    expect(answers['FI-01']).toBe(false);
  });

  it('leaves unconditional answers alone', () => {
    let answers = setAnswer({}, 'FI-04', true);
    answers = setAnswer(answers, 'FI-01', true);
    answers = setAnswer(answers, 'FI-01', false);
    expect(answers['FI-04']).toBe(true);
  });

  it('does not mutate the input', () => {
    const before = { 'FI-01': true, 'FI-02': true };
    const after = setAnswer(before, 'FI-01', false);
    expect(before['FI-02']).toBe(true);
    expect(after['FI-02']).toBeUndefined();
  });
});

describe('progress', () => {
  it('counts only visible questions', () => {
    const gst = sectionById('gst');
    expect(sectionProgress(gst, {})).toEqual({ answered: 0, total: 1, complete: false });
    expect(sectionProgress(gst, { 'GST-01': false })).toEqual({
      answered: 1,
      total: 1,
      complete: true,
    });
    expect(sectionProgress(gst, { 'GST-01': true })).toEqual({
      answered: 1,
      total: 7,
      complete: false,
    });
  });

  it('accepts zero as an answered number', () => {
    const employees = sectionById('employees');
    expect(sectionProgress(employees, { 'EMP-01': 0 }).answered).toBe(1);
  });

  it('rolls up across sections', () => {
    const empty = questionnaireProgress({});
    expect(empty.answered).toBe(0);
    expect(empty.total).toBeGreaterThan(20);
    expect(empty.complete).toBe(false);
  });
});

describe('prunedAnswers', () => {
  it('drops hidden and unanswered entries', () => {
    const answers = { 'FI-01': false, 'FI-02': true, 'FI-04': null, 'GST-01': true };
    expect(prunedAnswers(answers)).toEqual({ 'FI-01': false, 'GST-01': true });
  });

  it('keeps a false answer, which is a real answer', () => {
    expect(prunedAnswers({ 'TAX-01': false })).toEqual({ 'TAX-01': false });
  });
});
