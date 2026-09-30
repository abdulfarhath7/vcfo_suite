'use client';

import { useEffect, useRef } from 'react';
import { AssistAnswerCard } from './AssistAnswerCard';
import { AssistHandoffForm } from './AssistHandoffForm';
import { useAssistOptional } from './assist-context';
import { AssistUserBubble } from './AssistUserBubble';

/** Message list + progress label (U2), announced politely to screen readers. */
export function AssistThread() {
  const assist = useAssistOptional();
  const endRef = useRef<HTMLDivElement>(null);
  const count = assist?.thread.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [count, assist?.status, assist?.handoffDraft]);
  if (!assist) return null;

  let lastQuestion = '';
  return (
    <div className="space-y-3">
      {assist.thread.map((item) => {
        if (item.kind === 'user') {
          lastQuestion = item.text;
          return <AssistUserBubble key={item.id} text={item.text} />;
        }
        if (item.kind === 'error') {
          return (
            <p key={item.id} role="alert" className="rounded-[var(--radius-md)] bg-danger-light px-3 py-2 text-[12.5px] text-danger-text">
              {item.text}
            </p>
          );
        }
        return <AssistAnswerCard key={item.id} answer={item.answer} messageId={item.messageId} lastQuestion={lastQuestion} />;
      })}
      <p aria-live="polite" className="min-h-[1.25rem] text-[12px] text-muted-foreground">
        {assist.busy ? (assist.status ?? 'Working…') : ''}
      </p>
      <AssistHandoffForm key={assist.handoffDraft ?? 'none'} />
      <div ref={endRef} />
    </div>
  );
}
