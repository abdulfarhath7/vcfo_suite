import { cn } from '@/lib/utils';

interface Props {
  value: number; // 0..100
  className?: string;
}

export function ProgressBar({ value, className }: Props) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
