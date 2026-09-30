'use client';

import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useAssistOptional } from './assist-context';

/** Input + Send — Send is the only solid primary element in the panel (D1). */
export function AssistComposer() {
  const assist = useAssistOptional();
  const [text, setText] = useState('');
  if (!assist) return null;
  const client = assist.shell === 'client';
  const submit = () => {
    const message = text.trim();
    if (!message || assist.busy) return;
    setText('');
    void assist.ask({ message });
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
        <label htmlFor="assist-composer" className="sr-only">
          Ask Assist
        </label>
        <textarea
          id="assist-composer"
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
          disabled={!text.trim() || assist.busy}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
      <p className="px-1 text-[11px] text-muted-foreground">
        {client
          ? "Assist explains; it doesn't give legal advice. Your project lead confirms decisions."
          : 'Assist reads data only. It never sends email or changes a project.'}
      </p>
    </div>
  );
}
