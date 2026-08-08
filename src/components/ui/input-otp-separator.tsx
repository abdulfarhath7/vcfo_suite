import * as React from "react";
import { cn } from "@/lib/utils";

export function InputOTPSeparator({ ref, className, ...props }: React.ComponentPropsWithoutRef<"hr"> & { ref?: React.Ref<HTMLHRElement> }) {
  return (
    <hr
      ref={ref}
      aria-hidden
      className={cn("mx-2 h-4 w-px shrink-0 border-0 bg-border", className)}
      {...props}
    />
  );
}
