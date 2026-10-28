'use client';

import { useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { ASK_VISIBILITY_NOTICE } from '@/lib/ask/question-gaps';
import { useAskOptional } from './ask-context';

/** Input + Send — Send is the only solid main button in the panel (D1, R-12). */
export function AskComposer() {
  const ask = useAskOptional();
  const [text, setText] = useState('');
  if (!ask) return null;
  const client = ask.shell === 'client';
  const submit = () => {
    const message = text.trim();
    if (!message || ask.busy) return;
    setText('');
    void ask.ask({ message });
  };
  return (
    <div className="space-y-1.5">
      <form
        className="flex items-end gap-2 rounded-md border-1.5 border-line-strong bg-surface-raised p-1 focus-within:border-brand focus-within:ring-4 focus-within:ring-focus-ring/25"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="ask-composer" className="sr-only">
          Ask VCFO
        </label>
        <textarea
          id="ask-composer"
          rows={1}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={client ? 'Ask about your company setup…' : 'Ask about projects, deadlines or rules…'}
          className="max-h-32 min-h-[32px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || ask.busy}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand shadow-shine hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:opacity-50"
        >
          <SendHorizontal className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </form>
      {/* The client lines are disclosures (who can see the chat, no legal advice), so they stay;
          the staff helper line went with R-06. Staff Ask VCFO still only reads data. */}
      {client && ask.features.A1 && <p className="px-1 text-[12px] text-ink-muted">{ASK_VISIBILITY_NOTICE}</p>}
      {client ? (
        <p className="px-1 text-[12px] text-ink-muted">
          Ask VCFO explains; it doesn&apos;t give legal advice. Your project lead confirms decisions.
        </p>
      ) : null}
    </div>
  );
}
