import type { Visual } from '@/data/ask/schema';

type StepsVisual = Extract<Visual, { type: 'steps' }>;


export function Steps({ visual }: { visual: StepsVisual }) {
  return (
    <ol className="space-y-1.5">
      {visual.items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="flex items-start gap-2.5 text-[13px] text-ink">
          <span
            className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-medium text-ink-muted"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            {item.label}
            {item.form && (
              <span className="ml-1.5 rounded bg-surface-sunken px-1.5 py-px font-mono text-[11px] text-ink-muted">{item.form}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
