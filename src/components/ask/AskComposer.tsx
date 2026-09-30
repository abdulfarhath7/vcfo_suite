'use client';

import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { ASK_VISIBILITY_NOTICE } from '@/lib/ask/question-gaps';
import { useAskOptional } from './ask-context';

/** Input + Send — Send is the only solid primary element in the panel (D1). */
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
        className="flex items-end gap-2 rounded-[var(--radius)] border border-input bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring/40"
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
          className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[13.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || ask.busy}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
      {client && ask.features.A1 && <p className="px-1 text-[11px] text-muted-foreground">{ASK_VISIBILITY_NOTICE}</p>}
      <p className="px-1 text-[11px] text-muted-foreground">
        {client
          ? "Ask VCFO explains; it doesn't give legal advice. Your project lead confirms decisions."
          : 'Ask VCFO reads data only. It never sends email or changes a project.'}
      </p>
    </div>
  );
}
