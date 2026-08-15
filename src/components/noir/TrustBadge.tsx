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
        "inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800",
        className,
      )}
    >
      <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
