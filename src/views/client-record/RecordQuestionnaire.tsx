'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { CreateProjectQuestionnaire } from '@/components/admin/CreateProjectQuestionnaire';
import { DashSection } from '@/components/dash/DashSection';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import {
  prunedAnswers,
  questionnaireProgress,
  type QuestionnaireAnswers,
  type QuestionnaireQuestion,
} from '@/data/compliance-questionnaire';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';
import { questionObligationIds } from '@/lib/compliance/questionnaire-applicability';
import { errorMessage } from '@/lib/toast-errors';

/**
 * QUESTIONNAIRE TAB of the project record. The same compliance questionnaire as step 4 of the
 * project form, one click from the project instead of behind Edit project. Every answer saves on
 * its own (a short pause first, so typing a number sends one request), through the same
 * `PATCH /api/engagements/<id>` the form uses; that route queues the obligation regenerate job.
 *
 * `?q=<question id>` opens the section that holds the question and marks it, so the
 * "Not answered in the compliance questionnaire" note on a registration can link straight here.
 */

const SAVE_DELAY_MS = 500;
const OBLIGATION_NAME = new Map(COMPLIANCE_OBLIGATIONS.map((o) => [o.id, o.particular]));

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** The obligations a question decides, by name, at most three and then a count. */
function DecidesHint({ question }: { question: QuestionnaireQuestion }) {
  const names = useMemo(
    () => [...new Set(questionObligationIds(question.id).map((id) => OBLIGATION_NAME.get(id)).filter(Boolean))] as string[],
    [question.id],
  );
  if (!names.length) return null;
  const shown = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? ` and ${names.length - 3} more` : '';
  return <>Decides {shown}{more}</>;
}

export function RecordQuestionnaire({ engagement }: { engagement: Engagement }) {
  const { updateEngagement } = useApp();
  const focusQuestionId = useSearchParams().get('q');
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(
    () => (engagement.complianceQuestionnaire ?? {}) as QuestionnaireAnswers,
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<QuestionnaireAnswers | null>(null);
  const inFlight = useRef(false);

  // A different project resets the local copy; the same project keeps what is being typed.
  useEffect(() => {
    setAnswers((engagement.complianceQuestionnaire ?? {}) as QuestionnaireAnswers);
    setSaveState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagement.id]);

  // Saves run one at a time; a change made while one is in flight goes out after it, so the
  // last answer given is always the one stored.
  const flush = useCallback(async () => {
    if (inFlight.current || !pending.current) return;
    const next = pending.current;
    pending.current = null;
    inFlight.current = true;
    setSaveState('saving');
    try {
      await updateEngagement(engagement.id, {
        complianceQuestionnaire: prunedAnswers(next) as Record<string, boolean | number | string>,
      });
      setSaveError(null);
      setSaveState(pending.current ? 'saving' : 'saved');
    } catch (err) {
      setSaveError(errorMessage(err, 'Your answer was not saved. Try again.'));
      setSaveState('error');
      pending.current ??= next;
    } finally {
      inFlight.current = false;
      if (pending.current && !timer.current) void flush();
    }
  }, [engagement.id, updateEngagement]);

  const onChange = useCallback(
    (next: QuestionnaireAnswers) => {
      setAnswers(next);
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Leaving the tab with a save still waiting sends it straight away.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void flush();
      }
    },
    [flush],
  );

  const progress = questionnaireProgress(answers);

  return (
    <DashSection
      title="Compliance questionnaire"
      meta={`${progress.answered} of ${progress.total} answered`}
      right={<SaveStatus state={saveState} error={saveError} onRetry={() => void flush()} />}
    >
      <p className="mb-3 text-[12.5px] text-ink-muted">
        Answers save as you give them. An unanswered question never removes an obligation; a No removes the ones it decides.
      </p>
      <CreateProjectQuestionnaire
        answers={answers}
        onChange={onChange}
        layout="side"
        focusQuestionId={focusQuestionId}
        renderHint={(q) => <DecidesHint question={q} />}
      />
    </DashSection>
  );
}

function SaveStatus({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-positive" role="status">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-danger" role="alert">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        {error}
        <button type="button" className="font-medium underline" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  }
  return null;
}
