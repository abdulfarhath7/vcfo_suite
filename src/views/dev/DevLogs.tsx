'use client';

import { useEffect, useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CloseButton, DevCard, KeyValue, Pending, ReachChip, ReachNotice, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { stampSec } from '@/lib/dev/format';
import type { LogLine, LogsPayload } from '@/lib/dev/types';

/**
 * Logs: CloudWatch log lines from APP_LOG_GROUP, newest first. The text filter runs in
 * CloudWatch; the level is read from each line. Emails and phones arrive masked.
 */

const LEVELS = ['all', 'error', 'warn', 'info'] as const;
const HOURS = ['1', '6', '24', '72'] as const;

export default function DevLogs() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('all');
  const [hours, setHours] = useState<(typeof HOURS)[number]>('6');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  // Search after typing stops, so each key press is not a CloudWatch call.
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);

  const sp = new URLSearchParams({ level, hours });
  if (search) sp.set('q', search);
  const q = useDevApi<LogsPayload>(`/api/dev/logs?${sp.toString()}`);

  const lines = q.data?.lines.state === 'ok' ? q.data.lines.data : [];
  const cur = lines.find((l) => l.id === picked) ?? null;
  const any = level !== 'all' || !!text;

  const columns: EFilingColumn<LogLine>[] = [
    { key: 'at', header: 'Time', width: '170px', render: (l) => stampSec(l.at) },
    { key: 'level', header: 'Level', width: '148px', render: (l) => <StatusChip status={l.level} /> },
    { key: 'msg', header: 'Message', render: (l) => <span className="font-mono text-[12.5px] text-ink-2">{l.message}</span> },
    { key: 'stream', header: 'Instance', width: '120px', render: (l) => <span className="font-mono text-[12px] text-ink-muted">{l.stream.slice(0, 12) || '-'}</span> },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title="Log lines"
        meta={q.data?.group ? <span className="font-mono">{q.data.group}</span> : undefined}
        right={q.data ? <ReachChip reach={q.data.lines} /> : null}
        filters={
          <>
            <SpectrumTabs label="Level" items={LEVELS.map((l) => ({ key: l, label: l === 'all' ? 'All' : l.charAt(0).toUpperCase() + l.slice(1) }))} value={level} onChange={(k) => setLevel(k as typeof level)} />
            <SpectrumTabs label="Period" items={HOURS.map((h) => ({ key: h, label: `${h} h` }))} value={hours} onChange={(k) => setHours(k as typeof hours)} />
            <Input aria-label="Search" type="search" placeholder="Search" value={text} onChange={(e) => setText(e.target.value)} className="h-[30px] w-[180px] text-[13px]" />
            {any ? (
              <Button size="sm" variant="ghost" onClick={() => { setLevel('all'); setText(''); }}>
                Clear
              </Button>
            ) : null}
          </>
        }
      >
        {!q.data ? (
          <Pending error={q.error} rows={8} />
        ) : q.data.lines.state === 'ok' ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={columns} rows={lines} rowKey={(l) => l.id} pageSize={25} minWidth={860} empty="No log lines match" onRowClick={(l) => setPicked((p) => (p === l.id ? null : l.id))} />
          </div>
        ) : (
          <ReachNotice reach={q.data.lines} service="CloudWatch Logs" />
        )}
      </DevCard>

      {cur ? (
        <DevCard title="Log line" meta={stampSec(cur.at)} right={<CloseButton onClick={() => setPicked(null)} />}>
          <KeyValue
            rows={[
              { k: 'Level', v: <StatusChip status={cur.level} /> },
              { k: 'Instance', v: cur.stream || '-', mono: true },
              { k: 'Time', v: stampSec(cur.at) },
            ]}
          />
          <pre className="mx-4 mb-4 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md border-1.5 border-line bg-surface-sunken p-3 font-mono text-[12.5px] text-ink-2">{cur.message}</pre>
        </DevCard>
      ) : null}
    </div>
  );
}
