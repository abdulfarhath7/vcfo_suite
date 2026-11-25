'use client';

import { useCallback, useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chip } from '@/components/ui/spectrum-chip';
import { repeatFieldId } from '@/lib/checklist/checklist-repeat';
import { DIN_GROUP_ID, DIN_STATUS_OPTIONS } from '@/lib/checklist/din-verification';
import { currentAssociations } from '@/lib/din-lookup/normalize';
import { compareDirectorName, nameMatchMessage } from '@/lib/din-lookup/name-match';
import { dinStatusKind, kycKind } from '@/lib/din-lookup/status';
import { isValidDin } from '@/lib/din-lookup/validate';
import type { NormalizedDinData } from '@/lib/din-lookup/types';
import { DinStatusBadge } from './DinStatusBadge';

/**
 * DR-01: the project lead's DIN check on one director, shown on the director's read-only card
 * (the client fills the details, the lead records the check). The server stamps who and when.
 *
 * "Check with MCA" fetches the MCA director master data for the typed DIN and compares the
 * name for the lead. It proposes a result and never records one: under firm policy
 * SBC-STD-AI-02 the person decides, so the lead presses Verified or Mismatch themselves.
 */
export function DinCheckControl({ values, entryId, onChange }: {
  values: Record<string, string | undefined>;
  entryId: string;
  onChange: (fieldId: string, value: string) => void;
}) {
  const key = (field: string) => repeatFieldId(DIN_GROUP_ID, entryId, field);
  const [record, setRecord] = useState<NormalizedDinData | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const din = (values[key('din')] ?? '').trim();
  const typedName = [values[key('firstName')], values[key('middleName')], values[key('lastName')]]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');

  const check = useCallback(async () => {
    setError(null);
    setChecking(true);
    try {
      const res = await fetch('/api/tools/din-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ din }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setRecord(null);
        setError(json.error ?? `The MCA lookup failed (${res.status}).`);
        return;
      }
      setRecord(json.data as NormalizedDinData);
    } catch {
      setRecord(null);
      setError('Network error — could not reach the server.');
    } finally {
      setChecking(false);
    }
  }, [din]);

  if ((values[key('hasDin')] ?? '').trim() === 'no') return <DinStatusBadge responses={values} entryId={entryId} />;

  const status = (values[key('dinStatus')] ?? '').trim();
  const match = record ? compareDirectorName(typedName, record.name) : null;
  const canCheck = isValidDin(din);

  /** Record the lead's decision, with the difference carried into the mismatch note. */
  const recordResult = (next: 'verified' | 'mismatch') => {
    onChange(key('dinStatus'), next);
    if (next === 'mismatch' && record && match) {
      onChange(key('dinMismatchNote'), nameMatchMessage(match, record.name));
    }
  };

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[13px]"
          onClick={() => void check()}
          disabled={!canCheck || checking}
          title={canCheck ? 'Fetch the MCA director master data for this DIN' : 'Enter the 8-digit DIN first'}
        >
          {checking ? <Loader2 className="animate-spin" /> : <Landmark />}
          Check with MCA
        </Button>
        {status === 'mismatch' ? (
          <Input
            className="h-8 max-w-sm text-[13px]"
            aria-label="Details that differ from MCA"
            placeholder="Details that differ from MCA"
            defaultValue={values[key('dinMismatchNote')] ?? ''}
            key={values[key('dinMismatchNote')] ?? ''}
            onBlur={(e) => onChange(key('dinMismatchNote'), e.target.value)}
          />
        ) : null}
      </div>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      {record ? (
        <div className="space-y-1.5 rounded-md border border-line-soft bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink">{record.name || `DIN ${record.din}`}</span>
            {record.dinStatus ? <Chip tone={dinStatusKind(record.dinStatus)} raw>{record.dinStatus}</Chip> : null}
            {record.dir3Kyc ? <Chip tone={kycKind(record.dir3Kyc)} raw>{`DIR-3 KYC ${record.dir3Kyc}`}</Chip> : null}
            {match ? (
              <Chip tone={match.kind === 'same' ? 'ok' : match.kind === 'close' ? 'warn' : 'bad'} raw>
                {match.kind === 'same' ? 'Name matches' : match.kind === 'close' ? 'Name close' : match.kind === 'differs' ? 'Name differs' : 'No name to compare'}
              </Chip>
            ) : null}
          </div>
          {match ? <p className="text-[12px] text-ink-muted">{nameMatchMessage(match, record.name)}</p> : null}
          <p className="text-[12px] text-ink-muted">
            {currentAssociations(record).length} current appointment
            {currentAssociations(record).length === 1 ? '' : 's'} on MCA
            {currentAssociations(record).length > 0
              ? `: ${currentAssociations(record).slice(0, 3).map((a) => a.companyName).filter(Boolean).join(', ')}${currentAssociations(record).length > 3 ? ' and more' : ''}`
              : ''}
            .
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button type="button" size="sm" variant="outline" className="h-7 text-[12px]" onClick={() => recordResult('verified')}>
              Record as verified
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[12px]" onClick={() => recordResult('mismatch')}>
              Record as mismatch
            </Button>
            <span className="text-[12px] text-ink-muted">MCA publishes no date of birth or father&apos;s name; compare those on the portal.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
