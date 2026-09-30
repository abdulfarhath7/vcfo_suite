'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAskOptional } from './ask-context';

/**
 * Super admin "Preview Ask VCFO as a client" (§9): pick one engagement; the
 * panel then runs the client persona scoped to it, read-only (no saves, no
 * hand-offs), under a "Client view" banner.
 */
export function AskPreviewPicker() {
  const ask = useAskOptional();
  const { engagements } = useApp();
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return engagements
      .filter((e) => e.stage !== 'Operational Readiness')
      .filter((e) => !needle || e.companyName.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [engagements, q]);
  if (!ask || ask.shell !== 'super') return null;
  return (
    <div className="space-y-2 rounded-[var(--radius)] border border-border bg-panel p-3">
      <label htmlFor="ask-preview-search" className="block text-[12.5px] font-medium text-foreground">
        Find a client
      </label>
      <input
        id="ask-preview-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Company name"
        className="min-h-[40px] w-full rounded-[var(--radius-md)] border border-input bg-panel px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <ul className="space-y-1">
        {matches.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => ask.setPreview({ engagementId: e.id, companyName: e.companyName })}
              className="flex min-h-[40px] w-full items-center rounded-[var(--radius-md)] px-2.5 text-left text-[13px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {e.companyName}
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-2.5 text-[12.5px] text-muted-foreground">No matching clients.</li>}
      </ul>
    </div>
  );
}
