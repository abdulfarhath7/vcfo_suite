import { m } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  hint?: string;
}

export function KpiCard({ label, value, delta, trend = 'flat', hint }: Props) {
  return (
    <m.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="card-surface p-4"
    >
      <div className="text-[11.5px] text-text-tertiary uppercase tracking-wider">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="serif text-[34px] leading-none text-ink">{value}</div>
        {delta && (
          <span className={cn(
            'text-[11px] font-medium',
            trend === 'up' && 'text-success-text',
            trend === 'down' && 'text-danger-text',
            trend === 'flat' && 'text-text-tertiary',
          )}>{delta}</span>
        )}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-text-tertiary">{hint}</div>}
    </m.div>
  );
}
