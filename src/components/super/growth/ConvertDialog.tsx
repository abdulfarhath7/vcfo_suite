'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Prospect } from '@/lib/growth/pipeline';
import { FIELD_LABEL, FIELD_SELECT } from './growth-ui';

/**
 * "Convert to client" (G-21): link a won prospect to an engagement that already exists. The
 * super admin picks it from the firm's engagements; nothing is created here.
 */
export interface EngagementOption {
  id: string;
  companyName: string;
}

export function ConvertDialog({
  prospect,
  engagements,
  linkedIds,
  saving,
  onOpenChange,
  onConvert,
}: {
  prospect: Prospect | null;
  engagements: EngagementOption[];
  /** Engagements another prospect already links to. */
  linkedIds: Set<string>;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConvert: (engagementId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  useEffect(() => {
    if (!prospect) return;
    setQuery(prospect.company ?? '');
    setPicked('');
  }, [prospect]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? engagements.filter((e) => e.companyName.toLowerCase().includes(q)) : engagements;
    return [...list].sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [engagements, query]);

  return (
    <Dialog open={!!prospect} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-medium">Convert to client</DialogTitle>
          <p className="text-[13px] text-ink-muted">{prospect?.company || prospect?.name}</p>
        </DialogHeader>
        <div className="grid gap-3.5">
          <div>
            <label htmlFor="cv-search" className={FIELD_LABEL}>Find the engagement</label>
            <Input id="cv-search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cv-engagement" className={FIELD_LABEL}>Engagement</label>
            <select id="cv-engagement" className={FIELD_SELECT} value={picked} onChange={(e) => setPicked(e.target.value)}>
              <option value="">{options.length === 0 ? 'No engagement matches' : 'Pick one'}</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.companyName}
                  {linkedIds.has(e.id) ? ' · already linked' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!picked || saving} onClick={() => onConvert(picked)}>
            Link client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
