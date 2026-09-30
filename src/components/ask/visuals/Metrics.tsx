import type { Visual } from '@/data/ask/schema';

type MetricsVisual = Extract<Visual, { type: 'metrics' }>;


export function Metrics({ visual }: { visual: MetricsVisual }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {visual.items.map((m) => (
        <div key={m.k} className="rounded-[var(--radius-md)] border border-border bg-panel px-3 py-2">
          <dt className="text-[11.5px] text-muted-foreground">{m.k}</dt>
          <dd className="font-serif text-[20px] font-semibold leading-tight text-foreground">{m.v}</dd>
        </div>
      ))}
    </dl>
  );
}
