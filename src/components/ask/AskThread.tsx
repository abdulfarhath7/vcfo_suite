'use client';

import { useEffect, useRef } from 'react';
import { PREVIEW_CLIENT_LINE } from '@/lib/ask/preview';
import { AskAnswerCard } from './AskAnswerCard';
import { AskPreviewPicker } from './AskPreviewPicker';
import { AskHandoffForm } from './AskHandoffForm';
import { useAskOptional } from './ask-context';
import { AskUserBubble } from './AskUserBubble';

/** Message list + progress label (U2), announced politely to screen readers. Spectrum look from the prototype AskThread. */
export function AskThread() {
  const ask = useAskOptional();
  const endRef = useRef<HTMLDivElement>(null);
  const count = ask?.thread.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [count, ask?.status, ask?.handoffDraft]);
  if (!ask) return null;

  let lastQuestion = '';
  return (
    <div className="grid gap-3">
      {ask.thread.map((item) => {
        if (item.kind === 'user') {
          lastQuestion = item.text;
          return <AskUserBubble key={item.id} text={item.text} />;
        }
        if (item.kind === 'error') {
          return (
            <p key={item.id} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {item.text}
            </p>
          );
        }
        if (item.answer.line === PREVIEW_CLIENT_LINE && ask.shell === 'super') {
          return (
            <div key={item.id} className="space-y-2">
              <p className="text-[13px] text-ink">{item.answer.line}</p>
              <AskPreviewPicker />
            </div>
          );
        }
        return <AskAnswerCard key={item.id} answer={item.answer} messageId={item.messageId} lastQuestion={lastQuestion} />;
      })}
      <div aria-live="polite" className="min-h-[1.25rem]">
        {ask.busy ? (
          <p className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2 text-[12.5px] font-medium text-ink">
            <span className="h-1.5 w-1.5 flex-none animate-pulse rounded-[2px] bg-brand" aria-hidden />
            {ask.status ?? 'Working…'}
          </p>
        ) : null}
      </div>
      <AskHandoffForm key={ask.handoffDraft ?? 'none'} />
      <div ref={endRef} />
    </div>
  );
}
