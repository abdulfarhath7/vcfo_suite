import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  total: number;
  labels?: string[];
  className?: string;
}

export function StepIndicator({ current, total, labels, className }: StepIndicatorProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const almostThere = pct >= 80 && pct < 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="mono text-muted-foreground">
          Step {current} of {total}
        </span>
        <span className={cn("font-medium", almostThere ? "text-role-foreground" : "text-muted-foreground")}>
          {almostThere ? "Almost there" : `${pct}% complete`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-primary-light overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {labels && labels.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {labels.map((label, i) => {
            const stepNum = i + 1;
            const done = stepNum < current;
            const active = stepNum === current;
            return (
              <span
                key={label}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] mono",
                  done && "bg-success-light text-success-text",
                  active && "border border-primary/30 bg-primary-light text-primary font-medium",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {done && <Check className="w-3 h-3" aria-hidden />}
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
