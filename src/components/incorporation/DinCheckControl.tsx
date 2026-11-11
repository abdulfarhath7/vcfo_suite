'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { repeatFieldId } from '@/lib/checklist/checklist-repeat';
import { DIN_GROUP_ID, DIN_STATUS_OPTIONS } from '@/lib/checklist/din-verification';
import { DinStatusBadge } from './DinStatusBadge';

/**
 * DR-01: the project lead's DIN check on one director, shown on the director's read-only card
 * (the client fills the details, the lead records the check). The server stamps who and when.
 */
export function DinCheckControl({ values, entryId, onChange }: {
  values: Record<string, string | undefined>;
  entryId: string;
  onChange: (fieldId: string, value: string) => void;
}) {
  const key = (field: string) => repeatFieldId(DIN_GROUP_ID, entryId, field);
  if ((values[key('hasDin')] ?? '').trim() === 'no') return <DinStatusBadge responses={values} entryId={entryId} />;
  const status = (values[key('dinStatus')] ?? '').trim();
  return (
    <div className="space-y-2 rounded-md bg-surface-sunken/40 px-3 py-2.5">
      <DinStatusBadge responses={values} entryId={entryId} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status || undefined} onValueChange={(next) => onChange(key('dinStatus'), next)}>
          <SelectTrigger className="h-8 w-[180px] text-[13px]" aria-label="DIN check result">
            <SelectValue placeholder="Record the DIN check" />
          </SelectTrigger>
          <SelectContent>
            {DIN_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {status === 'mismatch' ? (
          <Input
            className="h-8 max-w-sm text-[13px]"
            aria-label="Details that differ from MCA"
            placeholder="Details that differ from MCA"
            defaultValue={values[key('dinMismatchNote')] ?? ''}
            onBlur={(e) => onChange(key('dinMismatchNote'), e.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}
