import type { ChipTone } from '@/components/ui/spectrum-chip';
import type { ProspectStage } from '@/lib/growth/pipeline';

/**
 * Display helpers for the Growth pipeline. Kept apart from the components so the component
 * files only export components.
 */
export const STAGE_TONE: Record<ProspectStage, ChipTone> = {
  lead: 'idle',
  contacted: 'teal',
  proposal: 'prog',
  won: 'ok',
  lost: 'bad',
};

/** Shared field classes, matching the shadcn inputs on the staff screens. */
export const FIELD_LABEL = 'mb-1 block text-[13px] font-medium text-ink';
export const FIELD_SELECT =
  'h-control-md w-full rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px] text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';
export const FIELD_SELECT_SM =
  'h-control-sm rounded-md border-1.5 border-line-strong bg-surface-raised px-2 text-[12.5px] text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';

/** Days since an ISO time, for "in stage 4d". */
export function daysSince(iso: string, now = new Date()): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}
