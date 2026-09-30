import type { Visual } from '@/data/ask/schema';

type TimelineVisual = Extract<Visual, { type: 'timeline' }>;


export function Timeline({ visual }: { visual: TimelineVisual }) {
  return (
    <ol className="relative space-y-2 border-l border-border pl-4">
      {visual.events.map((e, i) => (
        <li key={`${e.label}-${i}`} className="relative text-[13px]">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden />
          <span className="font-medium text-foreground">{e.label}</span>
          <span className="ml-2 font-mono text-[11.5px] text-muted-foreground">{e.when}</span>
        </li>
      ))}
    </ol>
  );
}
