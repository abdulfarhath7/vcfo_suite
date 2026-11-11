'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { fetchReviewStatus, requestAnswerReview } from '@/hooks/ask/ask-api';
import { REVIEW_ACTION_LABEL, REVIEW_STATE_LABEL, reviewRequestBody } from '@/lib/ask/ai-review';

const secondary = buttonVariants({ variant: 'secondary', size: 'sm' });

const storeKey = (messageId: string) => `vcfo.askReview.${messageId}`;

function readStored(messageId: string | null): string | null {
  if (!messageId) return null;
  try {
    return localStorage.getItem(storeKey(messageId));
  } catch {
    return null;
  }
}

/**
 * "Ask my CA to confirm" on a client's AI answer: the question and the answer go to the project
 * lead as an "Ask my lead" task, and the status shows here. The request id is remembered in this
 * browser per answer, so the status survives a reload; the task itself is the record.
 */
export function AskReviewRequest({
  engagementId,
  conversationId,
  messageId,
  question,
  answerText,
}: {
  engagementId: string;
  conversationId: string | null;
  messageId: string | null;
  question?: string;
  answerText: string;
}) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read after mount, so the server render and the first client render agree.
  useEffect(() => {
    const stored = readStored(messageId);
    if (stored) setRequestId(stored);
  }, [messageId]);

  useEffect(() => {
    if (!requestId) return;
    let live = true;
    fetchReviewStatus(requestId)
      .then((s) => live && setLabel(s.label))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [requestId]);

  if (requestId) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
        <ShieldCheck className="h-3.5 w-3.5 flex-none text-brand-text" strokeWidth={1.6} aria-hidden />
        {label ?? REVIEW_STATE_LABEL.sent}
      </p>
    );
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        className={secondary}
        disabled={sending}
        onClick={async () => {
          setSending(true);
          setError(null);
          try {
            const { id } = await requestAnswerReview({
              engagementId,
              conversationId: conversationId ?? undefined,
              ...reviewRequestBody(question, answerText),
            });
            try {
              if (messageId) localStorage.setItem(storeKey(messageId), id);
            } catch {
              // Only the status line after a reload is lost; the task is already with the lead.
            }
            setRequestId(id);
            setLabel(REVIEW_STATE_LABEL.sent);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setSending(false);
          }
        }}
      >
        {sending ? 'Sending…' : REVIEW_ACTION_LABEL}
      </button>
      {error && (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
