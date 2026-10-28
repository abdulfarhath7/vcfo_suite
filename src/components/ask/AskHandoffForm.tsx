'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div role="status" className="flex items-center gap-2 rounded-md bg-positive-soft px-3 py-2 text-[13px] text-positive">
        <Check className="h-4 w-4 flex-none" strokeWidth={1.6} aria-hidden /> Sent to your project lead. Reply comes by email.
        <button type="button" className="ml-auto font-medium underline underline-offset-2" onClick={() => ask.setHandoffDraft(null)}>
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
      className="grid gap-2 rounded-md border-1.5 border-line bg-surface-sunken p-3"
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
          setError((err as Error).message || 'Could not send your question. Try again.');
          setState('error');
        }
      }}
    >
      <label htmlFor="ask-handoff" className="block text-[13px] font-medium text-ink">
        Ask your project lead
      </label>
      <textarea
        id="ask-handoff"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        className="w-full resize-none rounded-md border-1.5 border-line-strong bg-surface-raised px-3 py-2 text-[13px] text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
      />
      <span className="text-[12px] text-ink-muted">The last 4 messages go with it.</span>
      {error && (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => ask.setHandoffDraft(null)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={state === 'sending' || !text.trim()}>
          {state === 'sending' ? 'Sending…' : 'Send to lead'}
        </Button>
      </div>
    </form>
  );
}
