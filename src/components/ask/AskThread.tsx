'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { PREVIEW_CLIENT_LINE } from '@/lib/ask/preview';
import { AskAnswerCard } from './AskAnswerCard';
import { AskChangesetCard } from './AskChangesetCard';
import { AskGstCard } from './gst/AskGstCard';
import { AskPreviewPicker } from './AskPreviewPicker';
import { AskHandoffForm } from './AskHandoffForm';
import { useApp } from '@/context/AppContext';
import { useAskOptional } from './ask-context';
import { AskAvatar, AskUserBubble } from './AskUserBubble';
import { DropProgress } from './drop/DropProgress';
import { DropRunCards } from './drop/DropRunCards';
import { FillRail } from './fill/FillRail';
import { useFillState } from './fill/fill-store';

/** An answer row: the VCFO mark, then the answer (owner item F2). */
function AnswerRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <AskAvatar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Message list + progress label (U2), announced politely to screen readers. Spectrum look from the prototype AskThread. */
export function AskThread() {
  const ask = useAskOptional();
  const { user } = useApp();
  const endRef = useRef<HTMLDivElement>(null);
  const fill = useFillState();
  const count = ask?.thread.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [count, ask?.status, ask?.handoffDraft, ask?.activeRunId, fill?.runId, fill?.phase]);
  if (!ask) return null;

  let lastQuestion = '';
  return (
    <div className="grid gap-3">
      {ask.thread.map((item) => {
        if (item.kind === 'user') {
          lastQuestion = item.text;
          return <AskUserBubble key={item.id} text={item.text} initials={user?.initials} />;
        }
        if (item.kind === 'error') {
          return (
            <p key={item.id} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {item.text}
            </p>
          );
        }
        if (item.kind === 'changeset') {
          return (
            <AnswerRow key={item.id}>
              <AskChangesetCard changesetId={item.changesetId} />
            </AnswerRow>
          );
        }
        if (item.answer.line === PREVIEW_CLIENT_LINE && ask.shell === 'super') {
          return (
            <AnswerRow key={item.id}>
              <div className="space-y-2">
                <p className="text-[13px] text-ink">{item.answer.line}</p>
                <AskPreviewPicker />
              </div>
            </AnswerRow>
          );
        }
        return (
          <AnswerRow key={item.id}>
            <AskAnswerCard answer={item.answer} messageId={item.messageId} lastQuestion={lastQuestion} />
            {item.answer.changesetId || item.answer.unplaced?.length ? (
              <div className="mt-2 grid gap-2">
                {item.answer.changesetId ? <AskChangesetCard changesetId={item.answer.changesetId} /> : null}
                {item.answer.unplaced?.length ? <UnplacedLines lines={item.answer.unplaced} /> : null}
              </div>
            ) : null}
            {item.answer.gst && ask.shell !== 'client' ? <AskGstCard gst={item.answer.gst} /> : null}
            {item.answer.runId && ask.shell !== 'client' ? <DropRunCards runId={item.answer.runId} shownChangesetId={item.answer.changesetId} /> : null}
          </AnswerRow>
        );
      })}
      {ask.activeRunId && ask.run ? (
        <AnswerRow>
          <DropProgress run={ask.run} />
        </AnswerRow>
      ) : null}
      {ask.shell !== 'client' && fill ? (
        <AnswerRow>
          <FillRail />
        </AnswerRow>
      ) : null}
      <div aria-live="polite" className="min-h-[1.25rem]">
        {ask.busy || (ask.activeRunId && !ask.run) ? (
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

/** The lines of a paste or a file that fit no field: shown with the card, never dropped without a word. */
function UnplacedLines({ lines }: { lines: string[] }) {
  return (
    <section aria-label="I could not place this" className="rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-[12.5px]">
      <p className="font-medium text-ink">I could not place this</p>
      <ul className="mt-1 grid gap-0.5">
        {lines.map((text) => (
          <li key={text} className="break-words text-ink-2">
            {text}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-ink-muted">Say where it goes, or type it on the right step.</p>
    </section>
  );
}
