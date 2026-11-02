'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tag } from '@/components/ui/spectrum-chip';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { DocCheckDef } from './types';

/**
 * T5: the receive checklist. Accept unlocks when every check is ticked. Send back opens a reason
 * box and cannot send an empty reason. `done` locks the list after Accept.
 */
export function ReceiveChecklist({
  checks,
  ticked,
  onTick,
  onAccept,
  onSendBack,
  done = false,
  busy = false,
  title = 'Receive checklist',
  className,
}: {
  checks: DocCheckDef[];
  ticked: string[];
  onTick: (key: string, on: boolean) => void;
  onAccept: () => void;
  onSendBack: (reason: string) => void;
  done?: boolean;
  busy?: boolean;
  title?: string;
  className?: string;
}) {
  const id = useId();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  // The reason box takes the focus when it opens, so the keyboard lands where the typing goes.
  useEffect(() => {
    if (asking) reasonRef.current?.focus();
  }, [asking]);
  const count = checks.filter((c) => ticked.includes(c.key)).length;
  const all = count === checks.length && checks.length > 0;

  return (
    <section aria-label={title} className={cn('min-w-0 overflow-hidden rounded-md border-1.5 border-line bg-surface-raised', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <h4 className="m-0 text-[14px] font-medium text-ink">{title}</h4>
        <Tag tone={all ? 'ok' : 'idle'}>
          {count} of {checks.length}
        </Tag>
      </div>
      <div className="grid gap-1 px-4 pb-3 pt-2">
        {checks.map((c) => {
          const cid = `${id}-${c.key}`;
          return (
            <label key={c.key} htmlFor={cid} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13px] text-ink">
              <Checkbox id={cid} checked={done || ticked.includes(c.key)} disabled={done || busy} onCheckedChange={(v) => onTick(c.key, v === true)} />
              {c.label}
            </label>
          );
        })}
      </div>
      {asking && !done ? (
        <div className="grid gap-2 border-t border-line-soft px-4 py-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          <label htmlFor={`${id}-reason`} className="text-[13px] font-medium text-ink">
            Reason
          </label>
          <Textarea id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} ref={reasonRef} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setAsking(false);
                setReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!reason.trim() || busy}
              onClick={() => {
                onSendBack(reason.trim());
                setAsking(false);
                setReason('');
              }}
            >
              Send back
            </Button>
          </div>
        </div>
      ) : null}
      {!done ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-4 py-3">
          {!asking ? (
            <Button variant="secondary" size="sm" className="text-danger" disabled={busy} onClick={() => setAsking(true)}>
              Send back
            </Button>
          ) : null}
          <Button size="sm" disabled={!all || busy} onClick={onAccept}>
            Accept
          </Button>
        </div>
      ) : null}
    </section>
  );
}
