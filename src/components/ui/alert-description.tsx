import * as React from "react";
import { cn } from "@/lib/utils";

export function AlertDescription({ ref, className, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  );
}
