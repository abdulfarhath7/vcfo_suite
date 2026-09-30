'use client';

import type { ProjectSnapshot } from '@/data/ask/schema';
import { useAskSuggestions } from '@/hooks/ask/use-ask-suggestions';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

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

/** Greeting, the client's project card and grouped pre-kept questions. */
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
      {snapshot && !compact && <ProjectCard snapshot={snapshot} />}
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
