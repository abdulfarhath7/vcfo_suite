import { Tag, type ChipTone } from '@/components/ui/spectrum-chip';
import { CARD_AGENT_LEVEL_LABEL, type CardAgentLevel } from '@/lib/card-agents/card-agents';

const LEVEL_TONE: Record<CardAgentLevel, ChipTone> = {
  ready: 'ok',
  practice: 'prog',
  prepare: 'teal',
  coming: 'idle',
};

/** What a robot can do today, in one of four words (MASTER-PLAN screen 2): Ready, Practice, Prepares data, Coming. */
export function LevelBadge({ level, className }: { level: CardAgentLevel; className?: string }) {
  return (
    <Tag tone={LEVEL_TONE[level]} className={className}>
      {CARD_AGENT_LEVEL_LABEL[level]}
    </Tag>
  );
}
