'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { Button } from '@/components/ui/button';
import { ASSIGNABLE_FILL_STEP_IDS, isFillAssignedToLead } from '@/lib/incorporation/pre-inc-direct-flow';
import { isAdminOrManager } from '@/lib/auth';
import { toastError, toastSuccess } from '@/lib/toast-errors';

/**
 * DR-02, DR-04: on the Proposed directors step, staff read who must fill it. By default "The
 * Client must fill this section" and the lead reads it; a manager or admin can press "Assign to
 * Lead" (the banner then reads "The Lead must fill this section") and "Assign to Client" to set it
 * back. Leads and clients never see the buttons; the server checks the role too.
 */
export function FillOwnerBanner({ engagement, itemId }: { engagement: Pick<Engagement, 'id'>; itemId: string }) {
  const { user, getStateForEngagement, refreshEngagementChecklist } = useApp();
  const [busy, setBusy] = useState(false);
  if (!ASSIGNABLE_FILL_STEP_IDS.has(itemId) || !user || user.role === 'client') return null;
  const slice = getStateForEngagement(engagement as Engagement)[itemId];
  const toLead = isFillAssignedToLead(itemId, slice);
  const canAssign = isAdminOrManager(user.role);

  const assign = async (to: 'lead' | 'client') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagement.id)}/checklist/assign-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, to }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'assign_failed');
      await refreshEngagementChecklist(engagement.id);
      toastSuccess(to === 'lead' ? 'Assigned to the project lead' : 'Assigned to the client');
    } catch (err) {
      toastError('Could not change who fills this', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="note" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border-1.5 border-info-line bg-info-soft px-3 py-2 text-[13.5px] text-ink">
      <Info className="h-4 w-4 flex-none text-info" aria-hidden />
      <span className="min-w-0 flex-1">
        {toLead ? 'The Lead must fill this section. The client can still add details.' : 'The Client must fill this section. The project lead reads it.'}
      </span>
      {canAssign ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void assign(toLead ? 'client' : 'lead')}>
          {toLead ? 'Assign to Client' : 'Assign to Lead'}
        </Button>
      ) : null}
    </div>
  );
}
