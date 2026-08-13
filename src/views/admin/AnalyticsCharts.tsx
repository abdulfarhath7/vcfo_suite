'use client';

import { useEffect, useState } from 'react';

type ChartRow = {
  m: string;
  completion: number;
  target: number;
  delay: number;
  benchmark: number;
};

type RechartsModule = typeof import('recharts');

function useRecharts(): RechartsModule | null {
  const [recharts, setRecharts] = useState<RechartsModule | null>(null);
  useEffect(() => {
    void import('recharts').then(setRecharts);
  }, []);
  return recharts;
}

function ChartPlaceholder() {
  return <div className="h-full w-full animate-pulse rounded-md bg-muted/40" aria-hidden />;
}

export function AnalyticsCompletionChart({ data }: { data: ChartRow[] }) {
  const RC = useRecharts();
  if (!RC) return <ChartPlaceholder />;

  const { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } = RC;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" />
        <XAxis dataKey="m" tick={{ fontSize: 11, fill: 'oklch(var(--text-tertiary))' }} axisLine={false} tickLine={false} />
        <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: 'oklch(var(--text-tertiary))' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'oklch(var(--surface))', border: '1px solid oklch(var(--border))', borderRadius: 8, fontSize: 12 }} />
        <ReferenceLine y={95} stroke="oklch(var(--text-tertiary))" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="completion"
          name="Completion %"
          stroke="oklch(var(--success))"
          strokeWidth={2}
          dot={{ r: 3, fill: 'oklch(var(--success))', strokeWidth: 0 }}
          activeDot={{ r: 4, fill: 'oklch(var(--success))', stroke: 'oklch(var(--surface))', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsDelayChart({ data }: { data: ChartRow[] }) {
  const RC = useRecharts();
  if (!RC) return <ChartPlaceholder />;

  const { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } = RC;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" />
        <XAxis dataKey="m" tick={{ fontSize: 11, fill: 'oklch(var(--text-tertiary))' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'oklch(var(--text-tertiary))' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'oklch(var(--surface))', border: '1px solid oklch(var(--border))', borderRadius: 8, fontSize: 12 }} />
        <ReferenceLine y={2} stroke="oklch(var(--text-tertiary))" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="delay"
          name="Avg delay (days)"
          stroke="oklch(var(--info))"
          strokeWidth={2}
          dot={{ r: 3, fill: 'oklch(var(--info))', strokeWidth: 0 }}
          activeDot={{ r: 4, fill: 'oklch(var(--info))', stroke: 'oklch(var(--surface))', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
