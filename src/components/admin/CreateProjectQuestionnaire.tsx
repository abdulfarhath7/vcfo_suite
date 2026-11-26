'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import {
  QUESTIONNAIRE_SECTIONS,
  questionnaireProgress,
  sectionProgress,
  setAnswer,
  visibleQuestions,
  type QuestionnaireAnswers,
  type QuestionnaireQuestion,
} from '@/data/compliance-questionnaire';
import { cn } from '@/lib/utils';
import { tabStateClass } from '@/components/ui/tab-classes';

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

function QuestionRow({
  question,
  answers,
  onChange,
  hint,
  focused,
}: {
  question: QuestionnaireQuestion;
  answers: QuestionnaireAnswers;
  onChange: (next: QuestionnaireAnswers) => void;
  hint?: ReactNode;
  focused?: boolean;
}) {
  const value = answers[question.id];
  const set = (next: boolean | number | string | null) =>
    onChange(setAnswer(answers, question.id, next));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focused]);

  return (
    <div
      ref={ref}
      id={`question-${question.id}`}
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5',
        focused && '-mx-4 bg-highlight-soft px-4',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-ink">{question.label}</p>
        {hint ? <div className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">{hint}</div> : null}
      </div>

      {question.kind === 'boolean' ? (
        <SegmentedPicker
          value={value === true ? 'yes' : value === false ? 'no' : null}
          options={YES_NO}
          onChange={(next) => set(next === 'yes')}
          ariaLabel={question.label}
          size="sm"
          className="w-[8.5rem] shrink-0"
        />
      ) : null}

      {question.kind === 'picklist' && question.options ? (
        <SegmentedPicker
          value={typeof value === 'string' && value ? value : null}
          options={question.options.map((o) => ({ value: o, label: o }))}
          onChange={(next) => set(next)}
          ariaLabel={question.label}
          size="sm"
          className="w-[15rem] shrink-0"
        />
      ) : null}

      {question.kind === 'number' ? (
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            set(raw === '' ? null : Math.max(0, Number(raw)));
          }}
          aria-label={question.label}
          className="h-8 w-[8.5rem] shrink-0 text-[13px]"
        />
      ) : null}
    </div>
  );
}

/**
 * The compliance questionnaire, one tab per lettered section so the whole thing never becomes a
 * long scroll. Conditional questions appear and disappear as their parent is answered.
 *
 * It is step 4 of the create and edit project form (`layout="tabs"`, sections across the top) and
 * the Questionnaire tab of the project record (`layout="side"`, sections down the left, see
 * `src/views/client-record/RecordQuestionnaire.tsx`). `focusQuestionId` opens the section that
 * holds that question and marks it; `renderHint` adds a muted line under a question.
 */
export function CreateProjectQuestionnaire({
  answers,
  onChange,
  layout = 'tabs',
  focusQuestionId,
  renderHint,
}: {
  answers: QuestionnaireAnswers;
  onChange: (next: QuestionnaireAnswers) => void;
  layout?: 'tabs' | 'side';
  focusQuestionId?: string | null;
  renderHint?: (question: QuestionnaireQuestion) => ReactNode;
}) {
  const focusSectionId = focusQuestionId
    ? QUESTIONNAIRE_SECTIONS.find((s) => s.questions.some((q) => q.id === focusQuestionId))?.id
    : undefined;
  const [activeId, setActiveId] = useState(focusSectionId ?? QUESTIONNAIRE_SECTIONS[0].id);
  useEffect(() => {
    if (focusSectionId) setActiveId(focusSectionId);
  }, [focusSectionId]);
  const side = layout === 'side';
  const active = QUESTIONNAIRE_SECTIONS.find((s) => s.id === activeId) ?? QUESTIONNAIRE_SECTIONS[0];
  const questions = visibleQuestions(active, answers);
  const answered = questionnaireProgress(answers).answered;
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-4">
      {/* Clearing empties every answer, so the project falls back to all statutory compliances. */}
      {answered > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2 text-[12.5px] text-ink-muted">
          {confirmClear ? (
            <>
              <span>Clear all {answered} answers? Every statutory compliance applies again.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                Keep
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-danger"
                onClick={() => {
                  onChange({});
                  setConfirmClear(false);
                }}
              >
                Clear answers
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Clear questionnaire
            </Button>
          )}
        </div>
      ) : null}
      <div className={cn(side && 'grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start')}>
      <div
        role="tablist"
        aria-label="Questionnaire sections"
        aria-orientation={side ? 'vertical' : 'horizontal'}
        className={cn(
          'flex gap-1 rounded-lg bg-surface-sunken/40 p-1 ring-1 ring-line/80',
          side ? 'flex-wrap md:flex-col md:flex-nowrap' : 'flex-wrap',
        )}
      >
        {QUESTIONNAIRE_SECTIONS.map((section) => {
          const isActive = section.id === active.id;
          const progress = sectionProgress(section, answers);
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(section.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] transition-colors',
                side ? 'rounded-md md:justify-between md:text-left' : 'rounded-t-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                // GL-03: the shared open-tab look (underline, bold brand text).
                tabStateClass(isActive),
              )}
            >
              {section.title}
              {progress.complete ? (
                <Check className="h-3 w-3 text-positive" strokeWidth={3} aria-hidden />
              ) : (
                <span className="tabular-nums text-[10.5px] text-ink-muted">
                  {progress.answered}/{progress.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-line/60 rounded-xl border border-line/70 px-4">
        {questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            answers={answers}
            onChange={onChange}
            hint={renderHint?.(question)}
            focused={question.id === focusQuestionId}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
