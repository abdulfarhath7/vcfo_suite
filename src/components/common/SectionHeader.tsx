import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, open, onToggle, right }: Props) {
  return (
    <button type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-slate-50"
    >
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-slate-400 transition-transform',
          !open && '-rotate-90'
        )}
      />
      <div className="flex-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      {right}
    </button>
  );
}
