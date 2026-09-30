'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { sendHandoff } from '@/hooks/ask/ask-api';
import { useAskOptional } from './ask-context';

/** T5: "Ask my lead", pre-filled with the question Ask VCFO could not settle. */
export function AskHandoffForm() {
  const ask = useAskOptional();
  const [text, setText] = useState(ask?.handoffDraft ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!ask || ask.handoffDraft === null || ask.shell !== 'client' || !ask.engagementId) return null;

  if (state === 'sent') {
    return (
      <div role="status" className="flex items-center gap-2 rounded-[var(--radius-md)] bg-success-light px-3 py-2 text-[12.5px] text-success-text">
        <Check className="h-3.5 w-3.5" aria-hidden /> Sent to your project lead. They'll reply by email.
        <button type="button" className="ml-auto underline" onClick={() => ask.setHandoffDraft(null)}>
          Close
        </button>
      </div>
    );
  }

  const context = ask.thread
    .slice(-4)
    .map((item) =>
      item.kind === 'user' ? `Client: ${item.text}` : item.kind === 'assistant' ? `Ask VCFO: ${item.answer.line}` : '',
    )
    .filter(Boolean)
    .join('\n');

  return (
    <form
      className="space-y-2 rounded-[var(--radius-md)] border border-border bg-panel p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setState('sending');
        setError(null);
        try {
          await sendHandoff({
            engagementId: ask.engagementId!,
            question: text.trim(),
            conversationId: ask.conversationId ?? undefined,
            context,
          });
          setState('sent');
        } catch (err) {
          setError((err as Error).message || 'Could not send your question. Please try again.');
          setState('error');
        }
      }}
    >
      <label htmlFor="ask-handoff" className="block text-[12.5px] font-medium text-foreground">
        Ask your project lead
      </label>
      <textarea
        id="ask-handoff"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        className="w-full resize-none rounded-[var(--radius-md)] border border-input bg-background px-2.5 py-2 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {error && (
        <p role="alert" className="text-[12px] text-danger-text">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => ask.setHandoffDraft(null)}
          className="min-h-[36px] rounded-[var(--radius-md)] px-3 text-[12.5px] text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={state === 'sending' || !text.trim()}
          className="min-h-[36px] rounded-[var(--radius-md)] border border-border px-3 text-[12.5px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Send to lead'}
        </button>
      </div>
    </form>
  );
}
