'use client';

import { useEffect, useRef, useState } from 'react';
import { useAskOptional } from '@/components/ask/ask-context';
import { useAvatarYield } from '@/components/ask/use-avatar-yield';
import { useCardAgentInfo } from '@/hooks/use-card-agent';
import { cn } from '@/lib/utils';
import { useCardAgentContext } from './card-agent-context';
import { LevelBadge } from './LevelBadge';
import { Robot } from './Robot';

/** The gap between the card robot and the Ask VCFO robot. */
const GAP = 8;
const FALLBACK_RIGHT = 24;

/**
 * Keeps the dock just left of the Ask VCFO launcher (`#ask-avatar`), whose width follows the
 * window. Measured, not guessed, so the two never overlap.
 */
function useDockRight(active: boolean): number {
  const [right, setRight] = useState(FALLBACK_RIGHT);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const ask = document.getElementById('ask-avatar');
      if (!ask) return setRight(FALLBACK_RIGHT);
      const box = ask.getBoundingClientRect();
      setRight(box.width ? Math.max(FALLBACK_RIGHT, Math.round(window.innerWidth - box.left + GAP)) : FALLBACK_RIGHT);
    };
    measure();
    const first = setTimeout(measure, 80);
    const iv = setInterval(() => {
      if (!document.hidden) measure();
    }, 1500);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
      window.removeEventListener('resize', measure);
    };
  }, [active]);
  return right;
}

/**
 * The card agent's robot in the corner dock, beside the Ask VCFO robot (MASTER-PLAN screen 3):
 * the robot in the agent's colour, its name and its level. It shows only on a page that registered
 * a card with a catalog task (`useCardAgent`), only in the staff shell, never on phones and never
 * on the full Ask VCFO page. Clicking it opens the card panel and closes the Ask VCFO chat.
 */
export function CardAgentLauncher() {
  const ctx = useCardAgentContext();
  const ask = useAskOptional();
  const card = ctx?.card ?? null;
  const info = useCardAgentInfo(card);
  const lead = info.data?.agents[0];
  const visible = Boolean(ctx && card && lead && !ask?.pageOpen);
  const ref = useRef<HTMLDivElement>(null);
  const open = Boolean(ctx?.open);
  const { yieldOn } = useAvatarYield(ref, open);
  const right = useDockRight(visible);
  if (!visible || !ctx || !lead) return null;
  const more = (info.data?.agents.length ?? 1) - 1;

  return (
    <div id="card-agent-dock" ref={ref} className={cn(yieldOn && !open && 'yield', open && 'open')} style={{ right }}>
      <button
        type="button"
        onClick={ctx.toggle}
        aria-expanded={open}
        aria-controls="card-agent-panel"
        aria-label={`${open ? 'Close' : 'Open'} ${lead.name}, ${lead.levelLabel}`}
        className={cn(
          'ca-launch group inline-flex h-11 flex-none items-center gap-2 rounded-md border-1.5 bg-surface-raised py-1 pl-1.5 pr-2.5 text-[13px] font-medium text-ink shadow-dialog transition-colors hover:bg-hover',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40',
        )}
        style={{ borderColor: lead.colour }}
      >
        {/* `vpl-char` is the box `useAvatarYield` checks for covered controls. */}
        <span className="vpl-char block">
          <Robot color={lead.colour} mood={open ? 'working' : 'idle'} size={34} />
        </span>
        <span className="max-w-[160px] truncate">{lead.name}</span>
        {more > 0 ? <span className="text-[12px] font-normal text-ink-muted">+{more}</span> : null}
        <LevelBadge level={lead.level} />
      </button>
    </div>
  );
}
