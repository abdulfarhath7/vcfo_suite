import { cn } from '@/lib/utils';
import { toneForKey, TONE_BADGE } from '@/components/common/IconChip';

interface Props {
  initials?: string;
  name?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function AssigneeAvatar({ initials, name, size = 'sm', className }: Props) {
  if (!initials) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full border border-dashed border-border text-[10px] text-text-tertiary',
          size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
          className
        )}
        title="No assignee"
      >
        —
      </div>
    );
  }
  // Stable per-person hue: same name always renders the same color.
  const tone = TONE_BADGE[toneForKey(name ?? initials)];
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold',
        tone,
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs',
        className
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
