'use client';

import type { ProjectSnapshot } from '@/data/ask/schema';
import { useAskSuggestions } from '@/hooks/ask/use-ask-suggestions';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

function ProjectCard({ snapshot }: { snapshot: ProjectSnapshot }) {
  return (
    <div className="grid gap-0.5 rounded-md border-1.5 border-line px-3 py-2.5">
      <span className="text-[12px] text-ink-muted">{snapshot.currentPhase}</span>
      <span className="truncate text-[14px] font-medium text-ink">
        {snapshot.currentStep ? snapshot.currentStep.title : snapshot.companyName}
      </span>
      <span className="text-[12px] tabular-nums text-ink-muted">
        {snapshot.currentStep ? `${snapshot.companyName} · ` : ''}
        {snapshot.completedStepCount} of {snapshot.totalActiveSteps} steps done
      </span>
    </div>
  );
}

/**
 * The Ask VCFO prompt home (K-47, audit 136): "What can I do for you?" and four
 * quick-start chips, with the client's project card (prototype AskThread home). No mascot (C-0003) and no
 * explanation line (rule R-06). The compact form, used above the composer once a
 * conversation has started, keeps every suggestion in one scrolling row.
 */
export function AskHome({ compact = false }: { compact?: boolean }) {
  const ask = useAskOptional();
  const query = useAskSuggestions(ask?.shell ?? null, ask?.engagementId ?? null, Boolean(ask?.enabled));
  if (!ask) return null;
  const suggestions = query.data?.suggestions ?? [];
  const snapshot = query.data?.snapshot ?? null;
  const shown = compact ? suggestions : suggestions.slice(0, 4);
  const chip = (s: (typeof suggestions)[number]) => (
    <li key={s.id} className="shrink-0">
      <button
        type="button"
        disabled={ask.busy}
        onClick={() => void ask.ask({ suggestionId: s.id, label: s.label })}
        className={cn(
          'min-h-[32px] rounded-md border-1.5 border-line bg-surface-raised px-3 py-1.5 text-left text-[13px] text-ink-2 hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:opacity-50',
          compact && 'whitespace-nowrap',
        )}
      >
        {s.label}
      </button>
    </li>
  );

  if (compact) {
    return <ul className="flex gap-1.5 overflow-x-auto pb-1">{shown.map(chip)}</ul>;
  }
  return (
    <div className="grid gap-4">
      <h2 className="text-[16px] font-medium text-ink">What can I do for you?</h2>
      {snapshot ? <ProjectCard snapshot={snapshot} /> : null}
      {query.isError && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          Could not load suggestions.
        </p>
      )}
      <div className="grid gap-2">
        <h3 className="text-[12px] font-medium text-ink-muted">Quick questions</h3>
        {query.isLoading ? (
          <div className="flex flex-wrap gap-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block h-8 w-36 animate-pulse rounded-md bg-surface-sunken" />
            ))}
          </div>
        ) : (
          <ul aria-label="Quick start" className="flex flex-wrap gap-2">
            {shown.map(chip)}
          </ul>
        )}
      </div>
    </div>
  );
}
