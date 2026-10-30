'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { DevCard, Pending, SettingRow, SwitchRow, useDevAction } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { stamp } from '@/lib/dev/format';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { ConsoleSettings } from '@/lib/dev/types';

const KEEP = ['14', '30', '90'] as const;

/**
 * Access › Console settings (P-355): the console's own settings in one card. Each one saves
 * on change and writes its audit row: "Pause all jobs" (asks first when turning on), "Keep
 * logs for" (CloudWatch), and the address "Send a test" uses.
 */
export function ConsoleSettingsCard() {
  const q = useDevApi<ConsoleSettings>('/api/dev/settings');
  const pause = useDevAction<{ on: boolean }>('/api/dev/jobs/pause');
  const keep = useDevAction<{ days: number }>('/api/dev/logs/retention');
  const save = useDevAction<{ testMailTo: string }>('/api/dev/settings');
  const [to, setTo] = useState('');
  const saved = q.data?.testMailTo ?? '';
  useEffect(() => setTo(saved), [saved]);

  const done = (label: string) => async (out: Awaited<ReturnType<typeof pause.run>>) => {
    if (out.ok === false) toastError('Not saved', out.error);
    else toastSuccess('Saved', label);
  };

  const r = q.data?.retention;
  return (
    <DevCard title="Console settings">
      {!q.data ? (
        <Pending error={q.error} rows={3} />
      ) : (
        <>
          <SwitchRow
            label="Pause all jobs"
            sub={q.data.paused.on ? `Paused by ${q.data.paused.by ?? 'someone'} · ${stamp(q.data.paused.at)}` : undefined}
            on={q.data.paused.on}
            busy={pause.busy}
            confirmOn={{ question: 'Pause all jobs? No reminder goes out until you resume.', confirm: 'Pause' }}
            onChange={async (on) => done(on ? 'Jobs paused' : 'Jobs resumed')(await pause.run({ on }))}
          />
          <SettingRow label="Keep logs for" sub={r?.state === 'ok' ? <span className="font-mono">{r.data.group}</span> : r?.state === 'not_set_up' ? 'Not set up' : 'Unreachable'}>
            {r?.state === 'ok' ? (
              <SpectrumTabs
                label="Keep logs for"
                items={KEEP.map((d) => ({ key: d, label: `${d} days` }))}
                value={String(r.data.days ?? '')}
                onChange={async (k) => done(`Logs kept for ${k} days`)(await keep.run({ days: Number(k) }))}
              />
            ) : null}
          </SettingRow>
          <SettingRow label="Test mail goes to">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (to.trim() !== saved) await done('Test mail address')(await save.run({ testMailTo: to.trim() }));
              }}
            >
              <Input
                aria-label="Test mail goes to"
                type="email"
                placeholder="name@sbcllp.in"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onBlur={async () => {
                  if (to.trim() !== saved) await done('Test mail address')(await save.run({ testMailTo: to.trim() }));
                }}
                className="h-[30px] w-[240px] text-[13px]"
              />
            </form>
          </SettingRow>
        </>
      )}
    </DevCard>
  );
}
