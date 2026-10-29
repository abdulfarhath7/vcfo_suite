'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  PROSPECT_SERVICE_LABEL,
  PROSPECT_SERVICES,
  PROSPECT_SOURCE_LABEL,
  PROSPECT_SOURCES,
  PROSPECT_STAGE_LABEL,
  PROSPECT_STAGES,
  type Prospect,
} from '@/lib/growth/pipeline';
import type { ProspectFormValues, ProspectOwner } from '@/views/super/growth/use-growth-data';
import { FIELD_LABEL, FIELD_SELECT } from './growth-ui';

/**
 * Add or edit a prospect (G-21): name, firm, contact, source, stage, service, owner, next
 * step date and notes. There is no fee field (R-37).
 */
function initial(p: Prospect | null, defaultOwnerId: string): ProspectFormValues {
  return {
    name: p?.name ?? '',
    company: p?.company ?? '',
    email: p?.email ?? '',
    phone: p?.phone ?? '',
    source: p?.source ?? 'referral',
    stage: p?.stage ?? 'lead',
    service: p?.service ?? '',
    ownerId: p ? p.ownerId ?? '' : defaultOwnerId,
    notes: p?.notes ?? '',
    nextStepOn: p?.nextStepOn ?? '',
  };
}

export function ProspectDialog({
  open,
  onOpenChange,
  prospect,
  owners,
  defaultOwnerId,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to add a new prospect. */
  prospect: Prospect | null;
  owners: ProspectOwner[];
  defaultOwnerId: string;
  saving: boolean;
  onSave: (values: ProspectFormValues) => void;
}) {
  const [v, setV] = useState<ProspectFormValues>(() => initial(prospect, defaultOwnerId));
  useEffect(() => {
    if (open) setV(initial(prospect, defaultOwnerId));
  }, [open, prospect, defaultOwnerId]);

  const set = <K extends keyof ProspectFormValues>(k: K, value: ProspectFormValues[K]) => setV((old) => ({ ...old, [k]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(v);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-medium">{prospect ? 'Edit prospect' : 'Add prospect'}</DialogTitle>
        </DialogHeader>
        <form id="prospect-form" onSubmit={submit} className="grid max-h-[65vh] grid-cols-1 gap-3.5 overflow-y-auto px-0.5 sm:grid-cols-2">
          <div>
            <label htmlFor="pr-name" className={FIELD_LABEL}>Name</label>
            <Input id="pr-name" required maxLength={160} value={v.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label htmlFor="pr-company" className={FIELD_LABEL}>Firm</label>
            <Input id="pr-company" maxLength={200} value={v.company} onChange={(e) => set('company', e.target.value)} />
          </div>
          <div>
            <label htmlFor="pr-email" className={FIELD_LABEL}>Email</label>
            <Input id="pr-email" type="email" maxLength={200} value={v.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label htmlFor="pr-phone" className={FIELD_LABEL}>Phone</label>
            <Input id="pr-phone" maxLength={40} value={v.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label htmlFor="pr-stage" className={FIELD_LABEL}>Stage</label>
            <select id="pr-stage" className={FIELD_SELECT} value={v.stage} onChange={(e) => set('stage', e.target.value as ProspectFormValues['stage'])}>
              {PROSPECT_STAGES.map((s) => (
                <option key={s} value={s}>{PROSPECT_STAGE_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-owner" className={FIELD_LABEL}>Owner</label>
            <select id="pr-owner" className={FIELD_SELECT} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
              <option value="">Nobody yet</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-service" className={FIELD_LABEL}>Service</label>
            <select id="pr-service" className={FIELD_SELECT} value={v.service ?? ''} onChange={(e) => set('service', e.target.value as ProspectFormValues['service'])}>
              <option value="">Not known yet</option>
              {PROSPECT_SERVICES.map((s) => (
                <option key={s} value={s}>{PROSPECT_SERVICE_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-source" className={FIELD_LABEL}>Source</label>
            <select id="pr-source" className={FIELD_SELECT} value={v.source} onChange={(e) => set('source', e.target.value as ProspectFormValues['source'])}>
              {PROSPECT_SOURCES.map((s) => (
                <option key={s} value={s}>{PROSPECT_SOURCE_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-next" className={FIELD_LABEL}>Next step on</label>
            <Input id="pr-next" type="date" value={v.nextStepOn} onChange={(e) => set('nextStepOn', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pr-notes" className={FIELD_LABEL}>Notes</label>
            <Textarea id="pr-notes" rows={4} maxLength={4000} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="prospect-form" disabled={saving || !v.name.trim()}>
            {prospect ? 'Save' : 'Add prospect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
