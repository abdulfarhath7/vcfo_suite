import type { Visual } from '@/data/assist/schema';

type StepsVisual = Extract<Visual, { type: 'steps' }>;


export function Steps({ visual }: { visual: StepsVisual }) {
  return (
    <ol className="space-y-1.5">
      {visual.items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="flex items-start gap-2.5 text-[13px] text-foreground">
          <span
            className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            {item.label}
            {item.form && (
              <span className="ml-1.5 rounded bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">{item.form}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
