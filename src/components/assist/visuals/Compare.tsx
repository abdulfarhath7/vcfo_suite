import type { Visual } from '@/data/assist/schema';

type CompareVisual = Extract<Visual, { type: 'compare' }>;


export function Compare({ visual }: { visual: CompareVisual }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[visual.left, visual.right].map((side) => (
        <div key={side.title} className="rounded-[var(--radius-md)] border border-border bg-panel p-2.5">
          <p className="text-[12.5px] font-semibold text-foreground">{side.title}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12.5px] text-muted-foreground">
            {side.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
