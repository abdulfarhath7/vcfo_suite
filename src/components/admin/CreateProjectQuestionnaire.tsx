'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import {
  QUESTIONNAIRE_SECTIONS,
  sectionProgress,
  setAnswer,
  visibleQuestions,
  type QuestionnaireAnswers,
  type QuestionnaireQuestion,
} from '@/data/compliance-questionnaire';
import { cn } from '@/lib/utils';

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

function QuestionRow({
  question,
  answers,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answers: QuestionnaireAnswers;
  onChange: (next: QuestionnaireAnswers) => void;
}) {
  const value = answers[question.id];
  const set = (next: boolean | number | string | null) =>
    onChange(setAnswer(answers, question.id, next));

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">{question.label}</p>

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
 * Step 4 — the compliance questionnaire, one tab per lettered section so the
 * whole thing never becomes a long scroll. Conditional questions appear and
 * disappear as their parent is answered.
 */
export function CreateProjectQuestionnaire({
  answers,
  onChange,
}: {
  answers: QuestionnaireAnswers;
  onChange: (next: QuestionnaireAnswers) => void;
}) {
  const [activeId, setActiveId] = useState(QUESTIONNAIRE_SECTIONS[0].id);
  const active = QUESTIONNAIRE_SECTIONS.find((s) => s.id === activeId) ?? QUESTIONNAIRE_SECTIONS[0];
  const questions = visibleQuestions(active, answers);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Questionnaire sections"
        className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1 ring-1 ring-border/80"
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
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-panel text-ink shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {section.title}
              {progress.complete ? (
                <Check className="h-3 w-3 text-success" strokeWidth={3} aria-hidden />
              ) : (
                <span className="tabular-nums text-[10.5px] text-muted-foreground">
                  {progress.answered}/{progress.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-border/60 rounded-xl border border-border/70 px-4">
        {questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            answers={answers}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
