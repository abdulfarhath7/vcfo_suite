'use client';

import type { ProjectSnapshot } from '@/data/ask/schema';
import { useAskSuggestions } from '@/hooks/ask/use-ask-suggestions';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

function ProjectCard({ snapshot }: { snapshot: ProjectSnapshot }) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface-raised p-3">
      <p className="text-[12px] text-ink-muted">Your project</p>
      <p className="truncate text-[14px] font-semibold text-ink">{snapshot.companyName}</p>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        {snapshot.currentPhase}
        {snapshot.currentStep ? ` · ${snapshot.currentStep.title}` : ''} · {snapshot.completedStepCount} of{' '}
        {snapshot.totalActiveSteps} steps done
      </p>
    </div>
  );
}

/**
 * The Ask VCFO prompt home (K-47, audit 136): "What can I do for you?" and four
 * quick-start chips, with the client's project card. No mascot (C-0003) and no
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
          'min-h-9 rounded-md border border-line bg-surface-raised px-3 text-left text-[13px] text-ink hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40 disabled:opacity-50',
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
    <div className="space-y-4">
      <h2 className="text-[20px] font-semibold text-ink">What can I do for you?</h2>
      {snapshot ? <ProjectCard snapshot={snapshot} /> : null}
      {query.isError && (
        <p role="alert" className="text-[12.5px] text-danger">
          Could not load suggestions.
        </p>
      )}
      <ul aria-label="Quick start" className="flex flex-wrap gap-2">
        {shown.map(chip)}
      </ul>
    </div>
  );
}
