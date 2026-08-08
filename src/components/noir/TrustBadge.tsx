import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  children: React.ReactNode;
  className?: string;
}

/** Calm trust signal for client-facing confirmations. */
export function TrustBadge({ children, className }: TrustBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800",
        className,
      )}
    >
      <ShieldCheck className="w-4 h-4 shrink-0 text-orange-600" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
