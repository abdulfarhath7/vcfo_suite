'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import type { ProjectSnapshot } from '@/data/ask/schema';
import { fetchLibrary } from '@/hooks/ask/ask-api';
import { useAskSuggestions } from '@/hooks/ask/use-ask-suggestions';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';
import { AskNudgeCard } from './AskNudgeCard';

function ProjectCard({ snapshot }: { snapshot: ProjectSnapshot }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-panel p-3">
      <p className="text-[12px] text-muted-foreground">Your project</p>
      <p className="truncate text-[14px] font-semibold text-foreground">{snapshot.companyName}</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {snapshot.currentPhase}
        {snapshot.currentStep ? ` · ${snapshot.currentStep.title}` : ''} · {snapshot.completedStepCount} of{' '}
        {snapshot.totalActiveSteps} steps done
      </p>
    </div>
  );
}

const SAVED_SHOWN = 5;

/** Answers the client saved; each opens in the full-page reader. */
function SavedAnswers({ onOpen }: { onOpen: () => void }) {
  const query = useQuery({ queryKey: ['ask', 'library'], queryFn: fetchLibrary, retry: false });
  const items = query.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-label="Saved answers">
      <h3 className="mb-1.5 flex items-baseline justify-between text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
        Saved answers
        <span className="font-normal normal-case tracking-normal">{items.length}</span>
      </h3>
      <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-panel">
        {items.slice(0, SAVED_SHOWN).map((item) => (
          <li key={item.id}>
            <Link
              href={`/app/client/library/${item.id}`}
              onClick={onOpen}
              className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
            >
              <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.updated && (
                <span className="shrink-0 rounded-full bg-warning-light px-1.5 py-0.5 text-[10.5px] font-medium text-warning-text">Updated</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > SAVED_SHOWN && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">Showing the {SAVED_SHOWN} most recent of {items.length}.</p>
      )}
    </section>
  );
}

/** Greeting, the client's project card, saved answers and grouped pre-kept questions. */
export function AskHome({ compact = false }: { compact?: boolean }) {
  const ask = useAskOptional();
  const query = useAskSuggestions(ask?.shell ?? null, ask?.engagementId ?? null, Boolean(ask?.enabled));
  if (!ask) return null;
  const suggestions = query.data?.suggestions ?? [];
  const groups = [...new Set(suggestions.map((s) => s.group))];
  const snapshot = query.data?.snapshot ?? null;

  return (
    <div className="space-y-4">
      {!compact && (
        <div>
          <h2 className="font-serif text-[20px] font-semibold text-foreground">
            {ask.shell === 'client' ? 'What would you like to understand?' : 'What do you need to know?'}
          </h2>
          <p className="text-[12.5px] text-muted-foreground">Pick a question or type your own.</p>
        </div>
      )}
      {!compact && <AskNudgeCard />}
      {snapshot && !compact && <ProjectCard snapshot={snapshot} />}
      {ask.shell === 'client' && !compact && !ask.preview && <SavedAnswers onOpen={() => ask.setOpen(false)} />}
      {query.isError && (
        <p role="alert" className="text-[12.5px] text-danger-text">
          Could not load suggestions.
        </p>
      )}
      {groups.map((group) => (
        <section key={group} aria-label={group}>
          {!compact && <h3 className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">{group}</h3>}
          <ul className={cn(compact ? 'flex gap-1.5 overflow-x-auto pb-1' : 'space-y-1.5')}>
            {suggestions
              .filter((s) => s.group === group)
              .map((s) => (
                <li key={s.id} className={cn(compact && 'shrink-0')}>
                  <button
                    type="button"
                    disabled={ask.busy}
                    onClick={() => void ask.ask({ suggestionId: s.id, label: s.label })}
                    className={cn(
                      'min-h-[44px] rounded-[var(--radius-md)] border border-border bg-panel px-3 text-left text-[13px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50',
                      compact ? 'whitespace-nowrap rounded-full' : 'w-full',
                    )}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
